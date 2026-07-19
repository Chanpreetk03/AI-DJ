import { currentRoomId } from "./connection";

const roomId = currentRoomId();
for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')) {
  const url = new URL(link.href, window.location.origin);
  if (url.pathname !== "/") {
    url.searchParams.set("room", roomId);
    link.href = url.toString();
  }
}
