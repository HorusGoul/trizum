import colors from "tailwindcss/colors";

import { dynamicTwClasses } from "@horus.dev/tw-dynamic-themes/tailwind";
import tailwindcssReactAriaComponents from "tailwindcss-react-aria-components";
import tailwindcssAnimate from "tailwindcss-animate";
import tailwindSafeAreaCapacitor from "tailwindcss-safe-area-capacitor";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "selector",
  theme: {
    extend: {
      colors: {
        accent: dynamicTwClasses("accent", 250),
        danger: colors.red,
        success: colors.green,
        warning: colors.yellow,
      },
      fontFamily: {
        sans: ["Inter Variable", "sans-serif"],
        mono: ["Fira Code Variable", "monospace"],
      },
    },
  },
  plugins: [tailwindcssReactAriaComponents, tailwindcssAnimate, tailwindSafeAreaCapacitor],
};
