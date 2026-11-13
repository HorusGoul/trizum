// @vitest-environment jsdom
import { createBrowserHistory, type RouterHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { createSheetNavigation } from "./sheetNavigation";

let history: RouterHistory;
let navigation: ReturnType<typeof createSheetNavigation>;
const cleanups: (() => void)[] = [];

beforeEach(() => {
  window.history.replaceState(null, "", "/party");
  navigation = createSheetNavigation(() => createBrowserHistory());
  history = navigation.history;
  history.push("/expense?calculator=amount");
  history.flush();
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  await navigation.destroy();
});

function register(dismiss = vi.fn<() => boolean>(() => true)) {
  const cleanup = navigation.register(dismiss);
  cleanups.push(cleanup);

  return { dismiss, cleanup };
}

async function expectLocation(href: string) {
  await vi.waitFor(() => {
    expect(window.location.pathname + window.location.search).toBe(href);
    expect(history.location.href).toBe(href);
  });
}

async function backCloses(dismiss: ReturnType<typeof register>["dismiss"]) {
  window.history.back();
  await vi.waitFor(() => expect(dismiss).toHaveBeenCalledOnce());
  await expectLocation("/expense?calculator=amount");
}

test("browser Back closes a sheet before leaving the editor or its calculator", async () => {
  const length = history.length;
  const { dismiss } = register();
  await backCloses(dismiss);
  expect(history.length).toBe(length);
  window.history.back();
  await expectLocation("/party");
  expect(dismiss).toHaveBeenCalledOnce();
});

test("each Back closes only the top sheet", async () => {
  const parent = register();
  const child = register();
  await backCloses(child.dismiss);
  expect(parent.dismiss).not.toHaveBeenCalled();
  await backCloses(parent.dismiss);
  window.history.back();
  await expectLocation("/party");
});

test("go(-1), used by native navigation, also closes the sheet first", async () => {
  const { dismiss } = register();
  history.go(-1);
  await vi.waitFor(() => expect(dismiss).toHaveBeenCalledOnce());
  await expectLocation("/expense?calculator=amount");
});

test("ordinary dismissal leaves no extra Back step", async () => {
  const { dismiss, cleanup } = register();
  cleanup();
  window.history.back();
  await expectLocation("/party");
  expect(dismiss).not.toHaveBeenCalled();
});

test("a locked top sheet consumes Back without dismissing a sheet underneath", async () => {
  const parent = register();
  const child = register(vi.fn<() => boolean>(() => false));
  await backCloses(child.dismiss);
  expect(parent.dismiss).not.toHaveBeenCalled();
  child.dismiss.mockReturnValue(true);
  window.history.back();
  await vi.waitFor(() => expect(child.dismiss).toHaveBeenCalledTimes(2));
  await expectLocation("/expense?calculator=amount");
  expect(parent.dismiss).not.toHaveBeenCalled();
});

test("native Back works even at the first app entry and cannot dismiss a sheet twice", async () => {
  window.history.back();
  await expectLocation("/party");
  expect(history.canGoBack()).toBe(false);
  const parent = register();
  const child = register();
  expect(navigation.handleBack()).toBe(true);
  expect(navigation.handleBack()).toBe(true);
  expect(navigation.handleBack()).toBe(false);
  expect(child.dismiss).toHaveBeenCalledOnce();
  expect(parent.dismiss).toHaveBeenCalledOnce();
  expect(history.location.href).toBe("/party");
});

test("push and replace navigation remain available while a sheet is open", async () => {
  const { dismiss } = register();
  history.push("/settings");
  await expectLocation("/settings");
  history.replace("/settings/account");
  await expectLocation("/settings/account");
  expect(dismiss).not.toHaveBeenCalled();
});

test("Forward navigation is not treated as sheet dismissal", async () => {
  history.push("/next");
  history.flush();
  window.history.back();
  await expectLocation("/expense?calculator=amount");
  const { dismiss } = register();
  history.go(1);
  await expectLocation("/next");
  expect(dismiss).not.toHaveBeenCalled();
});

test("opening a sheet does not enable a before-unload confirmation", () => {
  register();
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});
