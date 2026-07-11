declare module "*.po" {
  export const messages: Record<string, string>;
}

declare module "*.ttf?url" {
  const url: string;
  export default url;
}
