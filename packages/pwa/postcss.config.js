import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL(".", import.meta.url));

export default {
  plugins: {
    tailwindcss: {
      config: path.resolve(packageRoot, "tailwind.config.js"),
    },
    autoprefixer: {},
  },
};
