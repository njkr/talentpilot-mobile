import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.talentpilot.app",
  appName: "TalentPilot",
  webDir: "dist/client",
  server: { androidScheme: "https" },
  plugins: {
    SplashScreen: { launchShowDuration: 1500, backgroundColor: "#ffffff", showSpinner: false },
    StatusBar: { style: "LIGHT", backgroundColor: "#ffffff", overlaysWebView: false },
    Keyboard: { resize: "body" },
  },
};

export default config;
