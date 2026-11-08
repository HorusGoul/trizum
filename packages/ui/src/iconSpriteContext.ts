import { createContext, use } from "react";

export const IconSpriteContext = createContext<string | null>(null);

export function useIconSprite() {
  const spriteHref = use(IconSpriteContext);

  if (spriteHref === null)
    throw new Error("Wrap UI components in UIProvider with the target's generated spriteHref.");

  return spriteHref;
}
