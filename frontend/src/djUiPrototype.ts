// PROTOTYPE: three AI-DJ control surfaces, switchable via ?variant=pulse|constellation|tape.
import "./djUiPrototype.css";

declare const lucide: { createIcons(): void } | undefined;
declare const gsap: { to(targets: string, vars: Record<string, unknown>): void } | undefined;

const variants = [
  { key: "pulse", label: "01 — Pulse Stage" },
  { key: "constellation", label: "02 — Signal Constellation" },
  { key: "tape", label: "03 — Tape Deck" },
];
let activeIndex = Math.max(0, variants.findIndex(variant => variant.key === new URLSearchParams(window.location.search).get("variant")));
const label = document.querySelector<HTMLElement>("#dj-prototype-label")!;

function render(): void {
  const active = variants[activeIndex];
  document.querySelectorAll<HTMLElement>("[data-variant]").forEach(element => element.hidden = element.dataset.variant !== active.key);
  label.textContent = active.label;
  const url = new URL(window.location.href);
  url.searchParams.set("variant", active.key);
  window.history.replaceState(null, "", url);
  lucide?.createIcons();
  if (active.key === "pulse") gsap?.to(".energy-orbit i", { rotation: "+=180", duration: 4, repeat: -1, ease: "none" });
}

function shift(direction: number): void { activeIndex = (activeIndex + direction + variants.length) % variants.length; render(); }

function setEnergy(value: number): void {
  const text = `${value}%`;
  document.querySelector<HTMLElement>("#pulse-energy")!.textContent = text;
  document.querySelector<HTMLElement>("#map-energy")!.textContent = `${value}`;
  document.querySelector<HTMLOutputElement>("#tape-energy")!.value = text;
  document.documentElement.style.setProperty("--prototype-energy", `${value / 100}`);
}

document.querySelector<HTMLElement>("#dj-prototype-switcher")!.addEventListener("click", event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-direction]");
  if (button !== null) shift(button.dataset.direction === "next" ? 1 : -1);
});
document.addEventListener("click", event => {
  const action = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-energy]");
  if (action !== null) setEnergy(action.dataset.energy === "peak" ? 96 : 84);
});
document.querySelector<HTMLInputElement>("#energy-control")!.addEventListener("input", event => setEnergy(Number((event.target as HTMLInputElement).value)));
window.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft") shift(-1);
  if (event.key === "ArrowRight") shift(1);
});
if (!import.meta.env.DEV) document.querySelector<HTMLElement>("#dj-prototype-switcher")!.hidden = true;
setEnergy(78);
render();
