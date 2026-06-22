import { describe, expect, test } from "vite-plus/test";
import { Hono } from "hono";
import { createApiCorsMiddleware } from "./cors";
import type { ApiHonoEnv } from "./env";

describe("api CORS configuration", () => {
  test("allows native auth request headers from trusted origins", async () => {
    const app = new Hono<ApiHonoEnv>();

    app.use("/api/*", createApiCorsMiddleware());

    const response = await app.request(
      "/api/auth/sign-in/social",
      {
        headers: {
          "Access-Control-Request-Headers": "authorization, content-type",
          "Access-Control-Request-Method": "POST",
          Origin: "capacitor://localhost",
        },
        method: "OPTIONS",
      },
      {},
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("capacitor://localhost");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Authorization,Content-Type");
  });
});
