import { createConnection, currentRoomId, joinRoom, roomUrl } from "./connection";
import { RealMusicDecks } from "./realMusic";
import { renderInviteQr } from "./inviteQr";
import type { MusicParams, RoomState } from "./protocol";
import "./navigation";
import "./styles.css";

const status = document.querySelector<HTMLElement>("#status")!;
const speaker = document.querySelector<HTMLElement>("#speaker")!;
const speakerStage = document.querySelector<HTMLElement>(".speaker-stage")!;
const energyValue = document.querySelector<HTMLElement>("#energy-value")!;
const tempo = document.querySelector<HTMLElement>("#tempo")!;
const layers = document.querySelector<HTMLElement>("#layers")!;
const participantCount = document.querySelector<HTMLElement>("#participant-count")!;
const startAudio = document.querySelector<HTMLButtonElement>("#start-audio")!;
const inviteButton = document.querySelector<HTMLButtonElement>("#invite-button")!;
const inviteModal = document.querySelector<HTMLElement>("#invite-modal")!;
const closeInvite = document.querySelector<HTMLButtonElement>("#close-invite")!;
const inviteQr = document.querySelector<HTMLCanvasElement>("#invite-qr")!;
const inviteUrl = document.querySelector<HTMLElement>("#invite-url")!;
const copyInvite = document.querySelector<HTMLButtonElement>("#copy-invite")!;
const connection = createConnection();
const djDecision = document.querySelector<HTMLElement>("#dj-decision")!;
const djIntent = document.querySelector<HTMLElement>("#dj-intent")!;
const holdDirection = document.querySelector<HTMLButtonElement>("#hold-direction")!;
const endSession = document.querySelector<HTMLButtonElement>("#end-session")!;
let directionHeld = false;
const stemPack = new RealMusicDecks(
  () => undefined,
  message => djDecision.textContent = message,
  message => {
    djDecision.textContent = message;
    startAudio.textContent = "Analyzing music…";
  },
  message => djIntent.textContent = message,
);
const participantUrl = roomUrl("/participant.html");
let targetEnergy = 0;
let displayedEnergy = 0;
let isStartingAudio = false;
let outputJoined = false;

connection.on("MusicParamsUpdated", (params: MusicParams) => {
  tempo.textContent = `${Math.round(params.tempo)} BPM`;
  layers.textContent = `${params.layerCount} / 4`;
  stemPack.setParameters(params);
});

connection.on("RoomStateUpdated", (state: RoomState) => {
  participantCount.textContent = `${state.activeClients}`;
  targetEnergy = state.energy;
  stemPack.setRoomState(state);
});

connection.on("RoomClosed", () => {
  stemPack.stop();
  targetEnergy = 0;
  participantCount.textContent = "0";
  status.textContent = "Session ended. Returning home…";
  startAudio.disabled = true;
  holdDirection.disabled = true;
  endSession.disabled = true;
  window.setTimeout(() => window.location.assign("/"), 1_000);
});

connection.onreconnecting(() => {
  outputJoined = false;
  endSession.disabled = true;
  status.textContent = "Output connection interrupted — reconnecting…";
});

connection.onreconnected(async () => {
  try {
    await joinRoom(connection, "output");
    outputJoined = true;
    endSession.disabled = false;
    status.textContent = "Reconnected to the active room";
  } catch (error) {
    console.error(error);
    status.textContent = `Reconnected, but could not rejoin room ${currentRoomId()}.`;
  }
});

function animateSpeaker(): void {
  displayedEnergy += (targetEnergy - displayedEnergy) * 0.08;
  const energyPercent = Math.round(displayedEnergy * 100);
  speakerStage.style.setProperty("--room-energy", `${displayedEnergy}`);
  speakerStage.style.setProperty("--pulse-duration", `${Math.max(0.35, 1.2 - displayedEnergy * 0.8)}s`);
  speaker.style.setProperty("--room-energy", `${displayedEnergy}`);
  speaker.style.setProperty("--pulse-duration", `${Math.max(0.35, 1.2 - displayedEnergy * 0.8)}s`);
  energyValue.textContent = `${energyPercent}%`;
  window.requestAnimationFrame(animateSpeaker);
}

animateSpeaker();

speakerStage.addEventListener("pointermove", event => {
  const bounds = speakerStage.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
  const y = (event.clientY - bounds.top) / bounds.height - 0.5;
  speakerStage.style.setProperty("--pointer-x", `${x * 12}px`);
  speakerStage.style.setProperty("--pointer-y", `${y * 8}px`);
});

speakerStage.addEventListener("pointerleave", () => {
  speakerStage.style.setProperty("--pointer-x", "0px");
  speakerStage.style.setProperty("--pointer-y", "0px");
});

inviteButton.addEventListener("click", async () => {
  inviteModal.hidden = false;
  inviteUrl.textContent = participantUrl;
  await renderInviteQr(inviteQr, participantUrl);
  closeInvite.focus();
});

closeInvite.addEventListener("click", () => {
  inviteModal.hidden = true;
  inviteButton.focus();
});

inviteModal.addEventListener("click", event => {
  if (event.target === inviteModal) {
    inviteModal.hidden = true;
    inviteButton.focus();
  }
});

copyInvite.addEventListener("click", async () => {
  await navigator.clipboard.writeText(participantUrl);
  copyInvite.textContent = "Invite copied";
  window.setTimeout(() => copyInvite.textContent = "Copy invite link", 1600);
});

async function startAudioOutput(): Promise<void> {
  if (isStartingAudio || startAudio.disabled) {
    return;
  }
  isStartingAudio = true;
  startAudio.disabled = true;
  startAudio.textContent = "Starting audio…";
  let timeoutId: number | undefined;
  try {
    await Promise.race([
      stemPack.start(),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("Music analysis timed out. Refresh this tab and try again.")), 180_000);
      }),
    ]);
    startAudio.textContent = "Audio playing";
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Browser blocked playback";
    status.textContent = `Audio could not start: ${message}`;
    startAudio.textContent = "Try audio again";
    startAudio.disabled = false;
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    isStartingAudio = false;
  }
}

startAudio.addEventListener("pointerup", () => void startAudioOutput());
startAudio.addEventListener("click", () => void startAudioOutput());

holdDirection.addEventListener("click", () => {
  directionHeld = !directionHeld;
  stemPack.setHoldSelection(directionHeld);
  holdDirection.textContent = directionHeld ? "Resume AI direction" : "Hold current direction";
});

endSession.addEventListener("click", async () => {
  if (!outputJoined) {
    status.textContent = "Waiting for the output console to join the room…";
    return;
  }
  if (!window.confirm("End this room for every participant?")) {
    return;
  }

  endSession.disabled = true;
  status.textContent = "Ending session…";
  try {
    await connection.invoke("EndRoom");
  } catch (error) {
    console.error(error);
    status.textContent = "Could not end the session. Check the output connection.";
    endSession.disabled = false;
  }
});

connect();

async function connect(): Promise<void> {
  try {
    await connection.start();
    await joinRoom(connection, "output");
    outputJoined = true;
    endSession.disabled = false;
    status.textContent = "Connected - waiting for the room";
  } catch (error) {
    console.error(error);
    status.textContent = "Output server unavailable";
  }
}
