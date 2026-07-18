import { createConnection } from "./connection";
import type { VibeVector } from "./protocol";
import "./styles.css";

const joinButton = document.querySelector<HTMLButtonElement>("#join-button")!;
const status = document.querySelector<HTMLElement>("#status")!;
const camera = document.querySelector<HTMLVideoElement>("#camera")!;
const motionMeter = document.querySelector<HTMLMeterElement>("#motion-meter")!;
const audioMeter = document.querySelector<HTMLMeterElement>("#audio-meter")!;

let previousFrame: ImageData | undefined;

joinButton.addEventListener("click", async () => {
  joinButton.disabled = true;
  status.textContent = "Requesting camera and microphone…";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    camera.srcObject = stream;
    const connection = createConnection();
    connection.onreconnecting(() => status.textContent = "Reconnecting…");
    connection.onreconnected(() => status.textContent = "Connected — keep moving");
    await connection.start();
    await connection.invoke("Join", "participant");
    status.textContent = "Connected — keep moving";
    startSensorLoop(connection, stream);
  } catch (error) {
    console.error(error);
    status.textContent = "Permission or connection failed. Check HTTPS and try again.";
    joinButton.disabled = false;
  }
});

function startSensorLoop(connection: ReturnType<typeof createConnection>, stream: MediaStream): void {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 48;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  audioContext.createMediaStreamSource(stream).connect(analyser);
  const audioData = new Uint8Array(analyser.fftSize);

  window.setInterval(async () => {
    context.drawImage(camera, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const motion = previousFrame ? frameDifference(previousFrame, frame) : 0;
    previousFrame = frame;
    analyser.getByteTimeDomainData(audioData);
    const audioRms = calculateRms(audioData);
    const vibe: VibeVector = { motion, motionVariance: motion, audioRms, onsetRate: audioRms * 4, timestamp: Date.now() };
    motionMeter.value = motion;
    audioMeter.value = audioRms;
    await connection.invoke("SendVibe", vibe).catch(() => status.textContent = "Connection lost — reconnecting…");
  }, 200);
}

function frameDifference(previous: ImageData, current: ImageData): number {
  let difference = 0;
  for (let index = 0; index < current.data.length; index += 4) {
    difference += Math.abs(current.data[index] - previous.data[index]);
    difference += Math.abs(current.data[index + 1] - previous.data[index + 1]);
    difference += Math.abs(current.data[index + 2] - previous.data[index + 2]);
  }
  return Math.min(difference / (current.width * current.height * 3 * 64), 1);
}

function calculateRms(data: Uint8Array): number {
  const normalized = [...data].map(value => (value - 128) / 128);
  return Math.min(Math.sqrt(normalized.reduce((sum, value) => sum + value * value, 0) / normalized.length) * 2, 1);
}
