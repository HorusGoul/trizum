/// <reference types="vite-plus/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_COMMIT: string;
  readonly VITE_APP_WSS_URL: string;
  readonly VITE_APP_DISABLE_SENTRY?: string;
  readonly VITE_JAZZ_APP_ID?: string;
  readonly VITE_JAZZ_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.po" {
  export const messages: Record<string, string>;
}

declare module "@fontsource-variable/fira-code";

declare module "@fontsource-variable/inter";
