import { App, type AppState } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";

/** The app-state subscription shared by native controllers and store refreshes. */
export type ListenForAppState = (
  listener: (state: AppState) => void,
) => Promise<PluginListenerHandle>;

export const listenForAppState: ListenForAppState = (listener) =>
  App.addListener("appStateChange", listener);
