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
const startAudio = document.querySelector<HTMLButtonElement>("#start-audio")!;
const connection = createConnection();
const stemPack = new DefaultStemPack();
let lastVibeAt = 0;

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
