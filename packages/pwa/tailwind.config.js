import colors from "tailwindcss/colors";

import { dynamicTwClasses } from "@horus.dev/tw-dynamic-themes/tailwind";
import tailwindcssReactAriaComponents from "tailwindcss-react-aria-components";
import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: dynamicTwClasses("accent", 250),
        danger: colors.red,
        success: colors.green,
        warning: colors.yellow,
      },
    },
  },
  plugins: [tailwindcssReactAriaComponents, tailwindcssAnimate],
};
