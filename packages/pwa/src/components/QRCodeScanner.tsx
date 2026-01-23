import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarcodeDetector } from "#src/lib/qr.js";
import { TrizumSpinner } from "./TrizumSpinner.js";
import { Icon } from "#src/ui/Icon.js";
import { cn } from "#src/ui/utils.js";

export type ScanResult =
  | { type: "success"; value: string }
  | { type: "cancelled" }
  | { type: "error"; message: string };

/**
 * Validation result for scanned QR codes.
 * Return `true` if valid, or an error message string if invalid.
 */
export type ValidationResult = true | string;

interface QRCodeScannerProps {
  onResult: (result: ScanResult) => void;
  /**
   * Optional validation function to check if the scanned value is valid.
   * If validation fails, an error animation is shown and scanning continues.
   * If not provided, all scanned QR codes are considered valid.
   */
  validate?: (value: string) => ValidationResult;
}

type ScannerState =
  | { status: "initializing" }
  | { status: "scanning" }
  | { status: "error"; message: string }
  | { status: "success" };

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
export function QRCodeScanner({ onResult, validate }: QRCodeScannerProps) {
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
          const scannedValue = barcodes[0].rawValue;

          // Validate the scanned value if a validator is provided
          if (validate) {
            const validationResult = validate(scannedValue);
            if (validationResult !== true) {
              // Validation failed - show error and continue scanning
              scanningRef.current = false;
              setState({ status: "error", message: validationResult });

              // Return to scanning after showing error
              setTimeout(() => {
                setState({ status: "scanning" });
                scanningRef.current = true;
                void scanFrame();
              }, 2000);
              return;
            }
          }

          // Found a valid QR code!
          scanningRef.current = false;
          setState({ status: "success" });

          // Show success animation before calling onResult
          setTimeout(() => {
            stopCamera();
            onResult({ type: "success", value: scannedValue });
          }, 1500);
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
    <motion.div
      className="relative flex flex-1 flex-col items-center justify-center bg-black"
      animate={
        state.status === "error"
          ? { x: [0, -8, 8, -6, 6, -4, 4, 0] }
          : { x: 0 }
      }
      transition={{ duration: 0.35, ease: "easeOut", delay: 0.2 }}
    >
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

      {/* Viewfinder overlay with darkened edges */}
      <div className="pointer-events-none absolute inset-0">
        {/* Semi-transparent overlay */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Clear center area */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative size-56">
            {/* Cut out the center */}
            <div
              className="absolute inset-0 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
              style={{ background: "transparent" }}
            />

            {/* Corner handles */}
            <QRCodeFrameHandle className="absolute left-0 top-0" />
            <QRCodeFrameHandle className="absolute right-0 top-0 rotate-90" />
            <QRCodeFrameHandle className="absolute bottom-0 right-0 rotate-180" />
            <QRCodeFrameHandle className="absolute bottom-0 left-0 -rotate-90" />

            {/* Status indicator */}
            <AnimatePresence mode="wait">
              {state.status === "initializing" && (
                <motion.div
                  key="initializing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <TrizumSpinner size={48} className="text-white" />
                </motion.div>
              )}

              {state.status === "scanning" && (
                <motion.div
                  key="scanning"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring", duration: 0.4 }}
                  className="absolute inset-x-0 bottom-4 flex justify-center"
                >
                  <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                    <Trans>Align QR code here</Trans>
                  </span>
                </motion.div>
              )}

              {state.status === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", duration: 0.5, bounce: 0.4 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="flex size-16 items-center justify-center rounded-full bg-success-500">
                    <Icon
                      name="#lucide/check"
                      size={40}
                      className="text-white"
                    />
                  </div>
                </motion.div>
              )}

              {state.status === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", duration: 0.25, bounce: 0.2 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.3, bounce: 0.4 }}
                    className="flex size-16 items-center justify-center rounded-full bg-danger-500"
                  >
                    <Icon name="#lucide/x" size={40} className="text-white" />
                  </motion.div>
                  <motion.span
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="max-w-48 rounded-lg bg-black/60 px-3 py-1.5 text-center text-xs text-white"
                  >
                    {state.message}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Instructions with gradient background */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent pb-safe">
        <AnimatePresence mode="wait">
          <motion.p
            key={state.status === "error" ? "error" : "default"}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="pb-8 pt-12 text-center text-sm text-white"
          >
            {state.status === "error" ? (
              <Trans>Try scanning another code</Trans>
            ) : (
              <Trans>Point your camera at a trizum QR code</Trans>
            )}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
