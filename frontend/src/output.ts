import { createConnection } from "./connection";
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

connection.on("MusicParamsUpdated", (params: MusicParams) => {
  tempo.textContent = `${Math.round(params.tempo)} BPM`;
  layers.textContent = `${params.layerCount} / 4`;
  cutoff.textContent = `${Math.round(params.filterCutoff * 100)}%`;
});

connection.on("RoomStateUpdated", (state: RoomState) => {
  const energy = Math.round(state.energy * 100);
  energyValue.textContent = `${energy}%`;
  energyRing.style.setProperty("--energy", `${energy}%`);
});

startAudio.addEventListener("click", () => {
  startAudio.textContent = "Audio ready";
  startAudio.disabled = true;
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
