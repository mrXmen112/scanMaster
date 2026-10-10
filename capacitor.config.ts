import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.scanmaster.ai',
  appName: 'ScanMaster',
  // CRITICAL: Must match Next.js build output directory.
  // With output: 'export', Next.js builds to 'out/'.
  // Previously 'public' — which only had a static "Loading..." HTML page with zero JS.
  webDir: 'out',
  server: {
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: '#06102A',
    },
  },
};

export default config;
