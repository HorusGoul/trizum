import colors from "tailwindcss/colors";

import { dynamicTwClasses } from "@horus.dev/tw-dynamic-themes/tailwind";
import tailwindcssAnimate from "tailwindcss-animate";
import tailwindSafeAreaCapacitor from "tailwindcss-safe-area-capacitor";

/** @type {import('tailwindcss').Config} */
export default {
  content: {
    relative: true,
    files: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  },
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
      animation: {
        blink: "blink 1s step-end infinite",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [tailwindcssAnimate, tailwindSafeAreaCapacitor],
};
