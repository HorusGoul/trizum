import { describe, expect, test } from "vite-plus/test";
import app from "./sentryWorker";

describe("Worker observability probe", () => {
  test("is unavailable outside the preview environment", async () => {
    for (const environment of [undefined, "production"]) {
      const response = await app.request(
        "https://trizum.test/api/observability-check",
        { method: "POST" },
        { SENTRY_ENVIRONMENT: environment },
      );

      expect(response.status).toBe(404);
    }
  });

  test("exercises the unhandled error path in previews", async () => {
    const response = await app.request(
      "https://trizum.test/api/observability-check",
      { method: "POST" },
      { SENTRY_ENVIRONMENT: "preview" },
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
  });
});
