import { createConnection, joinRoom } from "./connection";
import type { VibeVector } from "./protocol";
import { combineMotionSignals, FrameDifferenceSensor, MicrophoneFeatureSensor, PhoneMotionSensor } from "./sensing";
import "./navigation";
import "./styles.css";

const joinButton = document.querySelector<HTMLButtonElement>("#join-button")!;
const leaveButton = document.querySelector<HTMLButtonElement>("#leave-button")!;
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

type ParticipantConnection = ReturnType<typeof createConnection>;
type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

let participantConnection: ParticipantConnection | undefined;
let participantStream: MediaStream | undefined;
let sensorTimer: number | undefined;
let participantAudioContext: AudioContext | undefined;
let phoneMotionSensor: PhoneMotionSensor | undefined;
let wakeLock: WakeLockSentinelLike | undefined;
let isPageVisible = document.visibilityState === "visible";

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
    phoneMotionSensor = new PhoneMotionSensor();
    await phoneMotionSensor.start();
    const stream = await requestMediaStream();
    participantStream = stream;
    camera.srcObject = stream;
    await camera.play();

    const connection = createConnection();
    participantConnection = connection;
    connection.onreconnecting(() => {
      status.textContent = "Connection interrupted — reconnecting…";
      contribution.textContent = "Paused until the room connection returns";
    });
    connection.onreconnected(async () => {
      try {
        await joinRoom(connection, "participant");
        status.textContent = `Connected as ${participantName}`;
        contribution.textContent = "Contributing local motion and sound features";
        void requestWakeLock();
      } catch (error) {
        console.error(error);
        status.textContent = "Reconnected, but could not rejoin the room.";
        contribution.textContent = "Contribution paused — retrying connection";
      }
    });
    connection.onclose(() => {
      status.textContent = "Disconnected. Check your network and try again.";
      contribution.textContent = "Contribution paused";
      setJoinedUi(false);
    });

    await connection.start();
    await joinRoom(connection, "participant");
    status.textContent = `Connected as ${participantName}`;
    contribution.textContent = "Contributing local motion and sound features";
    await requestWakeLock();
    startSensorLoop(connection, stream);
    setJoinedUi(true);
  } catch (error) {
    console.error(error);
    cleanupSession();
    status.textContent = describeJoinError(error);
    joinButton.disabled = false;
    nameInput.disabled = false;
    setJoinedUi(false);
  }
});

leaveButton.addEventListener("click", async () => {
  leaveButton.disabled = true;
  status.textContent = "Leaving the room…";
  try {
    if (participantConnection?.state === "Connected") {
      await participantConnection.invoke("Leave");
    }
  } catch (error) {
    console.error(error);
  } finally {
    cleanupSession();
    status.textContent = "You left the room.";
    contribution.textContent = "Camera and microphone are stopped";
    setJoinedUi(false);
    leaveButton.disabled = false;
  }
});

async function requestMediaStream(): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new Error("Open the HTTPS tunnel URL, not a local HTTP URL.");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not provide camera and microphone access.");
  }

  const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
  try {
    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
  } catch (error) {
    videoStream.getTracks().forEach(track => track.stop());
    throw error;
  }
}

function describeJoinError(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Permission denied. Allow camera and microphone for this HTTPS site, then retry.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No camera or microphone was found on this phone.";
  }
  if (error instanceof Error) {
    return `Could not join: ${error.message}`;
  }
  return "Could not join. Check camera, microphone, and HTTPS permissions.";
}

function startSensorLoop(connection: ParticipantConnection, stream: MediaStream): void {
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

  participantAudioContext = new AudioContextConstructor();
  const analyser = participantAudioContext.createAnalyser();
  analyser.fftSize = 256;
  participantAudioContext.createMediaStreamSource(stream).connect(analyser);
  void participantAudioContext.resume();
  const audioData = new Uint8Array(analyser.fftSize);
  const cameraSensor = new FrameDifferenceSensor();
  const microphoneSensor = new MicrophoneFeatureSensor();
  let isSending = false;

  sensorTimer = window.setInterval(async () => {
    if (!isPageVisible || connection.state !== "Connected" || isSending || camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }
    isSending = true;
    try {
      const cameraFeatures = cameraSensor.sample(camera, context, canvas.width, canvas.height);
      analyser.getByteTimeDomainData(audioData);
      const microphoneFeatures = microphoneSensor.sample(audioData, Date.now());
      const motion = combineMotionSignals(cameraFeatures.motion, phoneMotionSensor?.sample() ?? 0);
      const energy = Math.min((motion + microphoneFeatures.audioRms) / 2, 1);
      const vibe: VibeVector = {
        ...cameraFeatures,
        ...microphoneFeatures,
        motion,
        timestamp: Date.now(),
      };
      motionMeter.value = motion;
      audioMeter.value = microphoneFeatures.audioRms;
      energyRing.style.setProperty("--participant-energy", `${energy}`);
      await connection.invoke("SendVibe", vibe);
    } catch (error) {
      console.error(error);
      if (connection.state !== "Connected") {
        status.textContent = "Connection interrupted — reconnecting…";
        contribution.textContent = "Paused until the room connection returns";
      }
    } finally {
      isSending = false;
    }
  }, 200);
}

document.addEventListener("visibilitychange", () => {
  isPageVisible = document.visibilityState === "visible";
  if (isPageVisible) {
    void requestWakeLock();
    if (participantConnection?.state === "Connected") {
      contribution.textContent = "Contributing local motion and sound features";
    }
  } else {
    void releaseWakeLock();
    contribution.textContent = "Paused while this page is in the background";
  }
});

window.addEventListener("pagehide", cleanupSession);
window.addEventListener("beforeunload", cleanupSession);

async function requestWakeLock(): Promise<void> {
  if (!isPageVisible || wakeLock !== undefined) {
    return;
  }

  const wakeLockNavigator = navigator as WakeLockNavigator;
  if (wakeLockNavigator.wakeLock === undefined) {
    return;
  }

  try {
    wakeLock = await wakeLockNavigator.wakeLock.request("screen");
  } catch {
    // Wake Lock is an enhancement; sensing and reconnect still work without it.
  }
}

async function releaseWakeLock(): Promise<void> {
  const currentWakeLock = wakeLock;
  wakeLock = undefined;
  if (currentWakeLock !== undefined) {
    await currentWakeLock.release().catch(() => undefined);
  }
}

function cleanupSession(): void {
  if (sensorTimer !== undefined) {
    window.clearInterval(sensorTimer);
    sensorTimer = undefined;
  }
  participantStream?.getTracks().forEach(track => track.stop());
  participantStream = undefined;
  phoneMotionSensor?.stop();
  phoneMotionSensor = undefined;
  camera.srcObject = null;
  if (participantAudioContext !== undefined) {
    void participantAudioContext.close().catch(() => undefined);
    participantAudioContext = undefined;
  }
  void releaseWakeLock();
  if (participantConnection !== undefined) {
    void participantConnection.stop();
    participantConnection = undefined;
  }
}

function setJoinedUi(isJoined: boolean): void {
  joinButton.hidden = isJoined;
  leaveButton.hidden = !isJoined;
  nameInput.disabled = isJoined;
}

function applyParticipantPalette(): void {
  const selectedPalette = palette[Math.floor(Math.random() * palette.length)];
  document.documentElement.style.setProperty("--participant-accent", selectedPalette.accent);
  document.documentElement.style.setProperty("--participant-secondary", selectedPalette.secondary);
  document.documentElement.style.setProperty("--participant-glow", selectedPalette.glow);
}
