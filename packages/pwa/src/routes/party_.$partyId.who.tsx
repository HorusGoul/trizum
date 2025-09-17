import { BackButton } from "#src/components/BackButton.js";
import { useParty } from "#src/hooks/useParty.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import { usePartyParticipants } from "#src/hooks/usePartyParticipants.js";
import { guardPartyExists } from "#src/lib/guards.js";
import { Icon } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { cn } from "#src/ui/utils.js";
import { t, Trans } from "@lingui/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useId, useState } from "react";
import { Radio, RadioGroup } from "react-aria-components";
import { toast } from "sonner";

interface WhoSearchParams {
  redirectTo?: string;
}

export const Route = createFileRoute("/party_/$partyId/who")({
  component: Who,
  validateSearch: (search): WhoSearchParams => {
    // Save redirectTo path search param if it exists
    return {
      redirectTo: search.redirectTo as string | undefined,
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
  const params = Route.useParams();
  const search = Route.useSearch();
  const { party, setParticipantDetails } = useParty(params.partyId);
  const { partyList, addPartyToList } = usePartyList();
  const navigate = useNavigate();

  const [needsToJoin] = useState(
    () =>
      partyList.parties[party.id] !== true ||
      partyList.participantInParties?.[party.id] === undefined,
  );

  async function onSaveSettings(values: WhoFormValues) {
    const participant = party.participants[values.participantId];

    addPartyToList(party.id, participant.id);

    if (needsToJoin) {
      setParticipantDetails(participant.id, {
        phone: partyList.phone,
        avatarId: partyList.avatarId,
      });

      toast.success(t`Welcome to the party, ${participant.name}!`);
    } else {
      toast.success(t`You're now seeing the party as ${participant.name}`);
    }

    navigate({ to: search.redirectTo ?? "..", replace: true });
  }

  const form = useForm({
    defaultValues: {
      participantId: partyList.participantInParties?.[party.id] ?? "",
    },
    onSubmit: ({ value }) => {
      onSaveSettings(value);
    },
  });

  const formId = useId();

  const { active: participants } = usePartyParticipants();

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/party/$partyId" }} />

        <h1 className="pl-4 text-2xl font-bold">
          <Trans>Who are you?</Trans>
        </h1>

        <div className="flex-1" />

        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isSubmitting,
            state.isDirty,
          ]}
        >
          {([canSubmit, isSubmitting, isDirty]) =>
            canSubmit && isDirty ? (
              <Suspense fallback={null}>
                <IconButton
                  icon="#lucide/check"
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
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="container mt-2 flex flex-col gap-4 px-2"
      >
        <p className="whitespace-pre-wrap px-2">
          {needsToJoin ? (
            <Trans>
              To join the <span className="font-medium">{party.name}</span>,
              please select who you are so that we can show you the expenses and
              stats that matter to you.
            </Trans>
          ) : (
            <Trans>
              Update who you are in this party so that we can show you the
              expenses and stats that matter to you.
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
                      isFocusVisible &&
                        "ring-2 ring-accent-600 ring-offset-1 ring-offset-white/80",
                      isSelected
                        ? "bg-accent-600 text-white"
                        : "border-transparent",
                      isPressed && !isSelected
                        ? "bg-accent-50 dark:bg-accent-800"
                        : "",
                      !isSelected && !isPressed
                        ? "bg-accent-50 dark:bg-accent-900"
                        : "",
                    )
                  }
                >
                  {({ isSelected }) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <div className="flex shrink-0 items-center">
                        <Icon
                          name={
                            isSelected
                              ? "#lucide/circle-check"
                              : "#lucide/circle"
                          }
                        />
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
    </div>
  );
}
