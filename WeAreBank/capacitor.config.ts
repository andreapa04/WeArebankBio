import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wearebank.app', // Debe coincidir con lo que pusiste en el init
  appName: 'WeAreBank',
  webDir: 'dist/we-are-bank/browser',
  server: {
    androidScheme: 'https',
    // Esto permite que cookies y sesiones funcionen mejor en Android
    hostname: 'wearebnk.site', 
    allowNavigation: [
      'wearebnk.site'
    ]
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;