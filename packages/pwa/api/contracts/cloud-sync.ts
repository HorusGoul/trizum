import { createRoute } from "@hono/zod-openapi";
import {
  cloudSyncErrorResponseSchema,
  cloudUserSettingsInputSchema,
  getCloudUserSettingsResponseSchema,
  saveCloudUserSettingsResponseSchema,
} from "../../src/lib/api/cloudSyncContract";

const errorContent = { "application/json": { schema: cloudSyncErrorResponseSchema } };

export const getCloudUserSettingsRoute = createRoute({
  method: "get",
  operationId: "getCloudUserSettings",
  path: "/settings",
  responses: {
    200: {
      description: "The account's Cloud Sync settings, or null before setup.",
      content: { "application/json": { schema: getCloudUserSettingsResponseSchema } },
    },
    401: { description: "Sign-in is required.", content: errorContent },
    500: { description: "Settings could not be loaded.", content: errorContent },
  },
  summary: "Get Cloud Sync settings",
  tags: ["Cloud Sync"],
});

export const saveCloudUserSettingsRoute = createRoute({
  method: "put",
  operationId: "saveCloudUserSettings",
  path: "/settings",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: cloudUserSettingsInputSchema } },
    },
  },
  responses: {
    200: {
      description:
        "The saved settings. Repeated setup preserves the original document and timestamp.",
      content: { "application/json": { schema: saveCloudUserSettingsResponseSchema } },
    },
    400: { description: "Invalid settings input.", content: errorContent },
    401: { description: "Sign-in is required.", content: errorContent },
    409: { description: "A different party list is already configured.", content: errorContent },
    500: { description: "Settings could not be saved.", content: errorContent },
  },
  summary: "Set up Cloud Sync",
  tags: ["Cloud Sync"],
});
