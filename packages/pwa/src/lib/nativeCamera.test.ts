import { Camera } from "@capacitor/camera";
import type * as CapacitorCamera from "@capacitor/camera";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { getNativeCameraCaptureFile } from "./nativeCamera.ts";

vi.mock("@capacitor/camera", async (importOriginal) => ({
  ...(await importOriginal<typeof CapacitorCamera>()),
  Camera: { getPhoto: vi.fn<typeof Camera.getPhoto>() },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it("rejects a failed camera download instead of returning an error page as an image", async () => {
  vi.mocked(Camera.getPhoto).mockResolvedValue({
    webPath: "https://localhost/camera/photo.jpg",
    format: "jpeg",
    saved: false,
  });
  const response = new Response("Not found", { status: 404 });
  const readBlob = vi.spyOn(response, "blob");
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));

  await expect(getNativeCameraCaptureFile()).rejects.toThrow(
    "Could not read native camera image (404)",
  );
  expect(readBlob).not.toHaveBeenCalled();
});

it("returns the downloaded camera image with its MIME type", async () => {
  vi.mocked(Camera.getPhoto).mockResolvedValue({
    webPath: "https://localhost/camera/photo.png",
    format: "png",
    saved: false,
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(new Blob(["image"], { type: "image/png" }))),
  );

  const file = await getNativeCameraCaptureFile();
  expect(file.type).toBe("image/png");
  expect(file.name).toMatch(/^camera-\d+\.png$/);
  expect(await file.text()).toBe("image");
});
