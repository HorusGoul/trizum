import { afterEach, expect, it, vi } from "vite-plus/test";

export function testAdMobListenerRollback(platform: "android" | "ios") {
  afterEach(() => vi.unstubAllGlobals());

  it(`removes earlier AdMob listeners when the custom plugin is unavailable on ${platform}`, async () => {
    const registered: string[] = [];
    const removed: string[] = [];
    const active = new Set<string>();

    vi.stubGlobal("androidBridge", platform === "android" ? {} : undefined);
    vi.stubGlobal("webkit", platform === "ios" ? { messageHandlers: { bridge: {} } } : undefined);
    vi.stubGlobal("Capacitor", {
      PluginHeaders: [
        {
          name: "AdMob",
          methods: [{ name: "addListener" }, { name: "removeListener" }],
        },
      ],
      nativeCallback(
        plugin: string,
        method: string,
        options: { eventName: string; callbackId?: string },
      ) {
        expect(plugin).toBe("AdMob");

        if (method === "addListener") {
          const id = String(registered.length);
          registered.push(id);
          active.add(id);

          return id;
        }

        expect(method).toBe("removeListener");

        if (options.callbackId === undefined) {
          throw new Error("Listener removal requires a callback ID");
        }

        removed.push(options.callbackId);
        active.delete(options.callbackId);
      },
    });

    const { Capacitor } = await import("@capacitor/core");
    const { createAdMobSdk } = await import("./adMobSdk.ts");
    expect(Capacitor.getPlatform()).toBe(platform);

    await expect(createAdMobSdk(() => {})).rejects.toMatchObject({
      code: "UNIMPLEMENTED",
      message: `"NativeAppOpenAd" plugin is not implemented on ${platform}`,
    });

    expect(registered).toHaveLength(3);
    await vi.waitFor(() => expect(removed).toEqual(registered));
    expect(active.size).toBe(0);
  });
}
