import { createRoute } from "@hono/zod-openapi";
import {
  migrationBadRequestSchema,
  migrationDataSchema,
  migrationErrorResponseSchema,
  migrationQuerySchema,
} from "../../src/lib/api/migrationContract";

export const migrateTricountRoute = createRoute({
  method: "get",
  operationId: "migrateTricount",
  path: "/",
  request: { query: migrationQuerySchema },
  responses: {
    200: {
      description: "Party, expenses and attachment references ready for import.",
      content: { "application/json": { schema: migrationDataSchema } },
    },
    400: {
      description: "The Tricount key is missing.",
      content: { "text/plain": { schema: migrationBadRequestSchema } },
    },
    500: {
      description: "Tricount data could not be retrieved or converted.",
      content: { "application/json": { schema: migrationErrorResponseSchema } },
    },
  },
  summary: "Import a Tricount",
  tags: ["Migration"],
});
