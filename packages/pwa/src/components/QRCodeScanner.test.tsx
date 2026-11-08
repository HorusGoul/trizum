import { PwaUIProvider } from "#src/components/PwaUIProvider.js";
// @vitest-environment jsdom

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { QRCodeScanner, type ScanResult } from "./QRCodeScanner.tsx";

const detect = vi.hoisted(() => vi.fn<() => Promise<{ rawValue: string }[]>>());

let root: Root;
let container: HTMLDivElement;
let unmounted: boolean;
const onResult = vi.fn<(result: ScanResult) => void>();
const getUserMedia = vi.fn<typeof navigator.mediaDevices.getUserMedia>();

function stream() {
  const stop = vi.fn<() => void>();

  const track: Pick<MediaStreamTrack, "stop"> = { stop };

  const media: Pick<MediaStream, "getTracks"> = {
    // SAFETY: The scanner only stops the tracks returned by this controlled camera fixture.
    getTracks: () => [track as MediaStreamTrack],
  };

  // SAFETY: Camera teardown reads getTracks; the video element accepts this fixture's stream reference.
  return { media: media as MediaStream, stop };
}

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function render(validate?: (value: string) => true | string) {
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <PwaUIProvider>
          <QRCodeScanner
            onResult={onResult}
            validate={validate}
            createDetector={() => ({ detect })}
          />
        </PwaUIProvider>
      </I18nProvider>,
    ),
  );
}

async function unmount() {
  await act(async () => root.unmount());
  unmounted = true;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  i18n.load("en", {});
  i18n.activate("en");
  // SAFETY: React reads this optional test-only flag from the global object; production globals do not declare it.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("requestAnimationFrame", vi.fn<typeof requestAnimationFrame>().mockReturnValue(1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn<typeof cancelAnimationFrame>());
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(4);

  const context: Pick<CanvasRenderingContext2D, "drawImage"> = {
    drawImage: vi.fn<(image: CanvasImageSource, ...coordinates: number[]) => void>(),
  };

  // SAFETY: The scanner draws to the canvas; BarcodeDetector reads the canvas without other context calls.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as CanvasRenderingContext2D,
  );
  detect.mockResolvedValue([]);
  container = document.createElement("div");
  root = createRoot(container);
  unmounted = false;
});

afterEach(async () => {
  if (!unmounted) await unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("stops a camera stream that arrives after unmount", async () => {
  const camera = deferred<MediaStream>();
  const { media, stop } = stream();
  getUserMedia.mockReturnValue(camera.promise);
  await render();
  await unmount();
  await act(async () => camera.resolve(media));
  expect(stop).toHaveBeenCalledOnce();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  expect(onResult).not.toHaveBeenCalled();
});

it("ignores camera playback completing after unmount", async () => {
  const playback = deferred<void>();
  const { media, stop } = stream();
  getUserMedia.mockResolvedValue(media);
  vi.mocked(HTMLMediaElement.prototype.play).mockReturnValue(playback.promise);
  await render();
  await unmount();
  await act(async () => playback.resolve());
  expect(stop).toHaveBeenCalledOnce();
  expect(detect).not.toHaveBeenCalled();
});

it("ignores detection completing after unmount", async () => {
  const detection = deferred<{ rawValue: string }[]>();
  getUserMedia.mockResolvedValue(stream().media);
  detect.mockReturnValue(detection.promise);
  await render();
  expect(detect).toHaveBeenCalledOnce();
  await unmount();
  await act(async () => detection.resolve([{ rawValue: "party-id" }]));
  await act(async () => vi.advanceTimersByTime(2000));
  expect(onResult).not.toHaveBeenCalled();
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});

it.each([true, "Invalid code"] as const)(
  "cancels pending scan feedback on unmount (%s)",
  async (result) => {
    const { media, stop } = stream();
    getUserMedia.mockResolvedValue(media);
    detect.mockResolvedValue([{ rawValue: "party-id" }]);
    await render(() => result);
    expect(detect).toHaveBeenCalledOnce();
    await unmount();
    await act(async () => vi.advanceTimersByTime(2000));
    expect(onResult).not.toHaveBeenCalled();
    expect(detect).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  },
);

it("reports a successful scan after its feedback delay while mounted", async () => {
  const { media, stop } = stream();
  getUserMedia.mockResolvedValue(media);
  detect.mockResolvedValue([{ rawValue: "party-id" }]);
  await render();
  expect(onResult).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(1500));
  expect(onResult).toHaveBeenCalledWith({ type: "success", value: "party-id" });
  expect(stop).toHaveBeenCalledOnce();
});
