import plugin, { type PluginAPI } from "tailwindcss/plugin";

type UtilityProperties = Record<string, string | string[]>;
type BaseUtilities = Record<`.${string}`, UtilityProperties>;
type DynamicUtilities = Record<string, (value: string) => UtilityProperties>;

const baseUtilities = {
  ".m-safe": {
    marginTop: "var(--safe-area-inset-top)",
    marginRight: "var(--safe-area-inset-right)",
    marginBottom: "var(--safe-area-inset-bottom)",
    marginLeft: "var(--safe-area-inset-left)",
  },
  ".mx-safe": {
    marginRight: "var(--safe-area-inset-right)",
    marginLeft: "var(--safe-area-inset-left)",
  },
  ".my-safe": {
    marginTop: "var(--safe-area-inset-top)",
    marginBottom: "var(--safe-area-inset-bottom)",
  },
  ".mt-safe": {
    marginTop: "var(--safe-area-inset-top)",
  },
  ".mr-safe": {
    marginRight: "var(--safe-area-inset-right)",
  },
  ".mb-safe": {
    marginBottom: "var(--safe-area-inset-bottom)",
  },
  ".ml-safe": {
    marginLeft: "var(--safe-area-inset-left)",
  },
  ".p-safe": {
    paddingTop: "var(--safe-area-inset-top)",
    paddingRight: "var(--safe-area-inset-right)",
    paddingBottom: "var(--safe-area-inset-bottom)",
    paddingLeft: "var(--safe-area-inset-left)",
  },
  ".px-safe": {
    paddingRight: "var(--safe-area-inset-right)",
    paddingLeft: "var(--safe-area-inset-left)",
  },
  ".py-safe": {
    paddingTop: "var(--safe-area-inset-top)",
    paddingBottom: "var(--safe-area-inset-bottom)",
  },
  ".pt-safe": {
    paddingTop: "var(--safe-area-inset-top)",
  },
  ".pr-safe": {
    paddingRight: "var(--safe-area-inset-right)",
  },
  ".pb-safe": {
    paddingBottom: "var(--safe-area-inset-bottom)",
  },
  ".pl-safe": {
    paddingLeft: "var(--safe-area-inset-left)",
  },
  ".top-safe": {
    top: "var(--safe-area-inset-top)",
  },
  ".right-safe": {
    right: "var(--safe-area-inset-right)",
  },
  ".bottom-safe": {
    bottom: "var(--safe-area-inset-bottom)",
  },
  ".left-safe": {
    left: "var(--safe-area-inset-left)",
  },
  ".min-h-screen-safe": {
    minHeight: [
      "calc(100vh - (var(--safe-area-inset-top) + var(--safe-area-inset-bottom)))",
      "-webkit-fill-available",
    ],
  },
  ".max-h-screen-safe": {
    maxHeight: [
      "calc(100vh - (var(--safe-area-inset-top) + var(--safe-area-inset-bottom)))",
      "-webkit-fill-available",
    ],
  },
  ".h-screen-safe": {
    height: [
      "calc(100vh - (var(--safe-area-inset-top) + var(--safe-area-inset-bottom)))",
      "-webkit-fill-available",
    ],
  },
} satisfies BaseUtilities;

function mapUtilityProperties(
  properties: UtilityProperties,
  transformValue: (value: string) => string,
): UtilityProperties {
  return Object.fromEntries(
    Object.entries(properties).map(([property, value]) => [
      property,
      Array.isArray(value) ? value.map(transformValue) : transformValue(value),
    ]),
  );
}

function createDynamicUtilities(
  suffix: "offset" | "or",
  transformValue: (safeAreaValue: string, spacingValue: string) => string,
): DynamicUtilities {
  return Object.fromEntries(
    Object.entries(baseUtilities).map(([selector, properties]) => {
      const className = selector.slice(1);

      return [
        `${className}-${suffix}`,
        (spacingValue: string) =>
          mapUtilityProperties(properties, (safeAreaValue) =>
            safeAreaValue === "-webkit-fill-available"
              ? safeAreaValue
              : transformValue(safeAreaValue, spacingValue),
          ),
      ];
    }),
  );
}

const safeArea = plugin((api: PluginAPI) => {
  api.addUtilities(baseUtilities);

  api.matchUtilities(
    createDynamicUtilities(
      "offset",
      (safeAreaValue, spacingValue) => `calc(${safeAreaValue} + ${spacingValue})`,
    ),
    {
      supportsNegativeValues: true,
      values: api.theme("spacing") as Record<string, string>,
    },
  );

  api.matchUtilities(
    createDynamicUtilities(
      "or",
      (safeAreaValue, spacingValue) => `max(${safeAreaValue}, ${spacingValue})`,
    ),
    {
      supportsNegativeValues: true,
      values: api.theme("spacing") as Record<string, string>,
    },
  );
});

export default safeArea;
