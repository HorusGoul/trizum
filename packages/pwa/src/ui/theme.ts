import {
  getVariables,
  updateVariables,
} from "@horus.dev/tw-dynamic-themes/runtime";

export const defaultThemeHue = 250;

let lastRAF: number | null = null;

export function setThemeHue(hue: number) {
  const variables = getVariables({
    baseName: "accent",
    hue,
  });

  if (lastRAF) {
    window.cancelAnimationFrame(lastRAF);
  }

  lastRAF = window.requestAnimationFrame(() => {
    updateVariables(variables);
  });
}
