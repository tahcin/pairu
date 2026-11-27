import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// PAIRU_API points the dev server at another API, for example the live one for UI work:
// PAIRU_API=https://pairu.pages.dev npx vite
const api = process.env.PAIRU_API || "http://localhost:8788";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: api, changeOrigin: true } } },
});
