import type { CapacitorConfig } from "@capacitor/cli";
import { existsSync, readFileSync } from "node:fs";

// Public half of the live-update signing key (safe to commit). The private half is the
// CAPGO_PRIVATE_KEY CI secret and must never be committed. See docs/ANDROID_BUILD.md.
const CAPGO_PUBLIC_KEY = existsSync(".capgo_key_v2.pub") ? readFileSync(".capgo_key_v2.pub", "utf8").trim() : undefined;

const config: CapacitorConfig = {
  appId: "com.talentpilot.app",
  appName: "TalentPilot",
  webDir: "dist/client",
  // Never set server.url: the APK must load the bundled dist/client files, not a remote site.
  server: { androidScheme: "https" },
  plugins: {
    // Manual mode: src/lib/updates.ts decides when to download / apply bundles.
    // Keep autoUpdate:false, or the plugin will try to talk to the Capgo cloud.
    CapacitorUpdater: { autoUpdate: false, ...(CAPGO_PUBLIC_KEY ? { publicKey: CAPGO_PUBLIC_KEY } : {}) },
    // Splash colours come from the native theme (res/values + res/values-night).
    SplashScreen: { launchAutoHide: false, launchShowDuration: 1500, showSpinner: false },
    StatusBar: { style: "LIGHT", backgroundColor: "#00000000", overlaysWebView: true },
    Keyboard: { resize: "body" },
  },
};

export default config;
