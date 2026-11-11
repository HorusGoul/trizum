import { rememberedSession } from "../authSession.ts";
import { cloudUserSettingsInputSchema } from "../api/cloudSyncContract.ts";
import { clientValueRoot, createClient, valueMutation, type MutationResult } from "@nkzw/fate";
import { z } from "zod";
import type { TrizumApiClient } from "../trizumApiClient.ts";
import type {
  GetCloudUserSettingsResponse,
  SaveCloudUserSettingsResponse,
  CloudUserSettingsInput,
} from "../api/cloudSyncContract.ts";
import type { PartyBoostStatus } from "../api/premiumContract.ts";
import type { MigrationData } from "#src/models/migrationData.ts";

/** HTTP remains server-authoritative; Fate coordinates reads and mutations. */
export function createFateApiClient(
  source: TrizumApiClient,
  scope: () => string = () => rememberedSession.getSnapshot().user?.id ?? "anonymous",
): TrizumApiClient {
  const roots = {
    cloudSettings: clientValueRoot<GetCloudUserSettingsResponse, { scope: string }>(),
    partyBoost: clientValueRoot<PartyBoostStatus, { id: string; scope: string }>(),
    migration: clientValueRoot<MigrationData, { key: string; scope: string }>(),
  };

  const mutations = {
    "cloudSettings.save": valueMutation<CloudUserSettingsInput, SaveCloudUserSettingsResponse>(),
    "partyBoost.activate": valueMutation<string, PartyBoostStatus>(),
  };

  const client = createClient<[typeof roots, typeof mutations]>({
    roots,
    mutations,
    transport: {
      fetchById: async () => [],
      async fetchQuery(procedure, _select, args) {
        switch (procedure) {
          case "cloudSettings":
            return source.cloudSync.getSettings();
          case "partyBoost":
            return source.premium.getPartyBoostStatus(z.string().parse(args?.id));
          case "migration":
            return source.migration.importTricount(z.string().parse(args?.key));
          default:
            throw new Error("Unknown API query");
        }
      },
      async mutate<Name extends keyof typeof mutations>(
        procedure: Name,
        input: CloudUserSettingsInput | string,
      ): Promise<MutationResult<(typeof mutations)[Name]>> {
        const result =
          procedure === "cloudSettings.save"
            ? await source.cloudSync.saveSettings(cloudUserSettingsInputSchema.parse(input))
            : await source.premium.activatePartyBoost(z.string().parse(input));

        // SAFETY: The procedure selects its registered source command and validated input shape.
        return result as MutationResult<(typeof mutations)[Name]>;
      },
    },
  });

  return {
    cloudSync: {
      async getSettings() {
        return (
          await client.request(
            { cloudSettings: { args: { scope: scope() }, value: true } },
            { mode: "network-only" },
          )
        ).cloudSettings;
      },
      async saveSettings(input) {
        const saved = await client.mutations.cloudSettings.save({ input });

        if (saved.error) throw saved.error;

        return saved.result!;
      },
    },
    premium: {
      async getPartyBoostStatus(id) {
        return (
          await client.request(
            { partyBoost: { args: { id, scope: scope() }, value: true } },
            { mode: "network-only" },
          )
        ).partyBoost;
      },
      async activatePartyBoost(input) {
        const saved = await client.mutations.partyBoost.activate({ input });

        if (saved.error) throw saved.error;

        return saved.result!;
      },
    },
    migration: {
      async importTricount(key) {
        return (
          await client.request(
            { migration: { args: { key, scope: scope() }, value: true } },
            { mode: "network-only" },
          )
        ).migration;
      },
    },
  };
}
