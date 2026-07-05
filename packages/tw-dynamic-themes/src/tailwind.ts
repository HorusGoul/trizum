import { makeVariable, shades } from "./common.js";
import { consistentChroma } from "./runtime.js";

export function dynamicTwClasses(baseName: string, baseHue: number) {
  return Object.fromEntries(
    shades.map((shade, i) => {
      const color = consistentChroma(i, baseHue);

      return [
        shade,
        `oklch(${makeVariable({
          fallbackValue: color,
          name: baseName,
          shade,
          withVar: true,
        })} / <alpha-value>)`,
      ];
    }),
  );
}
