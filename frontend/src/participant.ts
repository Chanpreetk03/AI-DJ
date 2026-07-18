import { createConnection } from "./connection";
import type { VibeVector } from "./protocol";
import { FrameDifferenceSensor, MicrophoneFeatureSensor } from "./sensing";
import "./styles.css";

const joinButton = document.querySelector<HTMLButtonElement>("#join-button")!;
const nameInput = document.querySelector<HTMLInputElement>("#participant-name")!;
const status = document.querySelector<HTMLElement>("#status")!;
const contribution = document.querySelector<HTMLElement>("#contribution")!;
const camera = document.querySelector<HTMLVideoElement>("#camera")!;
const motionMeter = document.querySelector<HTMLMeterElement>("#motion-meter")!;
const audioMeter = document.querySelector<HTMLMeterElement>("#audio-meter")!;
const energyRing = document.querySelector<HTMLElement>("#participant-energy")!;
const palette = [
  { accent: "#f2a7d6", secondary: "#7b61ff", glow: "#f2a7d644" },
  { accent: "#69e7ff", secondary: "#5065ff", glow: "#69e7ff44" },
  { accent: "#b9f25b", secondary: "#ff9b54", glow: "#b9f25b44" },
  { accent: "#ff8ec7", secondary: "#ff5c7a", glow: "#ff8ec744" },
];

applyParticipantPalette();

joinButton.addEventListener("click", async () => {
  const participantName = nameInput.value.trim();
  if (participantName.length < 2) {
    status.textContent = "Add your name so the room knows you are here.";
    nameInput.focus();
    return;
  }

  joinButton.disabled = true;
  nameInput.disabled = true;
  status.textContent = "Requesting camera and microphone…";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    camera.srcObject = stream;
    await camera.play();
    const connection = createConnection();
    connection.onreconnecting(() => status.textContent = "Reconnecting…");
    connection.onreconnected(() => status.textContent = `Connected as ${participantName}`);
    connection.onclose(() => status.textContent = "Connection closed. Try joining again.");
    await connection.start();
    await connection.invoke("Join", "participant");
    status.textContent = `Connected as ${participantName}`;
    contribution.textContent = "Contributing local motion and sound features";
    startSensorLoop(connection, stream);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "permission or connection error";
    status.textContent = `Could not join: ${message}`;
    joinButton.disabled = false;
    nameInput.disabled = false;
  }
});

function startSensorLoop(connection: ReturnType<typeof createConnection>, stream: MediaStream): void {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 48;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  const AudioContextConstructor = window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AudioContextConstructor === undefined) {
    status.textContent = "Camera connected, but this browser has no Web Audio support.";
    return;
  }

  const audioContext = new AudioContextConstructor();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  audioContext.createMediaStreamSource(stream).connect(analyser);
  void audioContext.resume();
  const audioData = new Uint8Array(analyser.fftSize);
  const cameraSensor = new FrameDifferenceSensor();
  const microphoneSensor = new MicrophoneFeatureSensor();
  let isSending = false;

  window.setInterval(async () => {
    if (isSending || camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }
    isSending = true;
    try {
      const cameraFeatures = cameraSensor.sample(camera, context, canvas.width, canvas.height);
      analyser.getByteTimeDomainData(audioData);
      const microphoneFeatures = microphoneSensor.sample(audioData, Date.now());
      const energy = Math.min((cameraFeatures.motion + microphoneFeatures.audioRms) / 2, 1);
      const vibe: VibeVector = {
        ...cameraFeatures,
        ...microphoneFeatures,
        timestamp: Date.now(),
      };
      motionMeter.value = cameraFeatures.motion;
      audioMeter.value = microphoneFeatures.audioRms;
      energyRing.style.setProperty("--participant-energy", `${energy}`);
      await connection.invoke("SendVibe", vibe);
    } catch (error) {
      console.error(error);
      status.textContent = "Connection lost — reconnecting…";
    } finally {
      isSending = false;
    }
  }, 200);
}

function applyParticipantPalette(): void {
  const selectedPalette = palette[Math.floor(Math.random() * palette.length)];
  document.documentElement.style.setProperty("--participant-accent", selectedPalette.accent);
  document.documentElement.style.setProperty("--participant-secondary", selectedPalette.secondary);
  document.documentElement.style.setProperty("--participant-glow", selectedPalette.glow);
}
