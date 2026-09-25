import { hc } from "hono/client";
import type { PremiumRoute } from "../../api/routes/premium";
import {
  partyBoostErrorResponseSchema,
  partyBoostStatusSchema,
  type PartyBoostErrorCode,
  type PartyBoostStatus,
} from "./api/premiumContract.ts";
import { getAuthBaseURL } from "./authBaseUrl.ts";
import { fetchWithNativeAuth } from "./nativeAuthSession.ts";

interface TrizumApiClientOptions {
  baseUrl: () => string;
  fetch: typeof fetch;
}

export interface TrizumApiClient {
  premium: {
    activatePartyBoost: (partyDocumentId: string) => Promise<PartyBoostStatus>;
    getPartyBoostStatus: (partyDocumentId: string) => Promise<PartyBoostStatus>;
  };
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

  function getTransport() {
    transport ??= createPremiumTransport(options);
    return transport;
  }

  return {
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
  fetch: fetchWithNativeAuth,
});

export function isPartyBoostStatus(value: unknown): value is PartyBoostStatus {
  return partyBoostStatusSchema.safeParse(value).success;
}

function createPremiumTransport({ baseUrl, fetch }: TrizumApiClientOptions) {
  return hc<PremiumRoute>(new URL("/api/premium/", baseUrl()).toString(), { fetch });
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
