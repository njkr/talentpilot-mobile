import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.talentpilot.app",
  appName: "TalentPilot",
  webDir: "dist/client",
  // Never set server.url: the APK must load the bundled dist/client files, not a remote site.
  // ⚠️ No `server.url`: the app must load its bundled/updated web files, not a remote site
  // (that would bypass the live-update plugin and break offline use).
  server: { androidScheme: "https" },
  plugins: {
    // Manual mode: src/lib/updates.ts decides when to download / apply bundles.
    // Keep autoUpdate:false, or the plugin will try to talk to the Capgo cloud.
    CapacitorUpdater: { autoUpdate: false },
    SplashScreen: { launchAutoHide: false, launchShowDuration: 1500, backgroundColor: "#ffffff", showSpinner: false },
    StatusBar: { style: "LIGHT", backgroundColor: "#00000000", overlaysWebView: true },
    Keyboard: { resize: "body" },
  },
};

export default config;
