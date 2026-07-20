import assert from "node:assert/strict";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";

const baseUrl = process.env.AI_DJ_TEST_BASE_URL;
if (!baseUrl) throw new Error("AI_DJ_TEST_BASE_URL is required.");
const roomId = `integration-${Date.now()}`;
const roomResponse = await fetch(`${baseUrl}/api/rooms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId }) });
if (!roomResponse.ok) throw new Error(`Could not create integration room (${roomResponse.status}).`);
const { hostToken } = await roomResponse.json() as { hostToken: string };

const connection = new HubConnectionBuilder()
  .withUrl(`${baseUrl}/hubs/dj`)
  .configureLogging(LogLevel.None)
  .build();

let latestRoomState: { activeClients: number; energy: number } | undefined;
let roomStateReceived: (() => void) | undefined;
const roomStateReady = new Promise<void>(resolve => { roomStateReceived = resolve; });
connection.on("RoomStateUpdated", state => {
  latestRoomState = state;
  if (state.activeClients >= 1 && state.energy > 0.9) roomStateReceived?.();
});

try {
  await connection.start();
  await connection.invoke("Join", "output", roomId, hostToken);
  await connection.invoke("Join", "participant", roomId);
  await connection.invoke("SendVibe", { motion: 1, motionVariance: 1, audioRms: 1, onsetRate: 4, timestamp: Date.now() });
  await Promise.race([roomStateReady, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for RoomStateUpdated.")), 5_000))]);
  assert.equal(latestRoomState?.activeClients, 1);
  assert.ok((latestRoomState?.energy ?? 0) > 0.9);
  console.log("PASS SignalR participant-to-room integration");
} finally {
  await connection.stop();
}
