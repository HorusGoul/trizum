import type { Page } from "playwright";

declare global {
  var __screenshots: Map<string, ScreenshotFunction>;
}

global.__screenshots = new Map();

interface ScreenshotUserFunctionParams {
  page: Page;
  takeScreenshot: () => Promise<void>;
  setupParty: () => Promise<void>;
}

type ScreenshotUserFunction = (
  params: ScreenshotUserFunctionParams,
) => Promise<void>;

interface ScreenshotFunctionParams {
  page: Page;
  takeScreenshot: (name: string) => Promise<void>;
  setupParty: () => Promise<void>;
}

type ScreenshotFunction = ((
  params: ScreenshotFunctionParams,
) => Promise<void>) & {
  __isScreenshotFunction: true;
};

export function screenshot(
  name: string,
  fn: ScreenshotUserFunction,
): ScreenshotFunction {
  const wrappedFn: ScreenshotFunction = async ({
    page,
    takeScreenshot,
    setupParty,
  }) => {
    await fn({
      page,
      takeScreenshot: async () => await takeScreenshot(name),
      setupParty,
    });
  };

  wrappedFn.__isScreenshotFunction = true;
  global.__screenshots.set(name, wrappedFn);

  return wrappedFn;
}

export function isScreenshotFunction(fn: unknown): fn is ScreenshotFunction {
  return (
    typeof fn === "function" &&
    "__isScreenshotFunction" in fn &&
    fn.__isScreenshotFunction === true
  );
}
