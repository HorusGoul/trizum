import { RECOMMENDED_RULES, type Capability } from "oxlint-plugin-react-doctor";

// Capacitor hosts the web app; it does not make this a React Native or SSR app.
// Standalone Oxlint needs the context that the Doctor CLI detects itself.
export const reactDoctorSettings = {
  framework: "vite",
  capabilities: [
    "vite",
    "client-only",
    "react",
    "react:17",
    "react:18",
    "react:19",
    "react:19.2",
    "react-compiler",
    "typescript",
    "react-aria",
    "tanstack-form",
    "i18n",
    "tailwind",
    "tailwind:3.4",
    "tailwind:4",
    "zod",
    "zod:4",
    "pre-es2023",
  ] satisfies Capability[],
};

const enforcedRules = Object.fromEntries(
  Object.entries(RECOMMENDED_RULES).map(
    ([rule, severity]) => [rule, severity === "off" ? "off" : "error"] as const,
  ),
);

export default {
  categories: {
    Security: "error",
    Bugs: "error",
    Accessibility: "error",
    Performance: "error",
    Maintainability: "error",
  },
  rules: {
    ...enforcedRules,

    // Module organization and refactoring metrics belong in code review.
    "react-doctor/no-multi-comp": "off",
    "react-doctor/no-giant-component": "off",
    "react-doctor/no-high-complexity-react-function": "off",
    "react-doctor/duplicate-jsx-subtree": "off",
    // Oxlint's native React rule owns Fast Refresh, including route exceptions.
    "react-doctor/only-export-components": "off",

    // TanStack Form cancels native submission; the PWA never hydrates.
    "react-doctor/no-prevent-default": "off",
    "react-doctor/no-hydration-branch-on-browser-global": "off",
    "react-doctor/no-unguarded-browser-global-in-render-or-hook-init": "off",

    // These are design alternatives, not proof that state/effect logic is wrong.
    "react-doctor/no-adjust-state-on-prop-change": "off",
    "react-doctor/no-derived-state": "off",
    "react-doctor/no-derived-state-effect": "off",
    "react-doctor/no-derived-useState": "off",
    "react-doctor/no-did-mount-set-state": "off",
    "react-doctor/no-did-update-set-state": "off",
    "react-doctor/no-effect-chain": "off",
    "react-doctor/no-effect-event-handler": "off",
    "react-doctor/no-event-handler": "off",
    "react-doctor/no-event-trigger-state": "off",
    "react-doctor/no-fetch-in-effect": "off",
    "react-doctor/no-initialize-state": "off",
    "react-doctor/no-mirror-prop-effect": "off",
    "react-doctor/no-pass-data-to-parent": "off",
    "react-doctor/no-pass-live-state-to-parent": "off",
    "react-doctor/no-prop-callback-in-effect": "off",
    "react-doctor/no-reset-all-state-on-prop-change": "off",
    "react-doctor/no-uncontrolled-input": "off",
    "react-doctor/no-whole-object-dep-with-member-reads": "off",
    "react-doctor/prefer-use-effect-event": "off",
    "react-doctor/no-document-start-view-transition": "off",

    // Explicit focus and React Aria primitives are intentional in application UI.
    "react-doctor/no-autofocus": "off",
    "react-doctor/prefer-html-dialog": "off",
    "react-doctor/prefer-tag-over-role": "off",
    "react-doctor/anchor-ambiguous-text": "off",
    "react-doctor/img-redundant-alt": "off",
    "react-doctor/no-uninformative-aria-label": "off",

    // Profile these choices. Keep concrete resource, algorithm and API checks.
    "react-doctor/advanced-event-handler-refs": "off",
    "react-doctor/async-await-in-loop": "off",
    "react-doctor/async-defer-await": "off",
    "react-doctor/async-parallel": "off",
    "react-doctor/client-passive-event-listeners": "off",
    "react-doctor/js-batch-dom-css": "off",
    "react-doctor/js-cache-storage": "off",
    "react-doctor/js-hoist-intl": "off",
    "react-doctor/js-hoist-regexp": "off",
    "react-doctor/js-index-maps": "off",
    "react-doctor/js-min-max-loop": "off",
    "react-doctor/js-set-map-lookups": "off",
    "react-doctor/no-dynamic-import-path": "off",
    "react-doctor/no-eager-new-in-use-state-initializer": "off",
    "react-doctor/no-flush-sync": "off",
    "react-doctor/no-full-lodash-import": "off",
    "react-doctor/no-img-lazy-with-high-fetchpriority": "off",
    "react-doctor/no-json-parse-stringify-clone": "off",
    "react-doctor/no-large-animated-blur": "off",
    "react-doctor/no-layout-property-animation": "off",
    "react-doctor/no-global-css-variable-animation": "off",
    "react-doctor/no-permanent-will-change": "off",
    "react-doctor/no-moment": "off",
    "react-doctor/no-srcset-without-sizes": "off",
    "react-doctor/no-transition-all": "off",
    "react-doctor/no-unthrottled-scroll-mutation": "off",
    "react-doctor/prefer-dynamic-import": "off",
    "react-doctor/no-undeferred-third-party": "off",
    "react-doctor/rendering-script-defer-async": "off",
    "react-doctor/redux-useselector-inline-derivation": "off",
    "react-doctor/redux-useselector-returns-new-collection": "off",
    "react-doctor/rendering-hydration-no-flicker": "off",
    "react-doctor/rerender-defer-reads-hook": "off",
    "react-doctor/rerender-derived-state-from-hook": "off",
    "react-doctor/rerender-lazy-ref-init": "off",
    "react-doctor/rerender-lazy-state-init": "off",
    "react-doctor/rerender-memo-before-early-return": "off",
    "react-doctor/rerender-state-only-in-handlers": "off",
    "react-doctor/rerender-transitions-scroll": "off",
    "react-doctor/server-after-nonblocking": "off",
    "react-doctor/server-cache-with-object-literal": "off",
    "react-doctor/server-fetch-without-revalidate": "off",
    "react-doctor/server-hoist-static-io": "off",
    "react-doctor/server-sequential-independent-await": "off",
    "react-doctor/use-lazy-motion": "off",
  },
} as const;
