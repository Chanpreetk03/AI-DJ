import { createConnection, joinRoom } from "./connection";
import type { DemoStatus } from "./protocol";
import "./navigation";
import "./styles.css";

const status = document.querySelector<HTMLElement>("#status")!;
const connectedClients = document.querySelector<HTMLElement>("#connected-clients")!;
const participantClients = document.querySelector<HTMLElement>("#participant-clients")!;
const outputConnected = document.querySelector<HTMLElement>("#output-connected")!;
const roomEnergy = document.querySelector<HTMLElement>("#room-energy")!;
const latestInput = document.querySelector<HTMLElement>("#latest-input")!;
const latestValues = document.querySelector<HTMLElement>("#latest-values")!;
const musicParams = document.querySelector<HTMLElement>("#music-params")!;
const connection = createConnection();

connection.on("StatusUpdated", renderStatus);

connect();

async function connect(): Promise<void> {
  try {
    await connection.start();
    await joinRoom(connection, "status");
    status.textContent = "Connected — monitoring the room";
  } catch (error) {
    console.error(error);
    status.textContent = "Server unavailable";
  }
}

function renderStatus(snapshot: DemoStatus): void {
  connectedClients.textContent = String(snapshot.connectedClients);
  participantClients.textContent = String(snapshot.participantClients);
  outputConnected.textContent = snapshot.outputConnected ? "Online" : "Offline";
  outputConnected.className = snapshot.outputConnected ? "good" : "bad";
  roomEnergy.textContent = `${Math.round(snapshot.roomState.energy * 100)}%`;
  const latestAge = snapshot.latestVibeAgeMilliseconds ?? 0;
  latestInput.textContent = snapshot.latestSource
    ? `${snapshot.latestSource} input${latestAge > 2_000 ? " · STALE" : ""}`
    : "No vibe received";
  latestInput.className = latestAge > 2_000 ? "bad" : "good";
  latestValues.textContent = snapshot.latestVibe
    ? `Motion ${snapshot.latestVibe.motion.toFixed(2)} · Sound ${snapshot.latestVibe.audioRms.toFixed(2)} · Onsets ${snapshot.latestVibe.onsetRate.toFixed(1)} · ${Math.round(snapshot.latestVibeAgeMilliseconds ?? 0)}ms ago`
    : "Waiting for a participant, booth, or synthetic source.";
  musicParams.textContent = `Tempo ${Math.round(snapshot.musicParams.tempo)} BPM · Cutoff ${Math.round(snapshot.musicParams.filterCutoff * 100)}% · Density ${Math.round(snapshot.musicParams.noteDensity * 100)}% · Layers ${snapshot.musicParams.layerCount}/4`;
}
