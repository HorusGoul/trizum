import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TrizumSpinner } from "./TrizumSpinner.js";
import { Icon } from "#src/ui/Icon.js";
import { Button } from "#src/ui/Button.js";
import { cn } from "#src/ui/utils.js";
import { useReceiptProcessor } from "#src/hooks/useReceiptProcessor.js";
import type { ExtractedReceiptData } from "#src/lib/receiptExtraction.js";

export type ReceiptScanResult =
  | { type: "success"; data: ExtractedReceiptData }
  | { type: "cancelled" }
  | { type: "error"; message: string };

interface ReceiptScannerProps {
  onResult: (result: ReceiptScanResult) => void;
}

type ScannerState =
  | { status: "initializing" }
  | { status: "camera-ready" }
  | { status: "confirm-download" }
  | { status: "loading-model"; message?: string; downloadProgress?: number }
  | { status: "processing" }
  | { status: "error"; message: string }
  | { status: "success" };

/**
 * Receipt Scanner component that uses the device camera to capture receipts
 * and extract data using local AI processing.
 */
export function ReceiptScanner({ onResult }: ReceiptScannerProps) {
  const [state, setState] = useState<ScannerState>({ status: "initializing" });
  const [capturedImage, setCapturedImage] = useState<ArrayBuffer | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [waitingForModel, setWaitingForModel] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const {
    status: processorStatus,
    progress,
    error: processorError,
    loadModel,
    processImage,
    isReady,
  } = useReceiptProcessor();

  // Initialize camera
  useEffect(() => {
    let mounted = true;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setState({ status: "camera-ready" });
        }
      } catch (err) {
        if (!mounted) return;

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

    void initCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [onResult]);

  // Clean up preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setState({
            status: "error",
            message: t`Failed to capture photo`,
          });
          return;
        }

        void blob.arrayBuffer().then((arrayBuffer) => {
          setCapturedImage(arrayBuffer);

          // Create preview URL
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);

          // Stop the camera stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
          }
        });
      },
      "image/jpeg",
      0.9,
    );
  }

  function retakePhoto() {
    // Clean up preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setCapturedImage(null);

    // Restart camera
    setState({ status: "initializing" });

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          return videoRef.current.play();
        }
      })
      .then(() => {
        setState({ status: "camera-ready" });
      })
      .catch((err) => {
        console.error("Failed to restart camera:", err);
        onResult({
          type: "error",
          message: t`Failed to restart camera`,
        });
      });
  }

  // Check if model has been downloaded before (cached in IndexedDB)
  function hasModelBeenDownloaded(): boolean {
    // Check localStorage flag that we set after first successful download
    return localStorage.getItem("trizum-ai-model-downloaded") === "true";
  }

  function markModelAsDownloaded() {
    localStorage.setItem("trizum-ai-model-downloaded", "true");
  }

  async function doProcess() {
    if (!capturedImage) return;

    setState({ status: "processing" });

    try {
      const result = await processImage(capturedImage);

      setState({ status: "success" });

      // Show success briefly then return result
      setTimeout(() => {
        onResult({ type: "success", data: result });
      }, 500);
    } catch (err) {
      console.error("Processing error:", err);
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : t`Failed to process receipt`,
      });
    }
  }

  // Handle model ready/error when waiting - triggers processing or error state

  useEffect(() => {
    if (!waitingForModel) return;

    if (processorStatus === "ready") {
      setWaitingForModel(false);
      markModelAsDownloaded();
      void doProcess();
    } else if (processorStatus === "error") {
      setWaitingForModel(false);
      console.error("Model loading error:", processorError);
      setState({
        status: "error",
        message: processorError || t`Failed to load AI model`,
      });
    }
    // doProcess depends on capturedImage, processImage, onResult which are stable or state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForModel, processorStatus]);

  function startModelDownload() {
    setState({ status: "loading-model" });
    setWaitingForModel(true);
    loadModel();
  }

  function confirmDownload() {
    startModelDownload();
  }

  function cancelDownload() {
    setWaitingForModel(false);
    // Go back to preview state
    setState({ status: "camera-ready" });
  }

  async function processPhoto() {
    if (!capturedImage) return;

    // Load model if not ready
    if (!isReady) {
      // If model hasn't been downloaded before, show confirmation first
      if (!hasModelBeenDownloaded()) {
        setState({ status: "confirm-download" });
        return;
      }

      startModelDownload();
      return;
    }

    await doProcess();
  }

  // Update state message based on processor progress

  useEffect(() => {
    if (state.status === "loading-model" && progress) {
      let message = t`Loading AI model...`;
      let downloadProgress: number | undefined;

      if (progress.status === "download" && progress.progress !== undefined) {
        const percent = Math.round(progress.progress);
        downloadProgress = percent;
        message = t`Downloading model...`;
      } else if (progress.status === "init") {
        message = t`Initializing model...`;
      }

      setState({ status: "loading-model", message, downloadProgress });
    }
  }, [state.status, progress]);

  const showCamera = !capturedImage;
  const showPreview = !!capturedImage;

  return (
    <div className="relative flex flex-1 flex-col bg-black">
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera feed */}
      <video
        ref={videoRef}
        className={cn("h-full w-full object-cover", showPreview && "hidden")}
        playsInline
        muted
        autoPlay
      />

      {/* Captured image preview */}
      {showPreview && previewUrl && (
        <img src={previewUrl} alt="" className="h-full w-full object-contain" />
      )}

      {/* Overlay with status */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {/* Top area */}
        <div className="flex-1" />

        {/* Status area */}
        <div className="flex items-center justify-center p-8">
          <AnimatePresence mode="wait">
            {state.status === "initializing" && (
              <motion.div
                key="initializing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2"
              >
                <TrizumSpinner size={48} className="text-white" />
                <span className="text-sm text-white">
                  <Trans>Starting camera...</Trans>
                </span>
              </motion.div>
            )}

            {state.status === "confirm-download" && (
              <motion.div
                key="confirm-download"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="pointer-events-auto mx-4 flex max-w-sm flex-col gap-4 rounded-2xl bg-accent-900/95 p-6 text-white shadow-xl backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-accent-700">
                    <Icon name="#lucide/download" size={20} />
                  </div>
                  <h3 className="text-lg font-semibold">
                    <Trans>Download AI Model?</Trans>
                  </h3>
                </div>
                <p className="text-sm text-accent-300">
                  <Trans>
                    To scan receipts, we need to download an AI model (~100MB).
                    This only happens once and the model runs locally on your
                    device for privacy.
                  </Trans>
                </p>
                <p className="text-sm text-accent-400">
                  <Trans>
                    We recommend using Wi-Fi to avoid mobile data charges.
                  </Trans>
                </p>
                <div className="flex gap-3">
                  <Button
                    onPress={cancelDownload}
                    color="transparent"
                    className="flex-1 text-white"
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button
                    onPress={confirmDownload}
                    color="accent"
                    className="flex-1"
                  >
                    <Trans>Download</Trans>
                  </Button>
                </div>
              </motion.div>
            )}

            {state.status === "loading-model" && (
              <motion.div
                key="loading-model"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3"
              >
                <TrizumSpinner size={48} className="text-white" />
                <span className="text-sm text-white">
                  {state.message || <Trans>Loading AI model...</Trans>}
                </span>
                {state.downloadProgress !== undefined && (
                  <div className="w-48">
                    <div className="h-2 overflow-hidden rounded-full bg-white/20">
                      <motion.div
                        className="h-full bg-accent-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${state.downloadProgress}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                    </div>
                    <span className="mt-1 block text-center text-xs text-white/70">
                      {state.downloadProgress}%
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {state.status === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2"
              >
                <TrizumSpinner size={48} className="text-white" />
                <span className="text-sm text-white">
                  <Trans>Analyzing receipt...</Trans>
                </span>
              </motion.div>
            )}

            {state.status === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0.4 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="flex size-16 items-center justify-center rounded-full bg-success-500">
                  <Icon name="#lucide/check" size={40} className="text-white" />
                </div>
                <span className="text-sm text-white">
                  <Trans>Receipt scanned!</Trans>
                </span>
              </motion.div>
            )}

            {state.status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="pointer-events-auto flex flex-col items-center gap-3"
              >
                <div className="flex size-16 items-center justify-center rounded-full bg-danger-500">
                  <Icon name="#lucide/x" size={40} className="text-white" />
                </div>
                <span className="max-w-64 text-center text-sm text-white">
                  {state.message}
                </span>
                <Button onPress={retakePhoto} className="mt-2">
                  <Trans>Try again</Trans>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom controls */}
        <div className="pointer-events-auto bg-gradient-to-t from-black/70 to-transparent pb-safe">
          <div className="flex items-center justify-center gap-6 px-6 pb-8 pt-12">
            {showCamera && state.status === "camera-ready" && (
              <>
                <Button
                  onPress={() => onResult({ type: "cancelled" })}
                  color="transparent"
                  className="text-white"
                >
                  <Trans>Cancel</Trans>
                </Button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="flex size-20 items-center justify-center rounded-full border-4 border-white bg-white/20 transition-transform active:scale-95"
                  aria-label={t`Capture photo`}
                >
                  <div className="size-16 rounded-full bg-white" />
                </button>
                <div className="w-16" /> {/* Spacer for alignment */}
              </>
            )}

            {showPreview &&
              state.status !== "error" &&
              state.status !== "loading-model" &&
              state.status !== "processing" &&
              state.status !== "success" &&
              state.status !== "confirm-download" && (
                <>
                  <Button
                    onPress={retakePhoto}
                    color="transparent"
                    className="text-white"
                  >
                    <Icon name="#lucide/rotate-ccw" className="mr-2 h-4 w-4" />
                    <Trans>Retake</Trans>
                  </Button>

                  <Button
                    onPress={() => void processPhoto()}
                    color="accent"
                    className="px-8"
                  >
                    <Icon name="#lucide/scan" className="mr-2 h-4 w-4" />
                    <Trans>Scan</Trans>
                  </Button>
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
