/// <reference types="vite-plus/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_COMMIT: string;
  readonly VITE_APP_WSS_URL: string;
  readonly VITE_APP_AUTH_URL?: string;
  readonly VITE_APP_DISABLE_SENTRY?: string;
  readonly VITE_APP_ADMOB_ANDROID_APP_OPEN_ID: string;
  readonly VITE_APP_ADMOB_ANDROID_INTERSTITIAL_ID: string;
  readonly VITE_APP_ADMOB_IOS_APP_OPEN_ID: string;
  readonly VITE_APP_ADMOB_IOS_INTERSTITIAL_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.po" {
  export const messages: Record<string, string>;
}

declare module "@fontsource-variable/fira-code";

declare module "@fontsource-variable/inter";
