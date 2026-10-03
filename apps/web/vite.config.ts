import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@checklist/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3711",
      "/healthz": "http://127.0.0.1:3711",
    },
  },
});
