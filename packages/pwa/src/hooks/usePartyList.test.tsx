import { ProfileSettingsView } from "#src/lib/data/views.ts";
// @vitest-environment jsdom

import { Repo } from "@automerge/automerge-repo";
import { act, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { DataHarness } from "#src/lib/testing/DataHarness.tsx";
import { documentCache } from "#src/lib/testing/dataCache.ts";
import { hasLocalPartyListData } from "#src/lib/cloudSyncRouteState.ts";
import { initializeI18n } from "#src/lib/i18n.ts";
import { getPartyListHandle } from "#src/models/partyList.ts";
import type { Party } from "#src/models/party.ts";
import { usePartyList } from "./usePartyList.ts";

let repo: Repo;

beforeEach(() => {
  localStorage.clear();
  repo = new Repo({ network: [] });
  initializeI18n("en");
  // SAFETY: React uses this optional test-only flag to check act boundaries.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  documentCache.evictAll();
  await repo.shutdown();
});

it("syncs saved methods and removals to existing groups without changing other participants", async () => {
  const profile = await getPartyListHandle(repo);

  const party = repo.create<Party>({
    // SAFETY: The repo-allocated ID replaces this placeholder before use.
    id: "" as Party["id"],
    type: "party",
    name: "Trip",
    description: "",
    currency: "EUR",
    chunkRefs: [],
    participants: {
      alice: { id: "alice", name: "Alice" },
      bob: { id: "bob", name: "Bob", paymentMethods: { venmo: "bob" } },
    },
  });

  party.change((doc) => {
    doc.id = party.documentId;
  });
  profile.change((doc) => {
    doc.parties[party.documentId] = true;
    doc.participantInParties[party.documentId] = "alice";
  });
  await documentCache.readAsync(repo, profile.documentId);
  await documentCache.readAsync(repo, party.documentId);

  let settings!: ReturnType<typeof usePartyList>;

  function Harness() {
    settings = usePartyList(ProfileSettingsView);

    return null;
  }

  const root = createRoot(document.createElement("div"));

  try {
    await act(async () =>
      root.render(
        <DataHarness value={repo}>
          <Suspense>
            <Harness />
          </Suspense>
        </DataHarness>,
      ),
    );

    const values = {
      username: "Alice",
      phone: "+34612345678",
      avatarId: null,
      locale: "en" as const,
      openLastPartyOnLaunch: false,
      autoOpenCalculator: false,
      hue: 250,
    };

    const methods = {
      bizum: values.phone,
      paypal: "https://paypal.me/Alice123",
      "cash-app": "https://cash.app/$Alice123",
    };

    await act(async () => settings.updateSettings({ ...values, paymentMethods: methods }));
    expect(profile.doc().paymentMethods).toEqual(methods);
    await vi.waitFor(() => expect(party.doc().participants.alice?.paymentMethods).toEqual(methods));
    expect(party.doc().participants.bob?.paymentMethods).toEqual({ venmo: "bob" });

    await act(async () => settings.updateSettings({ ...values, phone: "", paymentMethods: {} }));
    await vi.waitFor(() => expect(party.doc().participants.alice?.paymentMethods).toEqual({}));
    expect(party.doc().participants.alice?.phone).toBe("");
    expect(profile.doc().paymentMethods).toEqual({});
  } finally {
    await act(async () => root.unmount());
  }
});

it("treats payment details as local data when choosing a cloud profile", async () => {
  const profile = await getPartyListHandle(repo);
  expect(hasLocalPartyListData(profile.doc())).toBe(false);
  profile.change((doc) => {
    doc.paymentMethods = { revolut: "alice" };
  });
  expect(hasLocalPartyListData(profile.doc())).toBe(true);
});
