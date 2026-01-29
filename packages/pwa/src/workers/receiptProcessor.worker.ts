/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  AutoTokenizer,
  AutoModelForCausalLM,
  env,
} from "@huggingface/transformers";
import Tesseract from "tesseract.js";

// Configure transformers.js (for LLM only)
env.allowLocalModels = false;
env.useBrowserCache = true;

const LLM_MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";

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

let ocrWorker: Tesseract.Worker | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let llmModel: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let llmTokenizer: any = null;

function makeLLMProgressCallback() {
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
      model: "llm",
      status: progress.status,
      name: progress.name,
      file: progress.file,
      progress: progress.progress,
      loaded: progress.loaded,
      total: progress.total,
    } satisfies WorkerResponse);
  };
}

function makeTesseractLogger() {
  return (message: Tesseract.LoggerMessage) => {
    self.postMessage({
      type: "progress",
      model: "ocr",
      // Map tesseract's "recognizing text" to "progress" for consistency with the UI
      status:
        message.status === "recognizing text" ? "progress" : message.status,
      progress: message.progress * 100, // tesseract reports 0-1, our UI expects 0-100
    } satisfies WorkerResponse);
  };
}

async function loadModel() {
  if (ocrWorker && llmModel && llmTokenizer) {
    self.postMessage({ type: "ready" } satisfies WorkerResponse);
    return;
  }

  try {
    // Load tesseract.js OCR worker
    if (!ocrWorker) {
      ocrWorker = await Tesseract.createWorker("eng", undefined, {
        logger: makeTesseractLogger(),
      });
    }

    // Load Qwen2.5 LLM model + tokenizer in parallel
    if (!llmModel || !llmTokenizer) {
      const llmProgressCb = makeLLMProgressCallback();
      [llmModel, llmTokenizer] = await Promise.all([
        AutoModelForCausalLM.from_pretrained(LLM_MODEL_ID, {
          dtype: "q4f16",
          progress_callback: llmProgressCb,
        }),
        AutoTokenizer.from_pretrained(LLM_MODEL_ID, {
          progress_callback: llmProgressCb,
        }),
      ]);
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
 * Run tesseract.js OCR on an image to extract text.
 */
async function runOCR(imageData: ArrayBuffer): Promise<string> {
  if (!ocrWorker) {
    throw new Error("Tesseract worker not initialized");
  }

  const blob = new Blob([imageData], { type: "image/jpeg" });
  const result = await ocrWorker.recognize(blob);
  return result.data.text;
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
  if (!llmModel || !llmTokenizer) {
    return { merchant: null, total: null, date: null };
  }

  for (let attempt = 0; attempt < MAX_LLM_ATTEMPTS; attempt++) {
    try {
      const messages = LLM_MESSAGES[attempt](rawText);

      // Apply chat template to get the full prompt string
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const chatText: string = llmTokenizer.apply_chat_template(messages, {
        tokenize: false,
        add_generation_prompt: true,
      });

      // Tokenize the prompt
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const inputs = llmTokenizer(chatText, { return_tensors: "pt" });

      // Generate response
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const outputIds = await llmModel.generate({
        ...inputs,
        max_new_tokens: 128,
        do_sample: attempt > 0,
        temperature: attempt > 0 ? 0.3 : undefined,
      });

      // Slice off the input tokens to get only generated tokens
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const inputLen: number = inputs.input_ids.dims[1];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const newTokens = outputIds.slice(null, [inputLen, null]);

      // Decode generated tokens
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const decoded: string[] = llmTokenizer.batch_decode(newTokens, {
        skip_special_tokens: true,
      });
      const generated: string = decoded[0];

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
  if (!ocrWorker) {
    self.postMessage({
      type: "error",
      error: "Model not loaded",
    } satisfies WorkerResponse);
    return;
  }

  try {
    // Run tesseract.js OCR on the image
    const rawText = await runOCR(imageData);

    // Extract structured data using LLM (retries on parse failure)
    const extractedData = await extractWithLLM(rawText);

    // If no meaningful data was extracted, report an error
    if (
      !extractedData.merchant &&
      extractedData.total === null &&
      !extractedData.date
    ) {
      self.postMessage({
        type: "error",
        error: "no_receipt_found",
      } satisfies WorkerResponse);
      return;
    }

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
