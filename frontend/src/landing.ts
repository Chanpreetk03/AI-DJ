import { createRoom, rememberHostToken } from "./connection";
import "./navigation";
import "./styles.css";

const createRoomButton = document.querySelector<HTMLButtonElement>("#create-room")!;
const status = document.querySelector<HTMLElement>("#landing-status")!;

createRoomButton.addEventListener("click", async () => {
  createRoomButton.disabled = true;
  createRoomButton.textContent = "Creating your room…";
  status.textContent = "";

  try {
    const room = await createRoom();
    rememberHostToken(room.roomId, room.hostToken);
    const outputUrl = new URL("/output.html", window.location.origin);
    outputUrl.searchParams.set("room", room.roomId);
    window.location.assign(outputUrl);
  } catch (error) {
    console.error(error);
    createRoomButton.disabled = false;
    createRoomButton.innerHTML = "Start a room <span aria-hidden=\"true\">↗</span>";
    status.textContent = "Could not create the room. Check that the server is running and try again.";
  }
});
