import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.js";
import { useParty } from "#src/hooks/useParty.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import {
  waitForPartyEntitiesInFate,
  writePartyEntitiesToFateCache,
} from "#src/lib/data/fateAppData.ts";
import { useTrizumData } from "#src/lib/data/TrizumDataContext.ts";
import type { Party, PartyParticipant } from "#src/models/party.js";
import type { PartyList } from "#src/models/partyList.js";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { Icon } from "#src/ui/Icon.js";
import { cn } from "#src/ui/utils.js";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useEffect, useId, useState } from "react";
import { Radio, RadioGroup } from "react-aria-components";
import { toast } from "sonner";
import { Button } from "#src/ui/Button.tsx";

const whoPartyPrimePromises = new WeakMap<object, Map<string, Promise<void>>>();
type PrimeState = { status: "error"; error: unknown } | { status: "pending" } | { status: "ready" };

interface WhoSearchParams {
  redirectTo?: string;
}

export const Route = createFileRoute("/party_/$partyId/who")({
  component: Who,
  pendingComponent: PartyPendingComponent,
  validateSearch: (search): WhoSearchParams => {
    // Save redirectTo path search param if it exists
    return {
      redirectTo: search.redirectTo as string | undefined,
    };
  },
});

interface WhoFormValues {
  participantId: string;
}

function Who() {
  const params = Route.useParams();
  const search = Route.useSearch();

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/party/$partyId" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Who are you?</Trans>
        </h1>
      </div>

      <Suspense fallback={null}>
        <WhoDataGate partyId={params.partyId} search={search} />
      </Suspense>

      <div className="h-16 flex-shrink-0" />
    </div>
  );
}

function WhoDataGate({ partyId, search }: { partyId: Party["id"]; search: WhoSearchParams }) {
  const data = useTrizumData();
  const [primeState, setPrimeState] = useState<PrimeState>({ status: "pending" });

  useEffect(() => {
    let isCurrent = true;

    setPrimeState({ status: "pending" });
    getWhoPartyPrimePromise(data, partyId).then(
      () => {
        if (isCurrent) {
          setPrimeState({ status: "ready" });
        }
      },
      (error: unknown) => {
        if (isCurrent) {
          setPrimeState({ error, status: "error" });
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [data, partyId]);

  if (primeState.status === "error") {
    throw primeState.error;
  }

  if (primeState.status === "pending") {
    return null;
  }

  return <WhoData partyId={partyId} search={search} />;
}

function WhoData({ partyId, search }: { partyId: Party["id"]; search: WhoSearchParams }) {
  const { party } = useParty(partyId);
  const { partyList, addPartyToList } = usePartyList();

  return (
    <WhoForm addPartyToList={addPartyToList} party={party} partyList={partyList} search={search} />
  );
}

function getWhoPartyPrimePromise(data: ReturnType<typeof useTrizumData>, partyId: Party["id"]) {
  let promises = whoPartyPrimePromises.get(data.client);

  if (!promises) {
    promises = new Map();
    whoPartyPrimePromises.set(data.client, promises);
  }

  const existing = promises.get(partyId);

  if (existing) {
    return existing;
  }

  const promise = primeWhoPartyCache(data, partyId).catch((error: unknown) => {
    promises.delete(partyId);
    throw error;
  });

  promises.set(partyId, promise);

  return promise;
}

async function primeWhoPartyCache(data: ReturnType<typeof useTrizumData>, partyId: Party["id"]) {
  const localParty = await waitForPartyEntitiesInFate(data.client, partyId, {
    minParticipants: 1,
    timeoutMs: data.hasRemoteSync ? 250 : 8_000,
  });

  if (localParty) {
    return;
  }

  if (!data.hasRemoteSync || !data.settledClient) {
    return;
  }

  const settledParty = await waitForPartyEntitiesInFate(data.settledClient, partyId, {
    minParticipants: 1,
    timeoutMs: 30_000,
  });

  if (!settledParty) {
    throw new Error(`Party ${partyId} was not available after joining`);
  }

  writePartyEntitiesToFateCache(data.client, settledParty);
}

interface WhoFormProps {
  addPartyToList: (partyId: Party["id"], participantId: PartyParticipant["id"]) => Promise<void>;
  party: Party;
  partyList: PartyList;
  search: WhoSearchParams;
}

function WhoForm({ addPartyToList, party, partyList, search }: WhoFormProps) {
  const navigate = useNavigate();
  const partyName = party.name;

  const [needsToJoin] = useState(
    () =>
      partyList.parties[party.id] !== true ||
      partyList.participantInParties?.[party.id] === undefined,
  );

  async function onSaveSettings(values: WhoFormValues) {
    const participant = party.participants[values.participantId];
    const participantName = participant.name;

    await addPartyToList(party.id, participant.id);

    if (needsToJoin) {
      toast.success(t`Welcome to the party, ${participantName}!`);
    } else {
      toast.success(t`You're now seeing the party as ${participantName}`);
    }

    if (search.redirectTo) {
      void navigate({ href: search.redirectTo, replace: true });
      return;
    }

    void navigate({ to: "..", replace: true });
  }

  const form = useForm({
    defaultValues: {
      participantId: partyList.participantInParties?.[party.id] ?? "",
    },
    onSubmit: ({ value }) => {
      return onSaveSettings(value);
    },
  });

  const formId = useId();

  const participants = Object.values(party.participants).filter(
    (participant) => !participant.isArchived,
  );

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="container mt-2 flex flex-col gap-4 px-2"
    >
      <p className="whitespace-pre-wrap px-2">
        {needsToJoin ? (
          <Trans>
            To join the <span className="font-medium">{partyName}</span>, please select who you are
            so that we can show you the expenses and stats that matter to you.
          </Trans>
        ) : (
          <Trans>
            Update who you are in this party so that we can show you the expenses and stats that
            matter to you.
          </Trans>
        )}
      </p>

      <form.Field name="participantId">
        {(field) => (
          <RadioGroup
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            className="flex flex-col gap-2"
          >
            {participants.map((participant) => (
              <Radio
                key={participant.id}
                value={participant.id}
                className={({ isFocusVisible, isSelected, isPressed }) =>
                  cn(
                    "group relative flex cursor-default rounded-xl bg-clip-padding px-4 py-3 shadow-lg outline-none",
                    isFocusVisible && "ring-2 ring-accent-600 ring-offset-1 ring-offset-white/80",
                    isSelected ? "bg-accent-600 text-white" : "border-transparent",
                    isPressed && !isSelected ? "bg-accent-50 dark:bg-accent-800" : "",
                    !isSelected && !isPressed ? "bg-accent-50 dark:bg-accent-900" : "",
                  )
                }
              >
                {({ isSelected }) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex shrink-0 items-center">
                      <Icon icon={isSelected ? "lucide.circle-check" : "lucide.circle"} />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <div className="text-accent-10 text-lg font-semibold">{participant.name}</div>
                    </div>
                  </div>
                )}
              </Radio>
            ))}
          </RadioGroup>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty]}>
        {([canSubmit, isSubmitting, isDirty]) => (
          <Button
            color="accent"
            type="submit"
            isDisabled={!canSubmit || !isDirty || isSubmitting}
            className="mt-2"
          >
            {isSubmitting ? <Trans>Submitting...</Trans> : <Trans>Save</Trans>}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
