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

    const accent950 = variables.find(([name]) => name.includes("950"))?.[1];

    if (!accent950) {
      return;
    }

    // Set theme-color meta tag to the 950 color of the theme hue
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", `oklch(${accent950} / 1)`);
  });
}
