import { Hono } from "hono";
import { cors } from "hono/cors";

import type { Party, PartyParticipant } from "../../src/models/party";
import type { Expense, ExpenseShare } from "../../src/models/expense.js";
import type { MigrationData } from "../../src/models/migration";

export const apiMigrateRoute = new Hono();

apiMigrateRoute.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

apiMigrateRoute.get("/", async (c) => {
  let data: TricountResponse | null = null;
  try {
    const url = new URL(c.req.url);
    const tricountKey = url.searchParams.get("key");

    if (!tricountKey) {
      return new Response("Missing 'key' query parameter", { status: 400 });
    }

    const api = new TricountAPIClient();
    await api.initializeKeys();
    await api.authenticate();
    data = await api.fetchTricountData(tricountKey);
    const migrationData = parseTricountData(data);

    return new Response(JSON.stringify(migrationData), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        data,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});

interface TricountAPI {
  base_url: string;
  app_installation_id: string;
  public_key: string;
  private_key: string;
  headers: Record<string, string>;
  auth_token?: string;
  user_id?: string;
}

interface TricountResponse {
  Response: Array<{
    Registry: {
      id: number;
      title: string;
      description: string | null;
      currency: string;
      memberships: Array<{
        RegistryMembershipNonUser: {
          id: number;
          alias: {
            display_name: string;
          };
        };
      }>;
      all_registry_entry: Array<{
        RegistryEntry: {
          id: number;
          amount: {
            currency: string;
            value: string;
          };
          description: string;
          date: string;
          type_transaction: string;
          membership_owned: {
            RegistryMembershipNonUser: {
              alias: {
                display_name: string;
              };
            };
          };
          allocations: Array<{
            amount: {
              currency: string;
              value: string;
            };
            membership: {
              RegistryMembershipNonUser: {
                alias: {
                  display_name: string;
                };
              };
            };
            type: string;
            share_ratio?: number;
          }>;
          attachment: Array<{
            urls?: Array<{
              url: string;
            }>;
          }>;
          category: string;
        };
      }>;
    };
    Token: {
      token: string;
    };
    UserPerson: {
      id: number;
    };
  }>;
}

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
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"],
    );

    // Export public key in PEM format
    const publicKeyBuffer = await crypto.subtle.exportKey(
      "spki",
      keyPair.publicKey,
    );
    const publicKeyArray = new Uint8Array(publicKeyBuffer);
    const publicKeyBase64 = btoa(String.fromCharCode(...publicKeyArray));
    this.public_key = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----`;

    // Export private key in PEM format
    const privateKeyBuffer = await crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey,
    );
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
      throw new Error(
        `Authentication failed: ${response.status} ${response.statusText}`,
      );
    }

    const auth_data = await response.json<TricountResponse>();
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
      throw new Error(
        `Failed to fetch Tricount data: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }
}

function parseTricountData(data: TricountResponse): MigrationData {
  const registry = data.Response[0].Registry;

  // Create photo mapping with temporary IDs
  const photoMap = new Map<string, string>();
  const photos: { id: string; url: string }[] = [];

  // Extract all photos from transactions
  for (const entry of registry.all_registry_entry) {
    const transaction = entry.RegistryEntry;
    for (const attachment of transaction.attachment) {
      if (attachment.urls && attachment.urls.length > 0) {
        const url = attachment.urls[0].url;
        if (!photoMap.has(url)) {
          const tempId = crypto.randomUUID();
          photoMap.set(url, tempId);
          photos.push({ id: tempId, url });
        }
      }
    }
  }

  // Create participants mapping
  const participants: Record<string, PartyParticipant> = {};
  for (const membership of registry.memberships) {
    const member = membership.RegistryMembershipNonUser;
    const participantId = crypto.randomUUID();
    participants[participantId] = {
      id: participantId,
      name: member.alias.display_name,
    };
  }

  // Create name to participant ID mapping
  const nameToIdMap = new Map<string, string>();
  for (const [participantId, participant] of Object.entries(participants)) {
    nameToIdMap.set(participant.name, participantId);
  }

  // Transform expenses
  const expenses: (Omit<Expense, "id" | "__hash" | "paidAt" | "photos"> & {
    paidAt: string;
    photos: string[];
  })[] = [];

  for (const entry of registry.all_registry_entry) {
    const transaction = entry.RegistryEntry;

    const totalAmount = Math.abs(parseFloat(transaction.amount.value));
    const totalAmountInCents = Math.round(totalAmount * 100);
    const currency = transaction.amount.currency;
    const paidByName =
      transaction.membership_owned.RegistryMembershipNonUser.alias.display_name;
    const paidById = nameToIdMap.get(paidByName);

    if (!paidById) {
      console.warn(`Could not find participant ID for payer: ${paidByName}`);
      continue;
    }

    // Check if this is a transfer transaction
    const isTransfer = transaction.type_transaction === "BALANCE";

    // Create paidBy record
    const paidBy: Record<string, number> = {};
    paidBy[paidById] = totalAmountInCents;

    // Create shares record
    const shares: Record<string, ExpenseShare> = {};
    let totalShares = 0;

    // First pass: calculate total shares for divide participants
    for (const allocation of transaction.allocations) {
      const participantName =
        allocation.membership.RegistryMembershipNonUser.alias.display_name;
      const participantId = nameToIdMap.get(participantName);

      if (!participantId) {
        console.warn(`Could not find participant ID for: ${participantName}`);
        continue;
      }

      if (allocation.type === "RATIO") {
        totalShares += allocation.share_ratio || 1;
      }
    }

    // Second pass: create shares
    for (const allocation of transaction.allocations) {
      const participantName =
        allocation.membership.RegistryMembershipNonUser.alias.display_name;
      const participantId = nameToIdMap.get(participantName);

      if (!participantId) {
        continue;
      }

      const amount = Math.abs(parseFloat(allocation.amount.value));
      const amountInCents = Math.round(amount * 100);

      if (allocation.type === "AMOUNT") {
        if (amountInCents === 0) {
          continue;
        }

        shares[participantId] = {
          type: "exact",
          value: amountInCents,
        };
      } else if (allocation.type === "RATIO") {
        const ratio = (allocation.share_ratio || 1) / totalShares;
        shares[participantId] = {
          type: "divide",
          value: ratio,
        };
      }
    }

    // Create photos array for this expense
    const expensePhotos: string[] = [];
    for (const attachment of transaction.attachment) {
      if (attachment.urls && attachment.urls.length > 0) {
        const url = attachment.urls[0].url;
        const photoId = photoMap.get(url);
        if (photoId) {
          expensePhotos.push(photoId);
        }
      }
    }

    // Parse date
    const paidAt = new Date(transaction.date);

    const expense: Omit<Expense, "id" | "__hash" | "paidAt" | "photos"> & {
      paidAt: string;
      photos: string[];
    } = {
      name: transaction.description,
      paidAt: paidAt.toISOString(),
      paidBy,
      shares,
      photos: expensePhotos,
      isTransfer,
      __editCopy: undefined,
      __editCopyLastUpdatedAt: undefined,
      __presence: undefined,
    };

    expenses.push(expense);
  }

  // Create party
  const party: Omit<Party, "id" | "chunkRefs"> = {
    type: "party",
    name: registry.title,
    description: registry.description || "",
    currency: registry.currency as Party["currency"], // Assuming currency string is valid
    participants,
    hue: undefined,
  };

  return {
    party,
    expenses,
    photos,
  };
}
