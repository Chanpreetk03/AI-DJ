import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AppPage, resolvePage } from "./pages";
import "../styles.css";

const controllerLoaders = {
  landing: () => import("../landing"),
  output: () => import("../output"),
  participant: () => import("../participant"),
  booth: () => import("../booth"),
  fallback: () => import("../fallback"),
  status: () => import("../status"),
} as const;

function ControllerBridge({ page }: { page: keyof typeof controllerLoaders }): null {
  useEffect(() => {
    void controllerLoaders[page]().catch(error => {
      console.error(`Could not start the ${page} controller.`, error);
    });
  }, [page]);

  return null;
}

const page = resolvePage(window.location.pathname);
const root = document.querySelector<HTMLElement>("#root");

if (root === null) {
  throw new Error("AI-DJ could not find the React root.");
}

createRoot(root).render(
  <StrictMode>
    <AppPage page={page} />
    <ControllerBridge page={page} />
  </StrictMode>,
);
