import { createConnection } from "./connection";
import "./styles.css";

const status = document.querySelector<HTMLElement>("#booth-status")!;
const mode = document.querySelector<HTMLElement>("#booth-mode")!;
const energyInput = document.querySelector<HTMLInputElement>("#booth-energy")!;
const energyValue = document.querySelector<HTMLElement>("#booth-energy-value")!;
const stateButtons = document.querySelectorAll<HTMLButtonElement>(".booth-state");
const leaveButton = document.querySelector<HTMLButtonElement>("#booth-leave")!;
const connection = createConnection();
let energy = Number(energyInput.value);
let sendTimer: number | undefined;

energyInput.addEventListener("input", () => {
  energy = Number(energyInput.value);
  updateEnergyLabel();
  mode.textContent = "Booth Device Mode · manual energy";
  sendVibe();
});

stateButtons.forEach(button => {
  button.addEventListener("click", () => {
    energy = Number(button.dataset.energy ?? 0);
    energyInput.value = `${energy}`;
    updateEnergyLabel();
    mode.textContent = `Booth Device Mode · ${button.textContent}`;
    sendVibe();
  });
});

connection.onreconnecting(() => {
  status.textContent = "Connection interrupted — reconnecting…";
  mode.textContent = "Contribution paused";
});

connection.onreconnected(async () => {
  try {
    await connection.invoke("Join", "booth");
    status.textContent = "Connected as Booth Device";
    mode.textContent = "Booth Device Mode · ready";
  } catch (error) {
    console.error(error);
    status.textContent = "Reconnected, but could not rejoin the room.";
  }
});

connection.onclose(() => {
  stopSending();
  status.textContent = "Disconnected — restart Booth Device Mode to retry.";
  mode.textContent = "Contribution paused";
});

void connect();

async function connect(): Promise<void> {
  try {
    await connection.start();
    await connection.invoke("Join", "booth");
    status.textContent = "Connected as Booth Device";
    mode.textContent = "Booth Device Mode · ready";
    startSending();
    sendVibe();
  } catch (error) {
    console.error(error);
    status.textContent = "Booth controller unavailable";
    mode.textContent = "Start the backend and refresh this page";
  }
}

function startSending(): void {
  if (sendTimer === undefined) {
    sendTimer = window.setInterval(sendVibe, 200);
  }
}

function stopSending(): void {
  if (sendTimer !== undefined) {
    window.clearInterval(sendTimer);
    sendTimer = undefined;
  }
}

leaveButton.addEventListener("click", async () => {
  stopSending();
  if (connection.state === "Connected") {
    await connection.invoke("Leave").catch(error => console.error(error));
  }
  status.textContent = "Booth has left the room";
  mode.textContent = "Contribution paused";
});

function sendVibe(): void {
  if (connection.state !== "Connected") {
    return;
  }

  void connection.invoke("SendVibe", {
    motion: energy ** 2,
    motionVariance: energy ** 2,
    audioRms: energy ** 2,
    onsetRate: energy * 4,
    timestamp: Date.now(),
  }).catch(error => console.error(error));
}

function updateEnergyLabel(): void {
  energyValue.textContent = `${Math.round(energy * 100)}%`;
}

window.addEventListener("pagehide", () => {
  stopSending();
  void connection.stop();
});
