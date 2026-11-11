// @vitest-environment jsdom

import { mutationResult } from "#src/lib/data/mutationResult.ts";

import { view, toEntityId } from "@nkzw/fate";
import type { ExpenseEntity, ExpenseChunkEntity, PartyEntity, ProfileEntity } from "./entities.ts";

import { Repo } from "@automerge/automerge-repo";
import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { useView } from "react-fate";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import type { Party, PartyExpenseChunk } from "#src/models/party.ts";
import { createExpenseId, calculateExpenseHash } from "#src/models/expense.ts";
import { getPartyListHandle } from "#src/models/partyList.ts";
import { useParty } from "#src/hooks/useParty.ts";
import { usePartyList } from "#src/hooks/usePartyList.ts";
import { createAppData, type AppData } from "./client.ts";
import { FateClient } from "react-fate";

const PartyHeaderView = view<PartyEntity>()({
  id: true,
  available: true,
  name: true,
  symbol: true,
});

const PartyDetailsView = view<PartyEntity>()({
  id: true,
  available: true,
  name: true,
  symbol: true,
  description: true,
});

const ProfileHomeView = view<ProfileEntity>()({
  id: true,
  available: true,
  parties: true,
  pinnedParties: true,
  archivedParties: true,
  lastUsedAt: true,
  lastOpenedPartyId: true,
  participantInParties: true,
});

const ProfileAppearanceView = view<ProfileEntity>()({
  id: true,
  available: true,
  locale: true,
  hue: true,
});

const ExpenseChunkView = view<ExpenseChunkEntity>()({
  id: true,
  available: true,
  expenses: { id: true },
});

const ExpenseDetailView = view<ExpenseEntity>()({
  id: true,
  available: true,
  name: true,
  paidAt: true,
  paidBy: true,
  shares: true,
  photos: true,
  isTransfer: true,
  __hash: true,
});

const ExpenseEditorView = view<ExpenseEntity>()({
  id: true,
  available: true,
  name: true,
  paidAt: true,
  paidBy: true,
  shares: true,
  photos: true,
  isTransfer: true,
  __hash: true,
  __editCopy: true,
  __editCopyLastUpdatedAt: true,
});

let repo: Repo;
let data: AppData;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  repo = new Repo({ network: [] });
  data = createAppData(repo);
  container = document.createElement("div");
  root = createRoot(container);
  // SAFETY: React reads this optional test-only flag to check act boundaries.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root.unmount());
  data.dispose();
  await repo.shutdown();
});

function party() {
  const handle = repo.create<Party>({
    // SAFETY: The allocated document ID replaces this placeholder before exposure.
    id: "" as Party["id"],
    type: "party",
    name: "Trip",
    symbol: "🏝️",
    description: "Details",
    currency: "EUR",
    participants: {},
    chunkRefs: [],
  });

  handle.change((doc) => {
    doc.id = handle.documentId;
  });

  return handle;
}

async function mount(children: React.ReactNode) {
  await act(async () => {
    root.render(
      <FateClient client={data.fate}>
        <Suspense fallback="Loading">{children}</Suspense>
      </FateClient>,
    );
  });
}

test("cold and evicted Fate caches render a ready local party without entering Suspense", async () => {
  const handle = party();
  expect(handle.isReady()).toBe(true);
  expect(data.fate.store.read(toEntityId("Party", handle.documentId))).toBeUndefined();
  const find = vi.spyOn(repo, "find");
  const on = vi.spyOn(handle, "on");
  const fallback = vi.fn<() => void>();

  function Pending() {
    fallback();

    return <span>Loading</span>;
  }

  function Header() {
    const { party } = useParty(handle.documentId, PartyHeaderView);

    return <span>{party.name}</span>;
  }

  await act(async () => {
    flushSync(() => {
      root.render(
        <FateClient client={data.fate}>
          <Suspense fallback={<Pending />}>
            <Header />
          </Suspense>
        </FateClient>,
      );
    });
    expect(container.textContent).toBe("Trip");
  });
  await act(async () => root.render(null));
  data.fate.deleteRecord("Party", handle.documentId);
  expect(data.fate.store.read(toEntityId("Party", handle.documentId))).toBeUndefined();
  await act(async () => {
    flushSync(() => {
      root.render(
        <FateClient client={data.fate}>
          <Suspense fallback={<Pending />}>
            <Header />
          </Suspense>
        </FateClient>,
      );
    });
    expect(container.textContent).toBe("Trip");
  });
  expect(on.mock.calls.filter(([event]) => event === "change")).toHaveLength(1);
  expect(fallback).not.toHaveBeenCalled();
  expect(find).not.toHaveBeenCalled();
});

test("React party views isolate fields, share a source listener, and clear removed optional fields", async () => {
  const handle = party();
  const on = vi.spyOn(handle, "on");
  const headerRender = vi.fn<() => void>();
  const detailsRender = vi.fn<() => void>();

  function Header() {
    const { party } = useParty(handle.documentId, PartyHeaderView);
    headerRender();

    return (
      <span>
        {party.name}
        {party.symbol}
      </span>
    );
  }

  function Details() {
    const { party } = useParty(handle.documentId, PartyDetailsView);
    detailsRender();

    return <span>{party.description}</span>;
  }

  await mount(
    <>
      <Header />
      <Details />
    </>,
  );
  expect(container.textContent).toBe("Trip🏝️Details");
  const headerRenders = headerRender.mock.calls.length;
  const detailRenders = detailsRender.mock.calls.length;
  expect(on.mock.calls.filter(([event]) => event === "change")).toHaveLength(1);

  await act(async () => {
    handle.change((doc) => {
      doc.description = "Remote details";
    });
  });
  expect(container.textContent).toBe("Trip🏝️Remote details");
  expect(headerRender).toHaveBeenCalledTimes(headerRenders);
  expect(detailsRender.mock.calls.length).toBeGreaterThan(detailRenders);

  await act(async () => {
    handle.change((doc) => {
      delete doc.symbol;
    });
  });
  expect(container.textContent).toBe("TripRemote details");
  const ref = data.fate.ref<PartyEntity>("Party", handle.documentId, PartyHeaderView);
  expect(data.fate.peekView(PartyHeaderView, ref)?.data.symbol).toBeUndefined();
  await act(async () => root.render(null));
  data.fate.gc();
  expect(data.fate.peekView(PartyHeaderView, ref)?.data.name).toBe("Trip");
});

test("profile appearance changes do not rerender the home membership view", async () => {
  const handle = await getPartyListHandle(repo);
  const homeRender = vi.fn<() => void>();

  function Home() {
    const { partyList } = usePartyList(ProfileHomeView);
    homeRender();

    return <span>{Object.keys(partyList.parties).length}</span>;
  }

  function Appearance() {
    const { partyList } = usePartyList(ProfileAppearanceView);

    return <span>{partyList.hue}</span>;
  }

  await mount(
    <>
      <Home />
      <Appearance />
    </>,
  );
  const renders = homeRender.mock.calls.length;
  await act(async () => {
    handle.change((doc) => {
      doc.hue = 180;
    });
  });
  expect(container.textContent).toBe("0180");
  expect(homeRender).toHaveBeenCalledTimes(renders);
});

test("normalized expense views update drafts independently of list membership and saved rows", async () => {
  const owner = party();

  const chunk = repo.create<PartyExpenseChunk>({
    // SAFETY: The allocated document ID replaces this placeholder before exposure.
    id: "" as PartyExpenseChunk["id"],
    type: "expenseChunk",
    partyId: owner.documentId,
    createdAt: new Date("2026-01-01"),
    maxSize: 500,
    expenses: [],
  });

  const expense = {
    id: createExpenseId(chunk.documentId),
    name: "Lunch",
    paidAt: new Date("2026-01-02"),
    paidBy: { alice: 1200 },
    shares: { alice: { type: "divide" as const, value: 1 } },
    photos: [],
    __hash: "",
  };

  expense.__hash = calculateExpenseHash(expense);
  chunk.change((doc) => {
    doc.id = chunk.documentId;
    doc.expenses.push(expense);
  });
  const listRender = vi.fn<() => void>();
  const rowRender = vi.fn<() => void>();

  function List() {
    const ref = data.fate.ref<ExpenseChunkEntity>(
      "ExpenseChunk",
      chunk.documentId,
      ExpenseChunkView,
    );

    const result = useView(ExpenseChunkView, ref);
    listRender();

    return <span>{result.expenses.length}</span>;
  }

  function Row() {
    const ref = data.fate.ref<ExpenseEntity>("Expense", expense.id, ExpenseDetailView);
    const result = useView(ExpenseDetailView, ref);
    rowRender();

    return <span>{result.available ? result.name : "Removed"}</span>;
  }

  function Editor() {
    const ref = data.fate.ref<ExpenseEntity>("Expense", expense.id, ExpenseEditorView);
    const result = useView(ExpenseEditorView, ref);

    return <span>{result.available ? (result.__editCopy?.name ?? result.name) : "Removed"}</span>;
  }

  await mount(
    <>
      <List />
      <Row />
      <Editor />
    </>,
  );
  expect(container.textContent).toBe("1LunchLunch");
  const listRenders = listRender.mock.calls.length;
  const rowRenders = rowRender.mock.calls.length;
  await act(async () => {
    await mutationResult(
      data.fate.mutations.expense.editDraft({
        input: { expenseId: expense.id, patches: [{ t: 2, p: ["name"], v: "Dinner" }] },
      }),
    );
  });
  expect(container.textContent).toBe("1LunchDinner");
  expect(listRender).toHaveBeenCalledTimes(listRenders);
  expect(rowRender).toHaveBeenCalledTimes(rowRenders);
  expect(chunk.doc().expenses[0].__editCopy?.paidAt).toEqual(new Date("2026-01-02"));
  expect(chunk.doc().expenses[0].__editCopy?.shares).toEqual({
    alice: { type: "divide", value: 1 },
  });

  await act(async () => {
    chunk.change((doc) => {
      doc.expenses[0].name = "Updated lunch";
    });
  });
  expect(container.textContent).toBe("1Updated lunchDinner");
  expect(listRender).toHaveBeenCalledTimes(listRenders);

  await act(async () => {
    chunk.change((doc) => {
      doc.expenses.splice(0, 1);
    });
  });
  expect(container.textContent).toBe("0RemovedRemoved");
});

test("incoming merges update typed views and source deletion publishes an unavailable entity", async () => {
  const handle = party();
  const ref = data.fate.ref<PartyEntity>("Party", handle.documentId, PartyDetailsView);
  await data.fate.readView(PartyDetailsView, ref);
  const remoteRepo = new Repo({ network: [] });

  try {
    const binary = await repo.export(handle.documentId);
    const remote = remoteRepo.import<Party>(binary!, { docId: handle.documentId });
    remote.change((doc) => {
      doc.description = "Merged";
    });
    const updated = await remoteRepo.export(remote.documentId);
    repo.import(updated!, { docId: handle.documentId });
    expect(data.fate.peekView(PartyDetailsView, ref)?.data.description).toBe("Merged");
    repo.delete(handle.documentId);
    expect(data.fate.peekView(PartyDetailsView, ref)?.data.available).toBe(false);
  } finally {
    await remoteRepo.shutdown();
  }
});
