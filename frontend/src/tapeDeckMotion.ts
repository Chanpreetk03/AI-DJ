import { animate } from "motion/mini";

export function mountTapeDeckMotion(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  document.querySelectorAll<HTMLElement>("main > *").forEach(element => element.classList.add("tape-motion-item"));
  animate(".tape-motion-item", { opacity: [0, 1], transform: ["translateY(20px)", "translateY(0px)"] }, { duration: 0.55, ease: "easeOut" });
  animate(".button", { opacity: [0.75, 1] }, { duration: 0.35, ease: "easeOut" });
}
