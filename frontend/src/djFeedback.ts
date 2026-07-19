import type { RoomState } from "./protocol";

const storageKey = "ai-dj-transition-feedback-v1";

export function readFeedback(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function recordFeedback(trackId: string, before: RoomState, after: RoomState): Record<string, number> {
  const previous = readFeedback();
  const response = clamp((after.energy - before.energy) * 0.7 + (after.onsetDensity - before.onsetDensity) * 0.3, -0.1, 0.1);
  const next = { ...previous, [trackId]: clamp((previous[trackId] ?? 0) * 0.75 + response * 0.25, -0.1, 0.1) };
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
