import { useProfileId } from "#src/hooks/useProfileId.ts";
import type { PartyEntity, ProfileEntity } from "#src/lib/data/entities.ts";
import { requireAvailable } from "#src/lib/data/availability.ts";
import { useFateClient, useView } from "react-fate";
import { mutationResult } from "#src/lib/data/mutationResult.ts";
import { view } from "@nkzw/fate";
import { optionalSearchTextSchema } from "#src/lib/routerSearch.ts";
import { trackEvent } from "#src/lib/analytics.ts";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.js";
import { getPartyParticipants } from "#src/lib/expenseParticipants.ts";
import { guardPartyExists } from "#src/lib/guards.js";
import { Icon } from "@trizum/ui/Icon";
import { IconButton } from "@trizum/ui/IconButton";
import { cn } from "@trizum/ui/utils";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { Suspense, useId, useState } from "react";
import { Radio, RadioGroup } from "react-aria-components";
import { toast } from "sonner";

const ProfileJoiningView = view<ProfileEntity>()({
  id: true,
  available: true,
  parties: true,
  participantInParties: true,
  phone: true,
  paymentMethods: true,
  avatarId: true,
});

const PartyMembershipView = view<PartyEntity>()({
  id: true,
  available: true,
  name: true,
  participants: true,
});

interface WhoSearchParams {
  redirectTo?: string;
}

export const Route = createFileRoute("/party_/$partyId/who")({
  component: Who,
  pendingComponent: PartyPendingComponent,
  validateSearch: (search): WhoSearchParams => {
    // Save redirectTo path search param if it exists
    return {
      redirectTo: optionalSearchTextSchema.parse(search.redirectTo),
    };
  },
  async loader({ context, params }) {
    await guardPartyExists(params.partyId, context);
  },
});

interface WhoFormValues {
  participantId: string;
}

function Who() {
  const profileId = useProfileId();

  const params = Route.useParams();
  const search = Route.useSearch();
  const client = useFateClient();

  const party = requireAvailable(
    useView(
      PartyMembershipView,
      client.ref<PartyEntity>("Party", params.partyId, PartyMembershipView),
    ),
  );

  const partyList = requireAvailable(
    useView(
      ProfileJoiningView,
      client.ref<ProfileEntity>("Profile", profileId, ProfileJoiningView),
    ),
  );

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

    const currentPartyList = client.peekView(
      ProfileJoiningView,
      client.ref<ProfileEntity>("Profile", partyList.id, ProfileJoiningView),
    )!.data;

    const previousParticipantId = currentPartyList.participantInParties?.[party.id];

    const isJoining =
      currentPartyList.parties[party.id] !== true || previousParticipantId === undefined;

    await mutationResult(
      client.mutations.profile.addPartyToList({
        input: { profileId: partyList.id, parameters: [party.id, participant.id] },
      }),
    );

    if (isJoining) {
      trackEvent("party_joined");
      await mutationResult(
        client.mutations.party.setParticipantDetails({
          input: {
            partyId: party.id,
            parameters: [
              participant.id,
              {
                phone: partyList.phone,
                paymentMethods: partyList.paymentMethods
                  ? { ...partyList.paymentMethods }
                  : undefined,
                avatarId: partyList.avatarId,
              },
            ],
          },
        }),
      );

      toast.success(t({ message: `Welcome to the party, ${participantName}!` }));
    } else {
      if (previousParticipantId !== participant.id) trackEvent("party_participant_switched");
      toast.success(t({ message: `You're now seeing the party as ${participantName}` }));
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

  const { active: participants } = getPartyParticipants(party.participants);

  return (
    <div className="flex min-h-full flex-col">
      <div className="mt-safe container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/party/$partyId" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Who are you?</Trans>
        </h1>

        <div className="flex-1" />

        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty]}>
          {([canSubmit, isSubmitting, isDirty]) =>
            canSubmit && isDirty ? (
              <Suspense fallback={null}>
                <IconButton
                  icon="lucide.check"
                  aria-label={isSubmitting ? t`Submitting...` : t`Save`}
                  type="submit"
                  form={formId}
                  isDisabled={isSubmitting}
                />
              </Suspense>
            ) : null
          }
        </form.Subscribe>
      </div>

      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
        className="container mt-2 flex flex-col gap-4 px-2"
      >
        <p className="px-2 whitespace-pre-wrap">
          {needsToJoin ? (
            <Trans>
              To join the <span className="font-medium">{partyName}</span>, please select who you
              are so that we can show you the expenses and stats that matter to you.
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
                      "group relative flex cursor-default rounded-xl bg-clip-padding px-4 py-3 shadow-lg outline-hidden",
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
                        <div className="text-accent-10 text-lg font-semibold">
                          {participant.name}
                        </div>
                      </div>
                    </div>
                  )}
                </Radio>
              ))}
            </RadioGroup>
          )}
        </form.Field>
      </form>

      <div className="h-16 shrink-0" />
    </div>
  );
}
