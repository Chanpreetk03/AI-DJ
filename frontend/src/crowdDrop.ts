import type { CrowdDropArmedEvent, CrowdDropStartedEvent } from "./protocol";

export const crowdDropArmedEventName = "ai-dj:crowd-drop-armed";
export const crowdDropStartedEventName = "ai-dj:crowd-drop-started";

export function countdownSeconds(countdownEndsAtMilliseconds: number, nowMilliseconds = Date.now()): number {
  return Math.max(0, Math.ceil((countdownEndsAtMilliseconds - nowMilliseconds) / 1_000));
}

export function localizeCrowdDropCountdown<T extends { countdownEndsAtMilliseconds: number; countdownDurationMilliseconds: number }>(drop: T, nowMilliseconds = Date.now()): T {
  return { ...drop, countdownEndsAtMilliseconds: nowMilliseconds + drop.countdownDurationMilliseconds };
}

export function announceCrowdDropArmed(drop: CrowdDropArmedEvent): void {
  window.dispatchEvent(new CustomEvent<CrowdDropArmedEvent>(crowdDropArmedEventName, { detail: drop }));
}

export function announceCrowdDropStarted(drop: CrowdDropStartedEvent): void {
  window.dispatchEvent(new CustomEvent<CrowdDropStartedEvent>(crowdDropStartedEventName, { detail: drop }));
}

export function pulseDeviceForCrowdDrop(): void {
  if ("vibrate" in navigator) navigator.vibrate?.([70, 70, 70, 70, 160]);
}

export function impactDeviceForCrowdDrop(): void {
  if ("vibrate" in navigator) navigator.vibrate?.([80, 45, 220]);
}

export function fullDropVibrationPattern(durationMilliseconds = 8_000): number[] {
  const cycle = [110, 90, 110, 490];
  const cycles = Math.max(1, Math.ceil(durationMilliseconds / 800));
  return Array.from({ length: cycles }, () => cycle).flat();
}

export function vibrateThroughCrowdDrop(): void {
  if ("vibrate" in navigator) navigator.vibrate?.(fullDropVibrationPattern());
}
