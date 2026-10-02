// Static SPA build for Capacitor (Android). Kept separate from vite.config.ts so the
// Lovable/Cloudflare SSR build (`npm run build`) is untouched.
// Output: dist/client/index.html (+ assets/) -> capacitor.config.ts `webDir`.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    server: { entry: "server" },
    spa: {
      enabled: true,
      prerender: { outputPath: "/index", crawlLinks: false },
    },
  },
});
