import type { RoomState } from "./protocol";

export type IntentLabel = "warmup" | "groove" | "lift" | "peak" | "recovery";

export type CrowdIntent = {
  label: IntentLabel;
  intensity: number;
  rhythmicDemand: number;
  stability: number;
  confidence: number;
  trend: number;
};

export class CrowdIntentTracker {
  private current: CrowdIntent = { label: "warmup", intensity: 0, rhythmicDemand: 0, stability: 1, confidence: 0, trend: 0 };
  private candidate: IntentLabel | undefined;
  private candidateSince = 0;

  public update(state: RoomState, now = performance.now()): CrowdIntent {
    const next = inferCrowdIntent(state);
    if (next.label === this.current.label) {
      this.candidate = undefined;
      this.current = next;
      return this.current;
    }

    if (this.candidate !== next.label) {
      this.candidate = next.label;
      this.candidateSince = now;
      return this.current = { ...next, label: this.current.label };
    }

    const requiredHold = next.confidence < 0.65 ? 1_800 : 900;
    if (now - this.candidateSince >= requiredHold) {
      this.current = next;
      this.candidate = undefined;
      return this.current;
    }

    this.current = { ...next, label: this.current.label };
    return this.current;
  }
}

export function inferCrowdIntent(state: RoomState): CrowdIntent {
  const intensity = clamp(state.energy * 0.48 + state.motionEnergy * 0.14 + state.audioEnergy * 0.2 + state.onsetDensity * 0.18);
  const rhythmicDemand = clamp(state.onsetDensity * 0.62 + state.audioEnergy * 0.38);
  const stability = clamp(state.coherence * 0.62 + (1 - state.volatility) * 0.38);
  const confidence = clamp(state.confidence);
  const trend = clamp(state.energyTrend, -1, 1);
  const label = trend < -0.12 && intensity < 0.7 ? "recovery"
    : intensity >= 0.76 && stability >= 0.4 ? "peak"
    : trend > 0.1 && intensity >= 0.35 ? "lift"
    : intensity >= 0.18 ? "groove"
    : "warmup";
  return { label, intensity, rhythmicDemand, stability, confidence, trend };
}

export function describeIntent(intent: CrowdIntent): string {
  const confidence = Math.round(intent.confidence * 100);
  const direction = intent.trend > 0.08 ? "rising" : intent.trend < -0.08 ? "falling" : "steady";
  return `${intent.label} intent · ${Math.round(intent.intensity * 100)}% intensity · ${direction} energy · ${confidence}% confidence`;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}
