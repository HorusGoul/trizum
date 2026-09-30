import { hc } from "hono/client";
import type { PremiumRoute } from "../../api/routes/premium";
import type { CloudSyncRoute } from "../../api/routes/cloud-sync";
import type { MigrateRoute } from "../../api/routes/migrate";
import type { z } from "zod";
import {
  cloudSyncErrorResponseSchema,
  cloudUserSettingsInputSchema,
  getCloudUserSettingsResponseSchema,
  saveCloudUserSettingsResponseSchema,
  type CloudUserSettingsInput,
  type GetCloudUserSettingsResponse,
  type SaveCloudUserSettingsResponse,
} from "./api/cloudSyncContract";
import {
  migrationBadRequestSchema,
  migrationDataSchema,
  migrationErrorResponseSchema,
  migrationQuerySchema,
} from "./api/migrationContract";
import type { MigrationData } from "../models/migrationData";
import {
  partyBoostErrorResponseSchema,
  partyBoostStatusSchema,
  type PartyBoostErrorCode,
  type PartyBoostStatus,
} from "./api/premiumContract.ts";
import { getAuthBaseURL } from "./authBaseUrl.ts";
import { fetchWithNativeAuth } from "./nativeAuthSession.ts";
import { getAppLink } from "./link";

interface TrizumApiClientOptions {
  baseUrl: () => string;
  migrationBaseUrl?: () => string;
  fetch: typeof fetch;
  publicFetch?: typeof fetch;
}

export interface TrizumApiClient {
  cloudSync: {
    getSettings: () => Promise<GetCloudUserSettingsResponse>;
    saveSettings: (settings: CloudUserSettingsInput) => Promise<SaveCloudUserSettingsResponse>;
  };
  migration: {
    importTricount: (key: string) => Promise<MigrationData>;
  };
  premium: {
    activatePartyBoost: (partyDocumentId: string) => Promise<PartyBoostStatus>;
    getPartyBoostStatus: (partyDocumentId: string) => Promise<PartyBoostStatus>;
  };
}

export class CloudSyncApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 409 | 500 | "invalid_response",
    message: string,
  ) {
    super(message);
    this.name = "CloudSyncApiError";
  }
}

export class MigrationApiError extends Error {
  constructor(
    readonly status: 400 | 500 | "invalid_response",
    message: string,
  ) {
    super(message);
    this.name = "MigrationApiError";
  }
}

export class PartyBoostApiError extends Error {
  readonly code: PartyBoostErrorCode;
  readonly transferableAt?: number;

  constructor({
    code,
    message,
    transferableAt,
  }: {
    code: PartyBoostErrorCode;
    message: string;
    transferableAt?: number;
  }) {
    super(message);
    this.code = code;
    this.name = "PartyBoostApiError";
    this.transferableAt = transferableAt;
  }
}

export function createTrizumApiClient(options: TrizumApiClientOptions): TrizumApiClient {
  let transport: ReturnType<typeof createPremiumTransport> | undefined;
  let cloudSyncTransport: ReturnType<typeof hc<CloudSyncRoute>> | undefined;
  let migrationTransport: ReturnType<typeof hc<MigrateRoute>> | undefined;

  function getTransport() {
    transport ??= createPremiumTransport(options);
    return transport;
  }

  function getCloudSyncTransport() {
    cloudSyncTransport ??= hc<CloudSyncRoute>(
      new URL("/api/cloud-sync/", options.baseUrl()).toString(),
      { fetch: options.fetch },
    );
    return cloudSyncTransport;
  }

  return {
    cloudSync: {
      async getSettings() {
        return parseCloudSyncResponse(
          await getCloudSyncTransport().settings.$get(),
          getCloudUserSettingsResponseSchema,
        );
      },
      async saveSettings(settings) {
        const json = cloudUserSettingsInputSchema.parse(settings);
        return parseCloudSyncResponse(
          await getCloudSyncTransport().settings.$put({ json }),
          saveCloudUserSettingsResponseSchema,
        );
      },
    },
    migration: {
      async importTricount(key) {
        const query = migrationQuerySchema.parse({ key });
        migrationTransport ??= hc<MigrateRoute>(
          new URL("/api/migrate", (options.migrationBaseUrl ?? options.baseUrl)()).toString(),
          { fetch: options.publicFetch ?? options.fetch },
        );
        return parseMigrationResponse(await migrationTransport.index.$get({ query }));
      },
    },
    premium: {
      async activatePartyBoost(partyDocumentId) {
        const response = await getTransport()["party-boost"].$put({
          json: { partyDocumentId },
        });
        return parsePartyBoostResponse(response);
      },
      async getPartyBoostStatus(partyDocumentId) {
        const response = await getTransport()["party-boost"].$get({
          query: { partyDocumentId },
        });
        return parsePartyBoostResponse(response);
      },
    },
  };
}

export const trizumApiClient = createTrizumApiClient({
  baseUrl: getAuthBaseURL,
  migrationBaseUrl: () => getAppLink("/"),
  fetch: fetchWithNativeAuth,
  // Migration is public and uses wildcard CORS; keep its requests credential-free
  // across origins, including Capacitor's native origin.
  publicFetch: (input, init) => fetch(input, init),
});

export function isPartyBoostStatus(value: unknown): value is PartyBoostStatus {
  return partyBoostStatusSchema.safeParse(value).success;
}

function createPremiumTransport({ baseUrl, fetch }: TrizumApiClientOptions) {
  return hc<PremiumRoute>(new URL("/api/premium/", baseUrl()).toString(), { fetch });
}

async function parseCloudSyncResponse<Schema extends z.ZodType>(
  response: Response,
  schema: Schema,
): Promise<z.output<Schema>> {
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 200) {
    const parsed = schema.safeParse(body);
    if (parsed.success) return parsed.data;
  } else if (
    response.status === 400 ||
    response.status === 401 ||
    response.status === 409 ||
    response.status === 500
  ) {
    const parsed = cloudSyncErrorResponseSchema.safeParse(body);
    if (parsed.success) {
      throw new CloudSyncApiError(response.status, parsed.data.error);
    }
  }
  throw new CloudSyncApiError("invalid_response", "Cloud Sync returned an invalid response.");
}

async function parseMigrationResponse(response: Response): Promise<MigrationData> {
  if (response.status === 400) {
    const parsed = migrationBadRequestSchema.safeParse(await response.text());
    if (parsed.success) throw new MigrationApiError(400, parsed.data);
  } else {
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 200) {
      const parsed = migrationDataSchema.safeParse(body);
      if (parsed.success) return parsed.data;
    } else if (response.status === 500) {
      const parsed = migrationErrorResponseSchema.safeParse(body);
      if (parsed.success) throw new MigrationApiError(500, parsed.data.error);
    }
  }
  throw new MigrationApiError("invalid_response", "Tricount import returned an invalid response.");
}

async function parsePartyBoostResponse(response: Response) {
  const body = await response.json().catch(() => null);

  if (response.ok) {
    const status = partyBoostStatusSchema.safeParse(body);
    if (status.success) {
      return status.data;
    }
  } else {
    const errorResponse = partyBoostErrorResponseSchema.safeParse(body);
    if (errorResponse.success) {
      throw new PartyBoostApiError(errorResponse.data.error);
    }
  }

  throw new PartyBoostApiError({
    code: "unavailable",
    message: "Party Boost returned an invalid response.",
  });
}
