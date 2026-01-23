import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";
import { BarcodeDetector } from "#src/lib/qr.js";
import { cn } from "#src/ui/utils.js";

export type ScanResult =
  | { type: "success"; value: string }
  | { type: "cancelled" }
  | { type: "error"; message: string };

interface QRCodeScannerProps {
  onResult: (result: ScanResult) => void;
}

type ScannerState = { status: "initializing" } | { status: "scanning" };

const QRCodeFrameHandle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    {...props}
    className={cn(
      "border-l-3 border-t-3 size-4 rounded-tl-lg border-accent-50",
      className,
    )}
  />
);

/**
 * QR Code Scanner component that uses the device camera to scan QR codes.
 * Uses barcode-detector (ZXing-C++ WebAssembly) for cross-platform scanning.
 */
export function QRCodeScanner({ onResult }: QRCodeScannerProps) {
  const [state, setState] = useState<ScannerState>({ status: "initializing" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    let animationFrameId: number;
    let detector: InstanceType<typeof BarcodeDetector> | null = null;

    async function initScanner() {
      try {
        // Create barcode detector
        detector = new BarcodeDetector({
          formats: ["qr_code"],
        });

        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment", // Prefer back camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setState({ status: "scanning" });
          scanningRef.current = true;
          void scanFrame();
        }
      } catch (err) {
        console.error("Camera initialization error:", err);

        if (err instanceof Error) {
          if (
            err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError"
          ) {
            onResult({
              type: "error",
              message: t`Camera permission was denied`,
            });
            return;
          }

          if (err.name === "NotFoundError") {
            onResult({
              type: "error",
              message: t`No camera found on this device`,
            });
            return;
          }
        }

        onResult({
          type: "error",
          message: t`Failed to access camera`,
        });
      }
    }

    async function scanFrame() {
      if (
        !scanningRef.current ||
        !videoRef.current ||
        !canvasRef.current ||
        !detector
      ) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationFrameId = requestAnimationFrame(() => void scanFrame());
        return;
      }

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        // Detect barcodes in the frame
        const barcodes = await detector.detect(canvas);

        if (barcodes.length > 0 && barcodes[0].rawValue) {
          // Found a QR code!
          scanningRef.current = false;
          stopCamera();
          onResult({ type: "success", value: barcodes[0].rawValue });
          return;
        }
      } catch (err) {
        console.error("Barcode detection error:", err);
      }

      // Continue scanning
      animationFrameId = requestAnimationFrame(() => void scanFrame());
    }

    function stopCamera() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    void initScanner();

    return () => {
      scanningRef.current = false;
      cancelAnimationFrame(animationFrameId);
      stopCamera();
    };
  }, [onResult]);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center bg-black">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video element showing camera feed */}
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Viewfinder overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative size-64">
          {/* Corner handles */}
          <QRCodeFrameHandle className="absolute left-0 top-0" />
          <QRCodeFrameHandle className="absolute right-0 top-0 rotate-90" />
          <QRCodeFrameHandle className="absolute bottom-0 right-0 rotate-180" />
          <QRCodeFrameHandle className="absolute bottom-0 left-0 -rotate-90" />

          {/* Scanning indicator */}
          {state.status === "initializing" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-8 animate-spin rounded-full border-4 border-accent-200 border-t-accent-50" />
            </div>
          )}
        </div>
      </div>

      {/* Instructions with gradient background */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent pb-safe">
        <p className="pb-8 pt-12 text-center text-sm text-white">
          <Trans>Point your camera at a trizum QR code</Trans>
        </p>
      </div>
    </div>
  );
}
