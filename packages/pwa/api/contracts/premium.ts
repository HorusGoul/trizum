import { createRoute } from "@hono/zod-openapi";
import type { ZodType } from "zod";
import {
  partyBoostErrorResponseSchema,
  partyBoostQuerySchema,
  partyBoostRequestSchema,
  partyBoostStatusSchema,
} from "../../src/lib/api/premiumContract";

const jsonContent = <Schema extends ZodType>(schema: Schema) => ({
  content: {
    "application/json": {
      schema,
    },
  },
});

const successResponse = {
  ...jsonContent(partyBoostStatusSchema),
  description: "The current user's Premium and Party Boost state.",
};

const badRequestResponse = {
  ...jsonContent(partyBoostErrorResponseSchema),
  description: "The Party Boost request was invalid.",
};

const unauthorizedResponse = {
  ...jsonContent(partyBoostErrorResponseSchema),
  description: "The request does not have an authenticated trizum account.",
};

const forbiddenResponse = {
  ...jsonContent(partyBoostErrorResponseSchema),
  description: "The account is not eligible to access this Party Boost.",
};

const conflictResponse = {
  ...jsonContent(partyBoostErrorResponseSchema),
  description: "The requested Party Boost assignment conflicts with its current state.",
};

const unavailableResponse = {
  ...jsonContent(partyBoostErrorResponseSchema),
  description: "Party Boost eligibility could not be verified.",
};

export const getPartyBoostRoute = createRoute({
  method: "get",
  operationId: "getPartyBoostStatus",
  path: "/party-boost",
  request: {
    query: partyBoostQuerySchema,
  },
  responses: {
    200: successResponse,
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    503: unavailableResponse,
  },
  summary: "Get Party Boost status",
  tags: ["Premium"],
});

export const activatePartyBoostRoute = createRoute({
  method: "put",
  operationId: "activatePartyBoost",
  path: "/party-boost",
  request: {
    body: {
      content: {
        "application/json": {
          schema: partyBoostRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: successResponse,
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: conflictResponse,
    503: unavailableResponse,
  },
  summary: "Activate or transfer Party Boost",
  tags: ["Premium"],
});
