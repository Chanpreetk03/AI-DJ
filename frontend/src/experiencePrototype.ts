// PROTOTYPE: three participant-and-host experience concepts, switchable via ?variant=relay|garden|crew.
import "./experiencePrototype.css";

const variants = [
  { key: "relay", label: "Pulse Relay — Shared live signal" },
  { key: "garden", label: "Signal Garden — Collective bloom" },
  { key: "crew", label: "Crowd Crew — Choose a musical role" },
];
const requested = new URLSearchParams(window.location.search).get("variant");
let index = Math.max(0, variants.findIndex(variant => variant.key === requested));
const label = document.querySelector<HTMLElement>("#experience-label")!;
const switcher = document.querySelector<HTMLElement>("#experience-switcher")!;

function render(): void {
  const selected = variants[index];
  document.querySelectorAll<HTMLElement>("[data-variant]").forEach(element => element.hidden = element.dataset.variant !== selected.key);
  label.textContent = selected.label;
  const url = new URL(window.location.href);
  url.searchParams.set("variant", selected.key);
  window.history.replaceState(null, "", url);
}

function move(direction: number): void { index = (index + direction + variants.length) % variants.length; render(); }

switcher.addEventListener("click", event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-direction]");
  if (button !== null) move(button.dataset.direction === "next" ? 1 : -1);
});
window.addEventListener("keydown", event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement).isContentEditable) return;
  if (event.key === "ArrowLeft") move(-1);
  if (event.key === "ArrowRight") move(1);
});
if (!import.meta.env.DEV) switcher.hidden = true;
render();
