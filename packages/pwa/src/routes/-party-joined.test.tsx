// @vitest-environment jsdom

import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nProvider } from "@lingui/react";
import { z } from "zod";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Repo } from "@automerge/automerge-repo";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { RepoContext } from "#src/lib/automerge/RepoContext.ts";
import { documentCache } from "#src/lib/automerge/suspense-hooks.ts";
import { initializeI18n } from "#src/lib/i18n.ts";
import { bindAnalytics, initializeAnalytics } from "#src/lib/analytics.ts";
import { getPartyListHandle } from "#src/models/partyList.ts";
import type { Party } from "#src/models/party.ts";
import { Route as WhoRoute } from "./party_.$partyId.who.tsx";

let repo: Repo;
let root: Root;
let container: HTMLDivElement;
let unbind: (() => void) | undefined;

beforeEach(() => {
  localStorage.clear();
  repo = new Repo({ network: [] });
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.stubEnv("VITE_APP_ENABLE_ANALYTICS", "true");
  vi.stubEnv("VITE_APP_ANALYTICS_URL", "https://analytics.example");
  // SAFETY: React uses this optional test-only global to check act boundaries.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  unbind?.();
  unbind = undefined;
  container.remove();
  await repo.shutdown();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function setup(joined = false, loader?: () => Promise<void>) {
  const profile = await getPartyListHandle(repo);

  const party = repo.create<Party>({
    // SAFETY: The allocated document ID replaces the placeholder before rendering.
    id: "" as Party["id"],
    type: "party",
    name: "Trip",
    description: "",
    currency: "EUR",
    participants: { alice: { id: "alice", name: "Alice" }, bob: { id: "bob", name: "Bob" } },
    chunkRefs: [],
  });

  party.change((doc) => {
    doc.id = party.documentId;
  });

  if (joined)
    profile.change((doc) => {
      doc.parties[party.documentId] = true;
      doc.participantInParties[party.documentId] = "alice";
    });
  await documentCache.readAsync(repo, profile.documentId);
  await documentCache.readAsync(repo, party.documentId);

  const fetcher = vi.fn<typeof fetch>(async (_input, init) =>
    init?.method === "POST"
      ? new Response(null, { status: 204 })
      : new Response(
          'globalThis["__insightflare_tracker_runtime_config__"] = {"siteId":"9cf3da44-3ae9-478d-95aa-7015e864557e","collectToken":"test.token.signature"};\n',
        ),
  );

  vi.stubGlobal("fetch", fetcher);
  initializeAnalytics(["/party/$partyId/who", "/party/$partyId"]);
  unbind = bindAnalytics(profile, () => `/party/${party.documentId}/who`);

  const rootRoute = createRootRouteWithContext<{ repo: Repo }>()({});

  const whoRouteOptions = {
    getParentRoute: () => rootRoute,
    id: "/party_/$partyId/who",
    path: "/party/$partyId/who",
    loader: WhoRoute.options.loader,
    component: WhoRoute.options.component,
  };

  const whoRoute = WhoRoute.update(whoRouteOptions);

  const partyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/party/$partyId",
    loader,
  });

  const router = createRouter({
    context: { repo },
    routeTree: rootRoute.addChildren([whoRoute, partyRoute]),
    history: createMemoryHistory({
      initialEntries: [
        `/party/${party.documentId}/who?redirectTo=${encodeURIComponent(`/party/${party.documentId}`)}`,
      ],
    }),
  });

  await router.load();
  await act(async () =>
    root.render(
      <I18nProvider i18n={initializeI18n("en")}>
        <RepoContext value={repo}>
          <Suspense fallback="Loading">
            <RouterProvider router={router} />
          </Suspense>
        </RepoContext>
      </I18nProvider>,
    ),
  );

  const events = () =>
    fetcher.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) =>
        z
          .object({ kind: z.string(), eventName: z.string().optional() })
          .parse(JSON.parse(z.string().parse(init?.body))),
      )
      .filter((payload) => payload.kind === "custom_event")
      .map((payload) => payload.eventName);

  return { profile, party, router, events };
}

async function select(name: string) {
  const radio = [...container.querySelectorAll("label")].find((label) =>
    label.textContent?.includes(name),
  );

  expect(radio).toBeDefined();
  await act(async () => radio!.click());
}

async function submit() {
  const save = container.querySelector<HTMLButtonElement>('button[aria-label="Save"]');
  expect(save).not.toBeNull();
  await act(async () => save!.click());
}

it("counts a join once and does not count revisiting or switching as another join", async () => {
  const { party, router, events } = await setup();
  await select("Alice");
  await submit();
  await vi.waitFor(() => expect(events()).toEqual(["party_joined"]));
  await act(async () => {
    await router.navigate({ href: `/party/${party.documentId}/who` });
  });
  await select("Bob");
  await submit();
  await vi.waitFor(() => expect(events()).toEqual(["party_joined", "party_participant_switched"]));
});

it("does not count opening an existing membership as a join", async () => {
  const { profile, party, events } = await setup(true);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    profile.change((doc) => {
      doc.username = "Updated profile";
    });
    party.change((doc) => {
      doc.name = "Updated trip";
    });
  });
  expect(events()).toEqual([]);
  await select("Bob");
  await submit();
  await vi.waitFor(() => expect(events()).toEqual(["party_participant_switched"]));
});

it("uses membership received while the form is open instead of counting another join", async () => {
  const { profile, party, events } = await setup();
  const replica = repo.clone(profile);
  replica.change((doc) => {
    doc.parties[party.documentId] = true;
    doc.participantInParties[party.documentId] = "alice";
  });
  await act(async () => {
    profile.merge(replica);
  });
  await select("Bob");
  await submit();
  await vi.waitFor(() => expect(events()).toEqual(["party_participant_switched"]));
});

it("does not count saving the join form twice while navigation is pending as two joins", async () => {
  let finishNavigation!: () => void;

  const { profile, party, router, events } = await setup(
    false,
    () =>
      new Promise<void>((resolve) => {
        finishNavigation = resolve;
      }),
  );

  try {
    await select("Alice");
    await submit();
    expect(profile.doc().participantInParties[party.documentId]).toBe("alice");
    expect(router.state.status).toBe("pending");
    await submit();
    await vi.waitFor(() => expect(events()).toEqual(["party_joined"]));
  } finally {
    await act(async () => finishNavigation());
  }
});
