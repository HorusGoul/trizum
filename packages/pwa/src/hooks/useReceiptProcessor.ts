import { useEffect, useRef, useState } from "react";
import type { ExtractedReceiptData } from "#src/lib/receiptExtraction.js";

type ProcessorStatus = "idle" | "loading" | "ready" | "processing" | "error";

interface ProgressInfo {
  status: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

interface ProgressMessage {
  type: "progress";
  status: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

interface ReadyMessage {
  type: "ready";
}

interface ResultMessage {
  type: "result";
  data: ExtractedReceiptData;
}

interface ErrorMessage {
  type: "error";
  error: string;
}

type WorkerMessage =
  | ProgressMessage
  | ReadyMessage
  | ResultMessage
  | ErrorMessage;

interface UseReceiptProcessorResult {
  /** Current status of the processor */
  status: ProcessorStatus;
  /** Progress information during model loading */
  progress: ProgressInfo | null;
  /** Error message if status is "error" */
  error: string | null;
  /** Load the AI model (call this before processing) */
  loadModel: () => void;
  /** Process an image and extract receipt data */
  processImage: (imageData: ArrayBuffer) => Promise<ExtractedReceiptData>;
  /** Whether the model is ready to process images */
  isReady: boolean;
  /** Whether the model is currently loading or processing */
  isLoading: boolean;
}

/**
 * Hook for processing receipt images using local AI.
 * Uses a Web Worker to avoid blocking the main thread.
 */
export function useReceiptProcessor(): UseReceiptProcessorResult {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<ProcessorStatus>("idle");
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Store pending promise resolvers for async communication
  const pendingResolveRef = useRef<
    ((data: ExtractedReceiptData) => void) | null
  >(null);
  const pendingRejectRef = useRef<((error: Error) => void) | null>(null);

  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(
      new URL("../workers/receiptProcessor.worker.ts", import.meta.url),
      { type: "module" },
    );

    // Set up message handler
    workerRef.current.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      switch (message.type) {
        case "progress":
          setProgress({
            status: message.status,
            name: message.name,
            file: message.file,
            progress: message.progress,
            loaded: message.loaded,
            total: message.total,
          });
          break;

        case "ready":
          setStatus("ready");
          setProgress(null);
          break;

        case "result":
          setStatus("ready");
          if (pendingResolveRef.current) {
            pendingResolveRef.current(message.data);
            pendingResolveRef.current = null;
            pendingRejectRef.current = null;
          }
          break;

        case "error":
          setStatus("error");
          setError(message.error);
          if (pendingRejectRef.current) {
            pendingRejectRef.current(new Error(message.error));
            pendingResolveRef.current = null;
            pendingRejectRef.current = null;
          }
          break;
      }
    };

    workerRef.current.onerror = (event) => {
      console.error("Receipt processor worker error:", event);
      setStatus("error");
      setError("Worker error occurred");
      if (pendingRejectRef.current) {
        pendingRejectRef.current(new Error("Worker error occurred"));
        pendingResolveRef.current = null;
        pendingRejectRef.current = null;
      }
    };

    // Cleanup
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  function loadModel() {
    if (!workerRef.current) return;
    if (status === "loading" || status === "ready") return;

    setStatus("loading");
    setError(null);
    workerRef.current.postMessage({ type: "load" });
  }

  async function processImage(
    imageData: ArrayBuffer,
  ): Promise<ExtractedReceiptData> {
    if (!workerRef.current) {
      throw new Error("Worker not initialized");
    }

    if (status !== "ready") {
      throw new Error("Model not ready. Call loadModel() first.");
    }

    setStatus("processing");
    setError(null);

    return new Promise((resolve, reject) => {
      pendingResolveRef.current = resolve;
      pendingRejectRef.current = reject;
      workerRef.current!.postMessage({ type: "process", imageData }, [
        imageData,
      ]);
    });
  }

  return {
    status,
    progress,
    error,
    loadModel,
    processImage,
    isReady: status === "ready",
    isLoading: status === "loading" || status === "processing",
  };
}
