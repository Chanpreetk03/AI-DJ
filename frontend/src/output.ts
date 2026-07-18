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
const startAudio = document.querySelector<HTMLButtonElement>("#start-audio")!;
const connection = createConnection();
const stemPack = new DefaultStemPack();

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
});

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
