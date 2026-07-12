import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'de.dorfly.app',
  appName: 'Dorfly',
  webDir: 'public',
  server: {
    url: 'https://dorfly.de',
    cleartext: false,
    allowNavigation: ['*.dorfly.de']
  }
};
export default config;
