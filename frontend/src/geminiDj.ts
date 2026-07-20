import { apiBaseUrl, currentRoomHostToken } from "./connection";

export type DjPreferences = {
  provider: "spotify" | "youtube-music";
  language: string;
  remixPreference: "avoid" | "allow" | "prefer";
  brief: string;
  allowExplicit: boolean;
  excludedSongIdentities: string[];
};

export type DjSongIdentity = {
  title: string;
  artist: string;
  version: string | null;
  startAtSeconds: number | null;
};

export type DjDirective = {
  vibe: string;
  reason: string;
  searchQueries: string[];
  candidates: DjSongIdentity[];
};

export class DjDirectiveRequestError extends Error {
  public constructor(message: string, public readonly retryAfterMilliseconds: number | undefined) {
    super(message);
    this.name = "DjDirectiveRequestError";
  }
}

export async function requestDjDirective(preferences: DjPreferences): Promise<DjDirective> {
  const roomId = new URLSearchParams(window.location.search).get("room")?.trim().toLowerCase() || "demo";
  const response = await fetch(`${apiBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}/dj-direction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(currentRoomHostToken() === null ? {} : { "X-Room-Host-Token": currentRoomHostToken()! }),
    },
    body: JSON.stringify({ preferences }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { detail?: string; message?: string } | undefined;
    throw new DjDirectiveRequestError(
      body?.detail ?? body?.message ?? `Gemini DJ request failed (${response.status}).`,
      retryAfterMilliseconds(response.headers.get("Retry-After")),
    );
  }
  return await response.json() as DjDirective;
}

function retryAfterMilliseconds(value: string | null): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
