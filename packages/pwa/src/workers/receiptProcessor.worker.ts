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
    // Load OCR model (TrOCR base for better printed text recognition)
    if (!ocrPipeline) {
      ocrPipeline = await pipeline(
        "image-to-text",
        "Xenova/trocr-base-printed",
        { progress_callback: makeProgressCallback("ocr") },
      );
    }

    // Load LLM model (Qwen2.5 0.5B instruction-tuned, q4f16 quantized)
    if (!llmPipeline) {
      llmPipeline = await pipeline(
        "text-generation",
        "onnx-community/Qwen2.5-0.5B-Instruct",
        {
          dtype: "q4f16",
          progress_callback: makeProgressCallback("llm"),
        },
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

  // Try parsing strategies in order:
  // 1. Direct JSON parse
  // 2. Extract {...} block from surrounding text
  // 3. Wrap bare key-value pairs with braces (model sometimes omits {})
  let parsed: unknown;
  const candidates = [
    trimmed,
    trimmed.match(/\{[\s\S]*\}/)?.[0],
    trimmed.includes('"') ? `{${trimmed}}` : undefined,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      parsed = JSON.parse(candidate);
      break;
    } catch {
      // try next strategy
    }
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

const SYSTEM_PROMPT = `You extract structured data from receipt text. Return ONLY a valid JSON object with keys "merchant", "total", "date". Rules:
- "merchant": store/restaurant name as a string, or null
- "total": final amount as a number (not string), or null
- "date": date string in any format found, or null
Example: {"merchant": "STARBUCKS", "total": 5.99, "date": "01/15/2025"}`;

const MAX_LLM_ATTEMPTS = 3;

const LLM_MESSAGES: ((text: string) => { role: string; content: string }[])[] =
  [
    // Attempt 1: standard chat
    (text: string) => [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Extract data from this receipt:\n\n${text}` },
    ],

    // Attempt 2: more explicit
    (text: string) => [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Parse this receipt text and return JSON with merchant, total, date:\n\n${text}`,
      },
    ],

    // Attempt 3: few-shot with example exchange
    (text: string) => [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          "Extract data from this receipt:\n\nWALMART\nMILK 3.49\nBREAD 2.99\nTOTAL 6.48\n01/20/2025",
      },
      {
        role: "assistant",
        content: '{"merchant": "WALMART", "total": 6.48, "date": "01/20/2025"}',
      },
      { role: "user", content: `Extract data from this receipt:\n\n${text}` },
    ],
  ];

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
      const messages = LLM_MESSAGES[attempt](rawText);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const result = await llmPipeline(messages, {
        max_new_tokens: 128,
        do_sample: attempt > 0,
        temperature: attempt > 0 ? 0.3 : undefined,
        return_full_text: false,
      });

      // text-generation pipeline returns [{generated_text: "..."}]

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
