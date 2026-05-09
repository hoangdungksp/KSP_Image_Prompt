import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        // Editor full-tab page (Hybrid mode — opened via chrome.tabs.create)
        editor: resolve(__dirname, "src/editor.html"),
        // Snipper content script — injected via chrome.scripting.executeScript
        snipper: resolve(__dirname, "src/snipper.ts"),
      },
      output: {
        // Force a stable filename for the snipper so background.ts can reference it
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "snipper") return "assets/snipper.js";
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
