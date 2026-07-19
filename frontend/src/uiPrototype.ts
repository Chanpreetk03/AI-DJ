// PROTOTYPE: three host-console layouts, switchable via ?variant=stage|cockpit|timeline.
import "./uiPrototype.css";

const variants = [
  { key: "stage", label: "Stage — Immersive energy" },
  { key: "cockpit", label: "Cockpit — Operator controls" },
  { key: "timeline", label: "Timeline — Musical story" },
];
const requested = new URLSearchParams(window.location.search).get("variant");
let index = Math.max(0, variants.findIndex(variant => variant.key === requested));
const label = document.querySelector<HTMLElement>("#prototype-label")!;
const switcher = document.querySelector<HTMLElement>("#prototype-switcher")!;

function render(): void {
  const selected = variants[index];
  for (const element of document.querySelectorAll<HTMLElement>("[data-variant]")) {
    element.hidden = element.dataset.variant !== selected.key;
  }
  label.textContent = selected.label;
  const url = new URL(window.location.href);
  url.searchParams.set("variant", selected.key);
  window.history.replaceState(null, "", url);
}

function move(direction: number): void {
  index = (index + direction + variants.length) % variants.length;
  render();
}

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
