/// <reference types="vite/client" />

declare module "*.po" {
  export const messages: Record<string, string>;
}
