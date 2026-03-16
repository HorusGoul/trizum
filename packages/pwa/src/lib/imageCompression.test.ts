import { i18n } from "@lingui/core";
import { beforeAll, describe, expect, test } from "vitest";
import {
  ImageProcessingError,
  getImageUploadErrorMessage,
  imageUploadAccept,
  isHeicImageFile,
  isSupportedImageFile,
} from "./imageCompression";

describe("image upload helpers", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  test("detects HEIC and HEIF files from MIME type or extension", () => {
    expect(
      isHeicImageFile(
        new File(["a"], "receipt.jpg", {
          type: "image/heic",
        }),
      ),
    ).toBe(true);

    expect(
      isHeicImageFile(
        new File(["a"], "receipt.HEIF", {
          type: "",
        }),
      ),
    ).toBe(true);

    expect(
      isHeicImageFile(
        new File(["a"], "receipt.jpg", {
          type: "image/jpeg",
        }),
      ),
    ).toBe(false);
  });

  test("treats HEIC extension uploads as supported image files", () => {
    expect(
      isSupportedImageFile(
        new File(["a"], "receipt.heic", {
          type: "",
        }),
      ),
    ).toBe(true);

    expect(
      isSupportedImageFile(
        new File(["a"], "receipt.pdf", {
          type: "application/pdf",
        }),
      ),
    ).toBe(false);
  });

  test("includes HEIC and HEIF formats in the input accept string", () => {
    expect(imageUploadAccept).toContain(".heic");
    expect(imageUploadAccept).toContain(".heif");
    expect(imageUploadAccept).toContain("image/heic");
    expect(imageUploadAccept).toContain("image/heif");
  });

  test("maps HEIC conversion failures to a user-facing error", () => {
    expect(
      getImageUploadErrorMessage(
        new ImageProcessingError("heic_conversion_failed"),
      ),
    ).toContain("HEIC");
  });
});
