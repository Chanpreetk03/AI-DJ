import type { RoomState } from "./protocol";
import type { MeasuredTrackProfile } from "./musicAnalysis";

export type DecisionCandidate = {
  id: string;
  title: string;
  profile: MeasuredTrackProfile;
};

export type DjDecision = {
  trackId: string;
  reason: string;
  score: number;
};

export function decideTrack(room: RoomState, candidates: DecisionCandidate[], history: string[]): DjDecision {
  const targetIntensity = clamp(room.energy * 0.7 + room.onsetDensity * 0.2 + Math.max(room.energyTrend, 0) * 0.1);
  const targetBpm = 88 + targetIntensity * 52;
  const ranked = candidates
    .map(candidate => ({ candidate, score: score(candidate, targetIntensity, targetBpm, room, history) }))
    .sort((left, right) => right.score - left.score || left.candidate.id.localeCompare(right.candidate.id));
  const winner = ranked[0];
  const profile = winner.candidate.profile;
  return {
    trackId: winner.candidate.id,
    score: winner.score,
    reason: `AI chose ${winner.candidate.title}: measured ${Math.round(profile.bpm)} BPM, ${Math.round(profile.intensity * 100)}% intensity, ${Math.round(profile.rhythmicity * 100)}% rhythmicity for a ${Math.round(targetIntensity * 100)}% room.`,
  };
}

function score(
  candidate: DecisionCandidate,
  targetIntensity: number,
  targetBpm: number,
  room: RoomState,
  history: string[],
): number {
  const profile = candidate.profile;
  const intensityFit = 1 - Math.abs(profile.intensity - targetIntensity);
  const tempoFit = 1 - Math.min(Math.abs(profile.bpm - targetBpm) / 52, 1);
  const rhythmFit = room.onsetDensity > 0.55 ? profile.rhythmicity : 1 - profile.rhythmicity * 0.45;
  const stabilityFit = room.coherence < 0.45 || room.volatility > 0.55 ? 1 - profile.dynamics : profile.dynamics;
  const beatConfidence = profile.bpmConfidence;
  const novelty = history.includes(candidate.id) ? 0 : 1;
  return intensityFit * 0.38 + tempoFit * 0.27 + rhythmFit * 0.16 + stabilityFit * 0.1 + beatConfidence * 0.05 + novelty * 0.04;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
