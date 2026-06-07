import { defineConfig } from "vite";

// Kalum's World — static front-end built with Vite, deployed on Vercel.
// The serverless API lives in /api and is handled by Vercel directly (it is
// not part of this Vite build, so we leave it untouched here).
export default defineConfig({
  root: ".",
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    open: false,
  },
});
