import { Repo } from "@automerge/automerge-repo";
import { Capacitor } from "@capacitor/core";
import { vi } from "vite-plus/test";
import { documentCache } from "./dataCache.ts";
import { rememberedSession } from "../authSession.ts";
import { setNativeAuthToken } from "../nativeAuthSession.ts";
import { setPartyListId, type PartyList } from "#src/models/partyList.ts";

/** Real Automerge profiles and auth store, with HTTP responses at the fetch boundary. */
export async function createProfileRuntime() {
  const repo = new Repo({ network: [] });

  function profile() {
    const handle = repo.create<PartyList>({
      // SAFETY: The allocated document ID replaces this placeholder before the profile is exposed.
      id: "" as PartyList["id"],
      type: "partyList",
      username: "Alex",
      phone: "",
      parties: {},
      participantInParties: {},
    });

    handle.change((doc) => {
      doc.id = handle.documentId;
    });

    return handle;
  }

  const local = profile();
  const cloud = profile();
  let userId: string | null = "account-a";
  let cloudChoice = false;
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
  setPartyListId(local.documentId);

  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
      window.location.origin,
    );

    if (url.pathname.endsWith("/get-session")) {
      const user = userId
        ? {
            id: userId,
            name: "Alex",
            email: "test@example.com",
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : null;

      return Response.json(
        user
          ? {
              user,
              session: {
                id: "session",
                userId,
                token: "test-token",
                expiresAt: new Date(Date.now() + 86400000),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            }
          : null,
      );
    }

    if (url.pathname.endsWith("/list-accounts")) return Response.json([]);

    if (url.pathname.endsWith("/cloud-sync/settings"))
      return Response.json({
        settings: {
          partyListDocumentId: cloudChoice ? cloud.documentId : local.documentId,
          updatedAt: 123,
        },
      });
    throw new Error(`Unexpected profile fixture request: ${url.pathname}`);
  });

  vi.stubGlobal("fetch", fetcher);

  function setSession(nextUserId: string | null) {
    userId = nextUserId;
    setNativeAuthToken("test-token");
    rememberedSession.storageChanged(
      "trizumRememberedAccount.v1",
      userId
        ? JSON.stringify({
            id: userId,
            name: "Alex",
            email: "test@example.com",
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        : null,
    );
  }

  setSession(userId);
  await documentCache.readAsync(repo, local.documentId);
  await documentCache.readAsync(repo, cloud.documentId);

  return {
    repo,
    local,
    cloud,
    fetcher,
    setSession,
    requireCloudChoice() {
      cloudChoice = true;
    },
    async dispose() {
      rememberedSession.clear();
      await repo.shutdown();
    },
  };
}
