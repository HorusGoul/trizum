import { describe, expect, test, vi } from "vite-plus/test";
import type { RouterHistory } from "@tanstack/react-router";
import {
  closeRouteState,
  navigateWithoutDuplicateEntry,
  preventDuplicateHistoryEntries,
  pushHistoryWithoutDuplicateEntry,
  shouldReplaceNavigation,
  shouldNavigateToPartyListOnNativeBack,
} from "./navigationHistory.ts";

describe("navigationHistory", () => {
  test("detects duplicate href navigations", () => {
    expect(shouldReplaceNavigation("/settings", "/settings")).toBe(true);
    expect(shouldReplaceNavigation("/settings", "/settings/cloud-sync")).toBe(false);
  });

  test("replaces imperative navigations to the current href", () => {
    const navigate =
      vi.fn<(options: { replace?: boolean; search: { scanning: boolean } }) => void>();

    navigateWithoutDuplicateEntry(
      { href: "/join?scanning=true" },
      () => ({ href: "/join?scanning=true" }),
      navigate,
      { search: { scanning: true } },
    );

    expect(navigate).toHaveBeenCalledWith({
      search: { scanning: true },
      replace: true,
    });
  });

  test("preserves explicit replace values", () => {
    const navigate =
      vi.fn<(options: { replace?: boolean; search: { scanning: boolean } }) => void>();

    navigateWithoutDuplicateEntry(
      { href: "/join" },
      () => ({ href: "/join?scanning=true" }),
      navigate,
      { search: { scanning: true }, replace: true },
    );

    expect(navigate).toHaveBeenCalledWith({
      search: { scanning: true },
      replace: true,
    });
  });

  test("pushes native deep links unless they match the current href", () => {
    const history = {
      location: { href: "/settings" },
      push: vi.fn<(href: string) => void>(),
      replace: vi.fn<(href: string) => void>(),
    };

    pushHistoryWithoutDuplicateEntry(history, "/settings/cloud-sync");
    pushHistoryWithoutDuplicateEntry(history, "/settings");

    expect(history.push).toHaveBeenCalledWith("/settings/cloud-sync");
    expect(history.replace).toHaveBeenCalledWith("/settings");
  });

  test("wraps history push to replace duplicate hrefs", () => {
    const location = { href: "/settings" };
    const push = vi.fn<(href: string, state?: unknown, navigateOptions?: unknown) => void>();
    const replace = vi.fn<(href: string, state?: unknown, navigateOptions?: unknown) => void>();
    const history = {
      get location() {
        return location;
      },
      push,
      replace,
    } as unknown as RouterHistory;

    preventDuplicateHistoryEntries(history);
    history.push("/settings", { from: "test" });
    history.push("/settings/cloud-sync", { from: "test" });

    expect(push).toHaveBeenCalledWith("/settings/cloud-sync", { from: "test" }, undefined);
    expect(replace).toHaveBeenCalledWith("/settings", { from: "test" }, undefined);
  });

  test("closes route state by going back when there is history", () => {
    const history = { go: vi.fn<(delta: number) => void>() };
    const replaceFallback = vi.fn<() => void>();

    closeRouteState({ state: { __TSR_index: 1 } }, history, replaceFallback);

    expect(history.go).toHaveBeenCalledWith(-1);
    expect(replaceFallback).not.toHaveBeenCalled();
  });

  test("closes direct route state by replacing with fallback options", () => {
    const history = { go: vi.fn<(delta: number) => void>() };
    const replaceFallback = vi.fn<() => void>();

    closeRouteState({ state: { __TSR_index: 0 } }, history, replaceFallback);

    expect(history.go).not.toHaveBeenCalled();
    expect(replaceFallback).toHaveBeenCalledOnce();
  });

  test("uses the party list as the native back fallback inside a party", () => {
    expect(
      shouldNavigateToPartyListOnNativeBack({
        canGoBack: false,
        pathname: "/party/abc123",
      }),
    ).toBe(true);

    expect(
      shouldNavigateToPartyListOnNativeBack({
        canGoBack: false,
        pathname: "/party/abc123/settings",
      }),
    ).toBe(true);
  });

  test("does not use the party list native back fallback when history is available", () => {
    expect(
      shouldNavigateToPartyListOnNativeBack({
        canGoBack: true,
        pathname: "/party/abc123",
      }),
    ).toBe(false);
  });

  test("does not use the party list native back fallback outside a party", () => {
    expect(
      shouldNavigateToPartyListOnNativeBack({
        canGoBack: false,
        pathname: "/",
      }),
    ).toBe(false);

    expect(
      shouldNavigateToPartyListOnNativeBack({
        canGoBack: false,
        pathname: "/settings",
      }),
    ).toBe(false);

    expect(
      shouldNavigateToPartyListOnNativeBack({
        canGoBack: false,
        pathname: "/party-settings",
      }),
    ).toBe(false);
  });
});
