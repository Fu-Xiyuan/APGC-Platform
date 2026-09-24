import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_PUBLIC_BASE || "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../AnonymousPGC-Web/shared"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
});
