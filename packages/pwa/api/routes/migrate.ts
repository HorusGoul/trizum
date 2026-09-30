import { $, OpenAPIHono } from "@hono/zod-openapi";
import { migrateTricountRoute } from "../contracts/migrate";
import {
  migrationDataSchema,
  migrationErrorResponseSchema,
} from "../../src/lib/api/migrationContract";
import { cors } from "hono/cors";

import { getLogger } from "../../src/lib/log.js";
import { parseTricountData, type TricountResponse } from "../../src/lib/tricountMigration.js";

const logger = getLogger("api", "migrate");

const migrateApp = $(
  new OpenAPIHono().use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "OPTIONS"],
      allowHeaders: ["*"],
    }),
  ),
);

export const apiMigrateRoute = migrateApp.openapi(
  migrateTricountRoute,
  async (c) => {
    let data: TricountResponse | null = null;
    try {
      const { key: tricountKey } = c.req.valid("query");

      const api = new TricountAPIClient();
      await api.initializeKeys();
      await api.authenticate();
      data = await api.fetchTricountData(tricountKey);
      const migrationData = parseTricountData(data);

      return c.json(migrationDataSchema.parse(migrationData), 200);
    } catch (error) {
      logger.error("Migration error", { error });
      return c.json(
        migrationErrorResponseSchema.parse({
          error: error instanceof Error ? error.message : "Unknown error",
          data,
        }),
        500,
      );
    }
  },
  (result, c) => {
    if (!result.success) return c.text("Missing 'key' query parameter", 400);
  },
);

export type MigrateRoute = typeof apiMigrateRoute;

class TricountAPIClient {
  private base_url = "https://api.tricount.bunq.com";
  private app_installation_id: string;
  private public_key: string;
  private private_key: string;
  private headers: Record<string, string>;
  private auth_token?: string;
  private user_id?: string;

  constructor() {
    this.app_installation_id = crypto.randomUUID();
    this.public_key = "";
    this.private_key = "";
    this.headers = {
      "User-Agent": "com.bunq.tricount.android:RELEASE:7.0.7:3174:ANDROID:13:C",
      "app-id": this.app_installation_id,
      "X-Bunq-Client-Request-Id": crypto.randomUUID(),
    };
  }

  async initializeKeys(): Promise<void> {
    const keyPair = (await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"],
    )) as CryptoKeyPair;

    // Export public key in PEM format
    const publicKeyBuffer = (await crypto.subtle.exportKey(
      "spki",
      keyPair.publicKey,
    )) as ArrayBuffer;
    const publicKeyArray = new Uint8Array(publicKeyBuffer);
    const publicKeyBase64 = btoa(String.fromCharCode(...publicKeyArray));
    this.public_key = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----`;

    // Export private key in PEM format
    const privateKeyBuffer = (await crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey,
    )) as ArrayBuffer;
    const privateKeyArray = new Uint8Array(privateKeyBuffer);
    const privateKeyBase64 = btoa(String.fromCharCode(...privateKeyArray));
    this.private_key = `-----BEGIN PRIVATE KEY-----\n${privateKeyBase64}\n-----END PRIVATE KEY-----`;
  }

  async authenticate(): Promise<void> {
    const auth_url = `${this.base_url}/v1/session-registry-installation`;
    const auth_payload = {
      app_installation_uuid: this.app_installation_id,
      client_public_key: this.public_key,
      device_description: "Cloudflare Worker",
    };

    const response = await fetch(auth_url, {
      method: "POST",
      headers: {
        ...this.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(auth_payload),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }

    const auth_data = (await response.json()) as TricountResponse;
    const response_items = auth_data.Response;

    // Extract token and user ID from response
    for (const item of response_items) {
      if ("Token" in item) {
        this.auth_token = item.Token.token;
      }
      if ("UserPerson" in item) {
        this.user_id = item.UserPerson.id.toString();
      }
    }

    if (!this.auth_token || !this.user_id) {
      throw new Error("Failed to extract authentication token or user ID");
    }

    this.headers["X-Bunq-Client-Authentication"] = this.auth_token;
  }

  async fetchTricountData(tricount_key: string): Promise<TricountResponse> {
    if (!this.auth_token || !this.user_id) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const tricount_url = `${this.base_url}/v1/user/${this.user_id}/registry?public_identifier_token=${tricount_key}`;
    const response = await fetch(tricount_url, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Tricount data: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}
