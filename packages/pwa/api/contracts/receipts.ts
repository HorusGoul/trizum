import { createRoute } from "@hono/zod-openapi";
import {
  receiptSchema,
  receiptRequestSchema,
  receiptErrorResponseSchema,
} from "../../src/lib/api/receiptContract";

const error = {
  description: "Receipt analysis could not be completed.",
  content: { "application/json": { schema: receiptErrorResponseSchema } },
};

export const analyzeReceiptRoute = createRoute({
  method: "post",
  path: "/receipts",
  operationId: "analyzeReceipt",
  summary: "Extract receipt information for a Boosted party",
  tags: ["Premium"],
  request: {
    body: { required: true, content: { "application/json": { schema: receiptRequestSchema } } },
  },
  responses: {
    200: {
      description: "Printed receipt information; unknown fields are null.",
      content: { "application/json": { schema: receiptSchema } },
    },
    400: error,
    401: error,
    403: error,
    413: error,
    429: error,
    503: error,
  },
});
