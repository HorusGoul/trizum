import { z } from "zod";
import { partyDocumentIdSchema } from "./premiumContract";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "../locales";

export const MAX_RECEIPT_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_RECEIPT_REQUEST_BYTES = Math.ceil(MAX_RECEIPT_IMAGE_BYTES / 3) * 4 + 1024;

// Decimal strings preserve printed precision, including weighted item prices.
const decimalSchema = z.string().regex(/^-?(0|[1-9]\d{0,11})(\.\d{1,6})?$/);

export const receiptSchema = z.strictObject({
  merchantName: z.string().trim().min(1).max(200).nullable(),
  titleSuggestions: z.array(z.string().trim().min(1).max(50)).max(3),
  total: decimalSchema.nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  items: z
    .array(
      z.strictObject({
        name: z.string().trim().min(1).max(300),
        quantity: z.string().trim().min(1).max(100).nullable(),
        unitPrice: decimalSchema.nullable(),
        lineTotal: decimalSchema.nullable(),
      }),
    )
    .max(300),
});

export function isReceiptImage(value: string) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);

  if (!match || match[2].length % 4 !== 0) return false;
  const binary = atob(match[2]);

  if (binary.length === 0 || binary.length > MAX_RECEIPT_IMAGE_BYTES) return false;

  switch (match[1]) {
    case "jpeg":
      return binary.startsWith("\xff\xd8\xff");
    case "png":
      return binary.startsWith("\x89PNG\r\n\x1a\n");
    case "webp":
      return binary.startsWith("RIFF") && binary.slice(8, 12) === "WEBP";
    default:
      return false;
  }
}

export const receiptRequestSchema = z.strictObject({
  partyDocumentId: partyDocumentIdSchema,
  locale: z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE),
  image: z
    .string()
    .max(MAX_RECEIPT_REQUEST_BYTES - 1024)
    .refine(isReceiptImage, "Invalid receipt image."),
});

export const receiptErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum([
      "invalid_receipt",
      "boost_required",
      "membership_required",
      "unauthorized",
      "rate_limited",
      "unavailable",
    ]),
    message: z.string(),
  }),
});

export type Receipt = z.infer<typeof receiptSchema>;
