import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";

export function shouldUseNativeCameraCapture() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function isNativeCameraCancel(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /cancel|cancelled|canceled/i.test(error.message);
}

export async function getNativeCameraCaptureFile() {
  const photo = await Camera.getPhoto({
    quality: 90,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
  });

  if (!photo.webPath) {
    throw new Error("Native camera did not return a readable image path");
  }

  const response = await fetch(photo.webPath);
  const blob = await response.blob();
  const mimeType = blob.type || getMimeTypeForPhotoFormat(photo.format);
  const extension = getFileExtensionForMimeType(mimeType);

  return new File([blob], `camera-${Date.now()}${extension}`, {
    type: mimeType,
  });
}

function getMimeTypeForPhotoFormat(format: string) {
  switch (format.toLowerCase()) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "jpeg":
    case "jpg":
    default:
      return "image/jpeg";
  }
}

function getFileExtensionForMimeType(mimeType: string) {
  switch (mimeType.toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/jpeg":
    default:
      return ".jpg";
  }
}
