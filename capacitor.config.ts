import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.talentpilot.app",
  appName: "TalentPilot",
  webDir: "dist/client",
  // Never set server.url: the APK must load the bundled dist/client files, not a remote site.
  server: { androidScheme: "https" },
  plugins: {
    SplashScreen: { launchAutoHide: false, launchShowDuration: 1500, backgroundColor: "#ffffff", showSpinner: false },
    StatusBar: { style: "LIGHT", backgroundColor: "#00000000", overlaysWebView: true },
    Keyboard: { resize: "body" },
  },
};

export default config;
