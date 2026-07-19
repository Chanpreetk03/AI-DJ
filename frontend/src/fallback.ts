import { createConnection } from "./connection";
import type { VibeVector } from "./protocol";
import "./styles.css";

const sequenceButton = document.querySelector<HTMLButtonElement>("#sequence-button")!;
const boothButton = document.querySelector<HTMLButtonElement>("#booth-button")!;
const boothControls = document.querySelector<HTMLElement>("#booth-controls")!;
const boothMotion = document.querySelector<HTMLInputElement>("#booth-motion")!;
const boothAudio = document.querySelector<HTMLInputElement>("#booth-audio")!;
const status = document.querySelector<HTMLElement>("#status")!;
const sourceLabel = document.querySelector<HTMLElement>("#source-label")!;
const connection = createConnection();
let boothTimer: number | undefined;

connect();
sequenceButton.addEventListener("click", runSequence);
boothButton.addEventListener("click", () => void toggleBooth());

async function connect(): Promise<void> {
  try {
    await connection.start();
    await connection.invoke("Join", "synthetic");
    status.textContent = "Connected — fallback controls ready";
  } catch (error) {
    console.error(error);
    status.textContent = "Server unavailable";
  }
}

async function runSequence(): Promise<void> {
  sequenceButton.disabled = true;
  sourceLabel.textContent = "Synthetic Mode active: quiet → peak → cooldown";
  const stages = [
    ...Array.from({ length: 15 }, (_, index) => 0.1 + index * 0.04),
    ...Array.from({ length: 20 }, () => 0.8),
    ...Array.from({ length: 20 }, (_, index) => 0.8 - index * 0.04)
  ];
  for (const energy of stages) {
    await sendVibe("synthetic", energy, energy * 0.9);
    await delay(200);
  }
  sequenceButton.disabled = false;
  sourceLabel.textContent = "Synthetic sequence complete.";
}

async function toggleBooth(): Promise<void> {
  if (boothTimer !== undefined) {
    window.clearInterval(boothTimer);
    boothTimer = undefined;
    await connection.invoke("Join", "synthetic");
    boothControls.classList.add("hidden");
    boothButton.textContent = "Start booth controls";
    sourceLabel.textContent = "Booth Device Mode stopped.";
    return;
  }

  await connection.invoke("Join", "booth");
  boothControls.classList.remove("hidden");
  boothButton.textContent = "Stop booth controls";
  sourceLabel.textContent = "Booth Device Mode active — use the sliders to rescue the demo.";
  boothTimer = window.setInterval(() => sendVibe("booth", Number(boothMotion.value), Number(boothAudio.value)), 200);
}

async function sendVibe(source: string, motion: number, audioRms: number): Promise<void> {
  const calibratedMotion = motion ** 2;
  const calibratedAudio = audioRms ** 2;
  const vibe: VibeVector = {
    motion: calibratedMotion,
    motionVariance: calibratedMotion,
    audioRms: calibratedAudio,
    onsetRate: audioRms * 4,
    timestamp: Date.now(),
  };
  await connection.invoke("SendVibe", vibe).catch(() => status.textContent = `${source} connection lost`);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}
