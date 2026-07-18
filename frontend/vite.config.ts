import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        participant: resolve(__dirname, "participant.html"),
        output: resolve(__dirname, "output.html"),
        status: resolve(__dirname, "status.html"),
        fallback: resolve(__dirname, "fallback.html")
      }
    }
  }
});
