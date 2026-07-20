export type GeminiEnergyTier = "low" | "high";

export type GeminiEnergyTransitionInput = {
  energy: number;
  activeClients: number;
  nowMilliseconds: number;
};

export class GeminiEnergyTransitionGate {
  private static readonly MinimumContributors = 3;
  private static readonly EnterHighThreshold = 0.70;
  private static readonly ExitHighThreshold = 0.55;
  private static readonly HighDwellMilliseconds = 4_500;
  private static readonly LowDwellMilliseconds = 7_000;
  private static readonly CooldownMilliseconds = 45_000;

  private currentTier: GeminiEnergyTier = "low";
  private candidateTier: GeminiEnergyTier | undefined;
  private candidateSinceMilliseconds = 0;
  private lastAutomaticTransitionAt = Number.NEGATIVE_INFINITY;

  public setCurrentTier(tier: GeminiEnergyTier): void {
    this.currentTier = tier;
    this.clearCandidate();
  }

  public observe(input: GeminiEnergyTransitionInput): GeminiEnergyTier | undefined {
    const candidate = this.candidateFor(input.energy, input.activeClients);
    if (candidate === undefined || candidate === this.currentTier) {
      this.clearCandidate();
      return undefined;
    }

    if (candidate !== this.candidateTier) {
      this.candidateTier = candidate;
      this.candidateSinceMilliseconds = input.nowMilliseconds;
      return undefined;
    }

    const dwell = candidate === "high"
      ? GeminiEnergyTransitionGate.HighDwellMilliseconds
      : GeminiEnergyTransitionGate.LowDwellMilliseconds;
    if (input.nowMilliseconds - this.candidateSinceMilliseconds < dwell ||
        input.nowMilliseconds - this.lastAutomaticTransitionAt < GeminiEnergyTransitionGate.CooldownMilliseconds) {
      return undefined;
    }

    this.currentTier = candidate;
    this.lastAutomaticTransitionAt = input.nowMilliseconds;
    this.clearCandidate();
    return candidate;
  }

  private candidateFor(energy: number, activeClients: number): GeminiEnergyTier | undefined {
    if (activeClients < GeminiEnergyTransitionGate.MinimumContributors) return undefined;
    if (energy >= GeminiEnergyTransitionGate.EnterHighThreshold) return "high";
    if (energy <= GeminiEnergyTransitionGate.ExitHighThreshold) return "low";
    return undefined;
  }

  private clearCandidate(): void {
    this.candidateTier = undefined;
    this.candidateSinceMilliseconds = 0;
  }
}
