import { makeVariable, shades } from "./common.js";
import { consistentChroma } from "./runtime.js";

export function generateCssVariables(colorName: string, hue: number) {
  const variables = shades.map((shade, i) => {
    const color = consistentChroma(i, hue);

    return `  --color-${colorName}-${shade}: oklch(${makeVariable({
      fallbackValue: color,
      name: colorName,
      shade,
      withVar: true,
    })});`;
  });

  return `@theme {\n${variables.join("\n")}\n}`;
}
