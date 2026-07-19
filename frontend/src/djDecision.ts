import type { CrowdIntent } from "./djIntent";
import type { MusicSection, MeasuredTrackProfile } from "./musicAnalysis";

export type DecisionCandidate = {
  id: string;
  title: string;
  key?: string;
  profile: MeasuredTrackProfile;
};

export type DjDecision = {
  trackId: string;
  sectionId?: string;
  reason: string;
  score: number;
};

export function decideTrack(
  intent: CrowdIntent,
  candidates: DecisionCandidate[],
  history: string[],
  currentTrackId?: string,
  currentKey?: string,
  currentBpm?: number,
  feedback: Record<string, number> = {},
  preferDifferentTrack = false,
): DjDecision {
  const freshCandidates = preferDifferentTrack && currentTrackId !== undefined
    ? candidates.filter(candidate => candidate.id !== currentTrackId)
    : candidates;
  const ranked = (freshCandidates.length > 0 ? freshCandidates : candidates).flatMap(candidate => compatibleSections(candidate, intent, currentKey, currentBpm).map(section => ({
    candidate,
    section,
    score: score(candidate, section, intent, history, currentTrackId, feedback[candidate.id] ?? 0),
  }))).sort((left, right) => right.score - left.score || left.candidate.id.localeCompare(right.candidate.id));
  const winner = ranked[0];
  if (winner === undefined) {
    throw new Error("No compatible music sections are available.");
  }
  return {
    trackId: winner.candidate.id,
    sectionId: winner.section.id,
    score: winner.score,
    reason: `AI chose ${winner.candidate.title}, ${winner.section.id}: ${Math.round(winner.section.intensity * 100)}% measured phrase intensity for ${intent.label} intent.`,
  };
}

function compatibleSections(candidate: DecisionCandidate, intent: CrowdIntent, currentKey?: string, currentBpm?: number): MusicSection[] {
  if (currentKey !== undefined && candidate.key !== undefined && !keysAreCompatible(currentKey, candidate.key)) {
    return [];
  }
  if (currentBpm !== undefined && Math.abs(candidate.profile.bpm / currentBpm - 1) > 0.08) {
    return [];
  }
  return candidate.profile.sections.filter(section => section.safeTransition && section.endSeconds - section.startSeconds >= 4);
}

function score(
  candidate: DecisionCandidate,
  section: MusicSection,
  intent: CrowdIntent,
  history: string[],
  currentTrackId: string | undefined,
  feedback: number,
): number {
  const profile = candidate.profile;
  const intensityFit = 1 - Math.abs(section.intensity - intent.intensity);
  const targetBpm = 86 + intent.intensity * 54 + Math.max(intent.trend, 0) * 4;
  const tempoFit = 1 - Math.min(Math.abs(profile.bpm - targetBpm) / 42, 1);
  const rhythmFit = 1 - Math.abs(profile.rhythmicity - intent.rhythmicDemand);
  const stabilityFit = intent.stability < 0.5 ? 1 - profile.dynamics : profile.dynamics;
  const novelty = history.includes(candidate.id) ? 0 : 1;
  const stayBonus = candidate.id === currentTrackId ? 0.08 : 0;
  return intensityFit * 0.31 + tempoFit * 0.22 + rhythmFit * 0.16 + stabilityFit * 0.1 +
    profile.bpmConfidence * 0.06 + novelty * 0.06 + stayBonus + Math.max(-0.1, Math.min(0.1, feedback));
}

function keysAreCompatible(firstKey: string, secondKey: string): boolean {
  const first = firstKey.split(" ")[0]?.toLowerCase();
  const second = secondKey.split(" ")[0]?.toLowerCase();
  return first === second || first === undefined || second === undefined;
}
