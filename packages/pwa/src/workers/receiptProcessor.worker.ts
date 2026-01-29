/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { pipeline, env } from "@huggingface/transformers";

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

interface ConfigureMessage {
  type: "configure";
  hfProxyUrl: string;
}

interface ProcessImageMessage {
  type: "process";
  imageData: ArrayBuffer;
}

interface LoadModelMessage {
  type: "load";
}

type WorkerMessage = ConfigureMessage | ProcessImageMessage | LoadModelMessage;

interface ProgressEvent {
  type: "progress";
  model?: "ocr" | "llm";
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let llmPipeline: any = null;

function makeProgressCallback(model: "ocr" | "llm") {
  return (progress: {
    status: string;
    name?: string;
    file?: string;
    progress?: number;
    loaded?: number;
    total?: number;
  }) => {
    self.postMessage({
      type: "progress",
      model,
      status: progress.status,
      name: progress.name,
      file: progress.file,
      progress: progress.progress,
      loaded: progress.loaded,
      total: progress.total,
    } satisfies WorkerResponse);
  };
}

async function loadModel() {
  if (ocrPipeline && llmPipeline) {
    self.postMessage({ type: "ready" } satisfies WorkerResponse);
    return;
  }

  try {
    // Load OCR model (TrOCR for printed text)
    if (!ocrPipeline) {
      ocrPipeline = await pipeline(
        "image-to-text",
        "Xenova/trocr-small-printed",
        { progress_callback: makeProgressCallback("ocr") },
      );
    }

    // Load LLM model (instruction-tuned T5 for structured extraction)
    if (!llmPipeline) {
      llmPipeline = await pipeline(
        "text2text-generation",
        "Xenova/LaMini-Flan-T5-248M",
        { progress_callback: makeProgressCallback("llm") },
      );
    }

    self.postMessage({ type: "ready" } satisfies WorkerResponse);
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.message}\n${error.stack ?? ""}`
        : String(error);
    self.postMessage({
      type: "error",
      error: message,
    } satisfies WorkerResponse);
  }
}

/**
 * Parse LLM output string into structured receipt data.
 * Returns null if parsing fails (triggers retry with a different prompt).
 */
function parseLLMOutput(output: string): {
  merchant: string | null;
  total: number | null;
  date: string | null;
} | null {
  const trimmed = output.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Try extracting a JSON object from the string
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // fall through
      }
    }
    // Wrap bare key-value pairs with braces (model sometimes omits {})
    if (parsed === undefined && trimmed.includes('"')) {
      try {
        parsed = JSON.parse("{" + trimmed + "}");
      } catch {
        // fall through
      }
    }
    if (parsed === undefined) return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  const merchant =
    typeof obj.merchant === "string" && obj.merchant ? obj.merchant : null;
  const date = typeof obj.date === "string" && obj.date ? obj.date : null;

  let total: number | null = null;
  if (typeof obj.total === "number" && !isNaN(obj.total)) {
    total = obj.total;
  } else if (typeof obj.total === "string") {
    const value = parseFloat(obj.total);
    if (!isNaN(value) && value > 0) total = value;
  }

  return { merchant, total, date };
}

const MAX_LLM_ATTEMPTS = 3;

const LLM_PROMPTS = [
  // Attempt 1: direct instruction with example
  (text: string) =>
    `Extract the merchant name, total amount, and date from this receipt text. Return ONLY a JSON object with keys "merchant", "total", "date". Use null for any field you cannot find. The total must be a number.

Example output: {"merchant": "STARBUCKS", "total": 5.99, "date": "01/15/2025"}

Receipt text:
${text}

JSON:`,

  // Attempt 2: example-guided
  (text: string) =>
    `Given a receipt, extract data as JSON. Example output: {"merchant": "WALMART", "total": 42.99, "date": "01/15/2025"}

Receipt text:
${text}

Output:`,

  // Attempt 3: simpler framing
  (text: string) =>
    `What is the store name, total price, and date on this receipt? Answer as JSON with keys "merchant", "total", "date". Use null if unknown.

${text}`,
] as const;

/**
 * Use the LLM to extract structured data from OCR text.
 * Retries up to MAX_LLM_ATTEMPTS times with different prompts if JSON parsing fails.
 */
async function extractWithLLM(rawText: string): Promise<{
  merchant: string | null;
  total: number | null;
  date: string | null;
}> {
  if (!llmPipeline) {
    return { merchant: null, total: null, date: null };
  }

  for (let attempt = 0; attempt < MAX_LLM_ATTEMPTS; attempt++) {
    try {
      const prompt = LLM_PROMPTS[attempt](rawText);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const result = await llmPipeline(prompt, {
        max_new_tokens: 128,
        do_sample: attempt > 0, // use sampling on retries for variety
        temperature: attempt > 0 ? 0.3 : undefined,
      });

      const generated: string = Array.isArray(result)
        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          ((result[0]?.generated_text as string) ?? "")
        : ((result as { generated_text?: string }).generated_text ?? "");

      const parsed = parseLLMOutput(generated);
      if (parsed) return parsed;

      console.warn(
        `LLM attempt ${attempt + 1}/${MAX_LLM_ATTEMPTS} returned unparseable output:`,
        generated,
      );
    } catch (error) {
      console.warn(
        `LLM attempt ${attempt + 1}/${MAX_LLM_ATTEMPTS} threw:`,
        error,
      );
    }
  }

  // All attempts failed — return empty result
  return { merchant: null, total: null, date: null };
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

    // Extract structured data using LLM (retries on parse failure)
    const extractedData = await extractWithLLM(rawText);

    self.postMessage({
      type: "result",
      data: {
        ...extractedData,
        rawText,
      },
    } satisfies WorkerResponse);
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.message}\n${error.stack ?? ""}`
        : String(error);
    self.postMessage({
      type: "error",
      error: message,
    } satisfies WorkerResponse);
  }
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "configure":
      // Proxy HuggingFace requests through our Cloudflare Worker to avoid CORS issues.
      // The URL is sent from the main thread so it works across web, previews, and mobile builds.
      env.remoteHost = message.hfProxyUrl;
      env.remotePathTemplate = "{model}/resolve/{revision}/";
      break;
    case "load":
      await loadModel();
      break;
    case "process":
      await processImage(message.imageData);
      break;
  }
};
