// The iOS-style curve responds immediately, then gives edge-attached sheets a gentle landing.
export const sheetTweenConfig = {
  duration: 0.5,
  ease: [0.32, 0.72, 0, 1],
} as const;
