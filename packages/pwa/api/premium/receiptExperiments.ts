import { z } from "zod";
import { receiptSchema } from "../../src/lib/api/receiptContract";
import type { ReceiptAI } from "./receiptExtraction";

// Temporary preview comparison; the default still extracts every item.
export const receiptExperimentSchema = z.enum(["baseline", "suggestions-only"]);

const suggestionsSchema = receiptSchema.extend({ items: receiptSchema.shape.items.max(0) });

export function createReceiptExperiment(
  ai: ReceiptAI,
  experiment: z.infer<typeof receiptExperimentSchema>,
): ReceiptAI {
  if (experiment === "baseline") return ai;

  return {
    run(model, input, options) {
      if (model !== "@cf/google/gemma-4-26b-a4b-it" || !("messages" in input))
        return ai.run(model, input, options);

      return ai.run(
        model,
        {
          ...input,
          messages: input.messages?.map((message) =>
            message.role === "system"
              ? {
                  ...message,
                  content: z
                    .string()
                    .parse(message.content)
                    .replace(
                      /^items:.*$/m,
                      "items: this request needs title, total and currency suggestions only. Read the purchased items to ground activity titles, but do not transcribe their quantities or prices. Return items as []. All other receipt fields and rules remain required.",
                    ),
                }
              : message,
          ),
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "receipt",
              strict: true,
              schema: z.toJSONSchema(suggestionsSchema),
            },
          },
        },
        options,
      );
    },
  };
}
