import { createConnection } from "./connection";
import { DefaultStemPack } from "./audio";
import type { MusicParams, RoomState } from "./protocol";
import "./styles.css";

const status = document.querySelector<HTMLElement>("#status")!;
const energyRing = document.querySelector<HTMLElement>("#energy-ring")!;
const energyValue = document.querySelector<HTMLElement>("#energy-value")!;
const tempo = document.querySelector<HTMLElement>("#tempo")!;
const layers = document.querySelector<HTMLElement>("#layers")!;
const cutoff = document.querySelector<HTMLElement>("#cutoff")!;
const signalHealth = document.querySelector<HTMLElement>("#signal-health")!;
const activeClients = document.querySelector<HTMLElement>("#active-clients")!;
const coherence = document.querySelector<HTMLElement>("#coherence")!;
const motion = document.querySelector<HTMLElement>("#motion")!;
const audioRms = document.querySelector<HTMLElement>("#audio-rms")!;
const onsetRate = document.querySelector<HTMLElement>("#onset-rate")!;
const lastUpdate = document.querySelector<HTMLElement>("#last-update")!;
const startRehearsal = document.querySelector<HTMLButtonElement>("#start-rehearsal")!;
const stopRehearsal = document.querySelector<HTMLButtonElement>("#stop-rehearsal")!;
const rehearsalStatus = document.querySelector<HTMLElement>("#rehearsal-status")!;
const startAudio = document.querySelector<HTMLButtonElement>("#start-audio")!;
const connection = createConnection();
const stemPack = new DefaultStemPack();
let lastVibeAt = 0;
let rehearsalTimer: number | undefined;
let rehearsalStartedAt = 0;

connection.on("MusicParamsUpdated", (params: MusicParams) => {
  tempo.textContent = `${Math.round(params.tempo)} BPM`;
  layers.textContent = `${params.layerCount} / 4`;
  cutoff.textContent = `${Math.round(params.filterCutoff * 100)}%`;
  stemPack.setParameters(params);
});

connection.on("RoomStateUpdated", (state: RoomState) => {
  const energy = Math.round(state.energy * 100);
  energyValue.textContent = `${energy}%`;
  energyRing.style.setProperty("--energy", `${energy}%`);
  activeClients.textContent = `${state.activeClients}`;
  coherence.textContent = `${Math.round(state.coherence * 100)}%`;
});

connection.on("VibeVectorUpdated", (vibe: { motion: number; audioRms: number; onsetRate: number }) => {
  lastVibeAt = Date.now();
  motion.textContent = formatPercent(vibe.motion);
  audioRms.textContent = formatPercent(vibe.audioRms);
  onsetRate.textContent = vibe.onsetRate.toFixed(1);
  lastUpdate.textContent = "Just now";
  setSignalHealth("Live", "is-live");
});

window.setInterval(() => {
  if (lastVibeAt === 0 || Date.now() - lastVibeAt > 2_500) {
    setSignalHealth("No signal", "is-idle");
    if (lastVibeAt !== 0) {
      lastUpdate.textContent = "Stale";
    }
  }
}, 500);

startAudio.addEventListener("click", async () => {
  startAudio.disabled = true;
  startAudio.textContent = "Starting audio…";
  try {
    await stemPack.start();
    startAudio.textContent = "Audio playing";
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Browser blocked playback";
    status.textContent = `Audio could not start: ${message}`;
    startAudio.textContent = "Try audio again";
    startAudio.disabled = false;
  }
});

startRehearsal.addEventListener("click", () => {
  if (connection.state !== "Connected") {
    rehearsalStatus.textContent = "Connect the output tab before starting rehearsal";
    return;
  }

  stopRehearsalSequence();
  rehearsalStartedAt = Date.now();
  startRehearsal.disabled = true;
  stopRehearsal.disabled = false;
  rehearsalStatus.textContent = "Synthetic Booth Device Mode · warming up";
  rehearsalTimer = window.setInterval(sendRehearsalVector, 200);
  sendRehearsalVector();
});

stopRehearsal.addEventListener("click", () => {
  stopRehearsalSequence();
  rehearsalStatus.textContent = "Audience Phone Mode active";
});

connect();

async function connect(): Promise<void> {
  try {
    await connection.start();
    await connection.invoke("Join", "output");
    status.textContent = "Connected — waiting for the room";
  } catch (error) {
    console.error(error);
    status.textContent = "Output server unavailable";
  }
}

function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(value, 1)) * 100)}%`;
}

function setSignalHealth(label: string, className: string): void {
  signalHealth.textContent = label;
  signalHealth.className = `health-badge ${className}`;
}

function sendRehearsalVector(): void {
  const elapsedSeconds = (Date.now() - rehearsalStartedAt) / 1_000;
  const energy = rehearsalEnergy(elapsedSeconds);
  const vibe = {
    motion: energy,
    motionVariance: Math.min(energy * 0.8, 1),
    audioRms: Math.min(energy * 0.9, 1),
    onsetRate: energy * 4,
    timestamp: Date.now()
  };

  void connection.invoke("SendVibe", vibe).catch((error) => {
    console.error(error);
    rehearsalStatus.textContent = "Synthetic rehearsal connection lost";
    stopRehearsalSequence();
  });

  if (elapsedSeconds < 4) {
    rehearsalStatus.textContent = "Synthetic Booth Device Mode · quiet warm-up";
  } else if (elapsedSeconds < 10) {
    rehearsalStatus.textContent = "Synthetic Booth Device Mode · building energy";
  } else if (elapsedSeconds < 15) {
    rehearsalStatus.textContent = "Synthetic Booth Device Mode · peak";
  } else if (elapsedSeconds < 20) {
    rehearsalStatus.textContent = "Synthetic Booth Device Mode · cooling down";
  } else {
    stopRehearsalSequence();
    rehearsalStatus.textContent = "Audience Phone Mode active";
  }
}

function rehearsalEnergy(elapsedSeconds: number): number {
  if (elapsedSeconds < 4) return 0.12;
  if (elapsedSeconds < 10) return 0.12 + ((elapsedSeconds - 4) / 6) * 0.88;
  if (elapsedSeconds < 15) return 1;
  if (elapsedSeconds < 20) return 1 - ((elapsedSeconds - 15) / 5) * 0.88;
  return 0.12;
}

function stopRehearsalSequence(): void {
  if (rehearsalTimer !== undefined) {
    window.clearInterval(rehearsalTimer);
    rehearsalTimer = undefined;
  }
  startRehearsal.disabled = false;
  stopRehearsal.disabled = true;
}
