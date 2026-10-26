import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'de.dorfly.app',
  appName: 'Dorfly',
  webDir: 'public',
  // Zoomen mit zwei Fingern (WCAG 1.4.4), Capacitor sperrt es sonst auf Android und iOS
  zoomEnabled: true,
  server: {
    url: 'https://dorfly.de/start',
    cleartext: false,
    allowNavigation: ['*.dorfly.de']
  }
};
export default config;
