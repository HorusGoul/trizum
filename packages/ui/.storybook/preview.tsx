import type { Preview } from "@storybook/react-vite";
import { PreviewFrame } from "./PreviewFrame.js";

const preview: Preview = {
  tags: ["autodocs"],
  initialGlobals: { locale: "en", theme: "dark", hue: "250" },
  globalTypes: {
    locale: {
      toolbar: {
        icon: "globe",
        items: [
          { value: "en", title: "English" },
          { value: "es", title: "Español" },
        ],
      },
    },
    theme: { toolbar: { icon: "circlehollow", items: ["light", "dark"] } },
    hue: {
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "250", title: "Blue" },
          { value: "150", title: "Green" },
          { value: "30", title: "Orange" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => (
      <PreviewFrame
        locale={context.globals.locale}
        theme={context.globals.theme}
        hue={Number(context.globals.hue)}
      >
        <Story />
      </PreviewFrame>
    ),
  ],
};

export default preview;
