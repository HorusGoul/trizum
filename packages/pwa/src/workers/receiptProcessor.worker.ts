/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { pipeline, env } from "@huggingface/transformers";

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

// Proxy HuggingFace requests through our Cloudflare Worker to avoid CORS issues.
// Uses build-time env var so it works in both web and Capacitor mobile builds.
const apiUrl = import.meta.env.VITE_APP_API_URL as string;
env.remoteHost = `${apiUrl}/api/hf/models/`;
env.remotePathTemplate = "{model}/resolve/{revision}/";

interface ProcessImageMessage {
  type: "process";
  imageData: ArrayBuffer;
}

interface LoadModelMessage {
  type: "load";
}

type WorkerMessage = ProcessImageMessage | LoadModelMessage;

interface ProgressEvent {
  type: "progress";
  status: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

interface ReadyEvent {
  type: "ready";
}

interface ResultEvent {
  type: "result";
  data: {
    merchant: string | null;
    total: number | null;
    date: string | null;
    rawText: string;
  };
}

interface ErrorEvent {
  type: "error";
  error: string;
}

type WorkerResponse = ProgressEvent | ReadyEvent | ResultEvent | ErrorEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ocrPipeline: any = null;

async function loadModel() {
  if (ocrPipeline) {
    self.postMessage({ type: "ready" } satisfies WorkerResponse);
    return;
  }

  try {
    // Use TrOCR for receipt text extraction
    // This model is optimized for printed text like receipts
    ocrPipeline = await pipeline(
      "image-to-text",
      "Xenova/trocr-small-printed",
      {
        progress_callback: (progress: {
          status: string;
          name?: string;
          file?: string;
          progress?: number;
          loaded?: number;
          total?: number;
        }) => {
          self.postMessage({
            type: "progress",
            status: progress.status,
            name: progress.name,
            file: progress.file,
            progress: progress.progress,
            loaded: progress.loaded,
            total: progress.total,
          } satisfies WorkerResponse);
        },
      },
    );

    self.postMessage({ type: "ready" } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({
      type: "error",
      error:
        error instanceof Error ? error.message : "Failed to load OCR model",
    } satisfies WorkerResponse);
  }
}

async function processImage(imageData: ArrayBuffer) {
  if (!ocrPipeline) {
    self.postMessage({
      type: "error",
      error: "Model not loaded",
    } satisfies WorkerResponse);
    return;
  }

  try {
    // Convert ArrayBuffer to Blob URL for the pipeline
    const blob = new Blob([imageData], { type: "image/jpeg" });
    const imageUrl = URL.createObjectURL(blob);

    // Run OCR on the image
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const result = await ocrPipeline(imageUrl);

    // Clean up the blob URL
    URL.revokeObjectURL(imageUrl);

    // Extract the text from the result
    const rawText: string = Array.isArray(result)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
        result.map((r: any) => r.generated_text ?? "").join("\n")
      : // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (result.generated_text as string) || "";

    // Parse the extracted text to find receipt data
    const extractedData = parseReceiptText(rawText);

    self.postMessage({
      type: "result",
      data: {
        ...extractedData,
        rawText,
      },
    } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "Failed to process image",
    } satisfies WorkerResponse);
  }
}

function parseReceiptText(text: string): {
  merchant: string | null;
  total: number | null;
  date: string | null;
} {
  // Normalize the text
  const normalizedText = text.toUpperCase();

  // Extract merchant name (usually at the top of the receipt)
  // Take the first non-empty line that's not a date or number
  const lines = text.split(/\n/).filter((line) => line.trim());
  let merchant: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip if it looks like a date or is mostly numbers
    if (
      /^\d{1,2}[/\-.]?\d{1,2}[/\-.]?\d{2,4}/.test(trimmed) ||
      /^\d+[.,]?\d*$/.test(trimmed)
    ) {
      continue;
    }
    // Skip common header words
    if (
      /^(RECEIPT|INVOICE|BILL|DATE|TIME|TOTAL|SUBTOTAL|TAX|CASH|CARD|CHANGE)$/i.test(
        trimmed,
      )
    ) {
      continue;
    }
    if (trimmed.length >= 2) {
      merchant = trimmed;
      break;
    }
  }

  // Extract total amount
  // Look for patterns like "TOTAL: $XX.XX" or "TOTAL XX.XX" or just numbers near "TOTAL"
  let total: number | null = null;

  // Try various total patterns
  const totalPatterns = [
    /TOTAL[:\s]*[$€£]?\s*(\d+[.,]\d{2})/i,
    /AMOUNT[:\s]*[$€£]?\s*(\d+[.,]\d{2})/i,
    /DUE[:\s]*[$€£]?\s*(\d+[.,]\d{2})/i,
    /[$€£]\s*(\d+[.,]\d{2})\s*$/m,
    /(\d+[.,]\d{2})\s*(USD|EUR|GBP)?$/im,
  ];

  for (const pattern of totalPatterns) {
    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      const value = parseFloat(match[1].replace(",", "."));
      if (!isNaN(value) && value > 0) {
        total = value;
        break;
      }
    }
  }

  // Extract date
  // Look for common date formats
  let date: string | null = null;

  const datePatterns = [
    // MM/DD/YYYY or DD/MM/YYYY
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/,
    // YYYY-MM-DD
    /(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/,
    // Month name formats
    /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{1,2}),?\s+(\d{2,4})/i,
    /(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*,?\s+(\d{2,4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      // Return the matched date string as-is for now
      // The consumer will need to parse it based on locale
      date = match[0];
      break;
    }
  }

  return { merchant, total, date };
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "load":
      await loadModel();
      break;
    case "process":
      await processImage(message.imageData);
      break;
  }
};
