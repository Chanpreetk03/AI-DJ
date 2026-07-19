import assert from "node:assert/strict";
import { HubConnectionBuilder, HttpTransportType, LogLevel } from "@microsoft/signalr";

const baseUrl = process.env.AI_DJ_TEST_BASE_URL;
if (!baseUrl) throw new Error("AI_DJ_TEST_BASE_URL is required.");

const connection = new HubConnectionBuilder()
  .withUrl(`${baseUrl}/hubs/dj`, { transport: HttpTransportType.LongPolling })
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
  await connection.invoke("Join", "output");
  await connection.invoke("Join", "participant");
  await connection.invoke("SendVibe", { motionEnergy: 1, audioEnergy: 1, onsetDensity: 1, timestampMilliseconds: Date.now() });
  await Promise.race([roomStateReady, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for RoomStateUpdated.")), 5_000))]);
  assert.equal(latestRoomState?.activeClients, 1);
  assert.ok((latestRoomState?.energy ?? 0) > 0.9);
  console.log("PASS SignalR participant-to-room integration");
} finally {
  await connection.stop();
}
