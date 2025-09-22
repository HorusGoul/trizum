import { defineConfig, Preset } from "@vite-pwa/assets-generator/config";

const preset: Preset = {
  transparent: {
    sizes: [64, 192, 512],
    favicons: [[48, "favicon.ico"]],
  },
  maskable: {
    sizes: [512],
  },
  apple: {
    sizes: [180],
  },
};

export default defineConfig({
  headLinkOptions: {
    preset: "2023",
  },
  preset,
  images: ["public/maskable.svg"],
});
