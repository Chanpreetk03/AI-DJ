import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "localhost",
    allowedHosts: [".ngrok-free.dev"],
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
    },
  },
});
