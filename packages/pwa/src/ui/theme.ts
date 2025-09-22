import {
  getVariables,
  updateVariables,
} from "@horus.dev/tw-dynamic-themes/runtime";

export const defaultThemeHue = 250;

export function setThemeHue(hue: number) {
  const variables = getVariables({
    baseName: "accent",
    hue,
  });

  updateVariables(variables);
}
