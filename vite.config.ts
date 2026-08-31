import { defineConfig } from "vite"
import { resolve } from "node:path"

export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        passport: resolve(__dirname, "index.html"),
        atlas: resolve(__dirname, "atlas/index.html"),
        restoration: resolve(__dirname, "restoration/index.html"),
      },
    },
  },
})
