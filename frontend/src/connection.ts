import { HubConnectionBuilder, LogLevel, type HubConnection } from "@microsoft/signalr";

export type CreatedRoom = {
  roomId: string;
  hostToken: string;
};

export function createConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${apiBaseUrl()}/hubs/dj`)
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
}

export function currentRoomId(): string {
  const requestedRoom = new URLSearchParams(window.location.search).get("room")?.trim().toLowerCase();
  return requestedRoom === undefined || requestedRoom === "" ? "demo" : requestedRoom;
}

export async function joinRoom(connection: HubConnection, role: string): Promise<void> {
  const roomId = currentRoomId();
  await connection.invoke("Join", role, roomId, hostTokenForRoom(roomId));
}

export function roomUrl(path: string): string {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("room", currentRoomId());
  return url.toString();
}

export async function createRoom(): Promise<CreatedRoom> {
  const response = await fetch(`${apiBaseUrl()}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  if (!response.ok) {
    throw new Error("Could not create a room.");
  }

  return response.json() as Promise<CreatedRoom>;
}

export function rememberHostToken(roomId: string, token: string): void {
  window.localStorage.setItem(hostTokenKey(roomId), token);
}

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? window.location.origin;
}

function hostTokenForRoom(roomId: string): string | null {
  return window.localStorage.getItem(hostTokenKey(roomId));
}

function hostTokenKey(roomId: string): string {
  return `ai-dj:host-token:${roomId}`;
}
