import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    allowedHosts: [".ngrok-free.dev"],
    port: 5173,
    strictPort: true,
    proxy: {
      "/hubs": {
        target: "http://localhost:5000",
        changeOrigin: true,
        ws: true,
      },
      "/health": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        participant: resolve(__dirname, "participant.html"),
        output: resolve(__dirname, "output.html"),
        djUiPrototype: resolve(__dirname, "dj-ui-prototype.html"),
        uiPrototype: resolve(__dirname, "ui-prototype.html"),
        experiencePrototype: resolve(__dirname, "experience-prototype.html"),
        booth: resolve(__dirname, "booth.html"),
        status: resolve(__dirname, "status.html"),
        fallback: resolve(__dirname, "fallback.html")
      }
    }
  }
});
