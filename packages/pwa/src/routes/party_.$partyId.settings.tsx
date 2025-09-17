import { BackButton } from "#src/components/BackButton.js";
import { useParty } from "#src/hooks/useParty.js";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import {
  validatePartyDescription,
  validatePartyParticipantName,
  validatePartyTitle,
} from "#src/lib/validation.js";
import type { Party, PartyParticipant } from "#src/models/party.js";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/TextField.js";
import { t, Trans } from "@lingui/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useId } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

export const Route = createFileRoute("/party_/$partyId/settings")({
  component: PartySettings,
  loader: async ({ context, params }) => {
    await guardParticipatingInParty(params.partyId, context);
  },
});

interface PartySettingsFormValues {
  name: string;
  description: string;
  participants: (PartyParticipant | (PartyParticipant & { __isNew: true }))[];
}

function PartySettings() {
  const params = Route.useParams();
  const { party, updateSettings } = useParty(params.partyId);

  async function onSaveSettings(values: PartySettingsFormValues) {
    const participants = values.participants
      .map((participant): PartyParticipant => {
        if ("__isNew" in participant) {
          return {
            id: participant.id,
            name: participant.name,
          };
        }

        return { ...participant };
      })
      .reduce<Party["participants"]>((result, next) => {
        result[next.id] = next;
        return result;
      }, {});

    updateSettings({
      name: values.name,
      description: values.description,
      participants,
    });

    toast.success(t`Party settings saved!`);
  }

  const form = useForm({
    defaultValues: {
      name: party.name,
      description: party.description,
      participants: Object.values(party.participants),
    } as PartySettingsFormValues,
    onSubmit: ({ value }) => {
      onSaveSettings(value);
    },
  });

  const formId = useId();

  const addParticipantForm = useForm({
    defaultValues: {
      newParticipantName: "",
    },
  });

  function addNewParticipant() {
    addParticipantForm.validateField("newParticipantName", "submit");

    const meta = addParticipantForm.getFieldMeta("newParticipantName");
    const errorCount = meta?.errors?.length ?? 0;

    if (errorCount) {
      return;
    }

    const newParticipantName =
      addParticipantForm.getFieldValue("newParticipantName");

    form.pushFieldValue("participants", {
      id: crypto.randomUUID(),
      name: newParticipantName,
      __isNew: true,
    });

    addParticipantForm.setFieldValue("newParticipantName", "");
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/party/$partyId" }} />

        <h1 className="pl-4 text-2xl font-bold">
          <Trans>Party Settings</Trans>
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
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) => validatePartyTitle(value),
          }}
        >
          {(field) => (
            <AppTextField
              label={t`Title`}
              description={t`How do you want to call this party?`}
              minLength={1}
              maxLength={50}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={field.state.meta.errors?.join(", ")}
              isInvalid={
                field.state.meta.isTouched &&
                field.state.meta.errors?.length > 0
              }
            />
          )}
        </form.Field>

        <form.Field
          name="description"
          validators={{
            onChange: ({ value }) => validatePartyDescription(value),
          }}
        >
          {(field) => (
            <AppTextField
              label={t`Description`}
              description={t`What is this party about?`}
              maxLength={500}
              textArea={true}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={field.state.meta.errors?.join(", ")}
              isInvalid={
                field.state.meta.isTouched &&
                field.state.meta.errors?.length > 0
              }
            />
          )}
        </form.Field>

        <div>
          <h2 className="text-lg font-medium">
            <Trans>Participants</Trans>
          </h2>

          <p className="mt-2">
            <Trans>
              Manage the participants list. Existing members can only be
              archived.
            </Trans>
          </p>

          <form.Field
            name="participants"
            mode="array"
            validators={{
              onChange: ({ value }) => {
                const notArchivedParticipants = value.filter((participant) => {
                  if ("__isNew" in participant) {
                    return true;
                  }

                  return !participant.isArchived;
                });

                if (notArchivedParticipants.length === 0) {
                  return t`At least one participant is required`;
                }
              },
            }}
          >
            {(field) => {
              const notArchivedParticipants = field.state.value.filter(
                (participant) => {
                  if ("__isNew" in participant) {
                    return true;
                  }

                  return !participant.isArchived;
                },
              );

              const archivedParticipants = field.state.value.filter(
                (participant) => {
                  if ("__isNew" in participant) {
                    return false;
                  }

                  return participant.isArchived;
                },
              );

              function indexOf(participant: PartyParticipant) {
                return field.state.value.indexOf(participant);
              }

              return (
                <div className="mt-4 flex flex-col gap-4">
                  {field.state.meta.errors?.length > 0 && (
                    <span className="text-sm font-medium text-danger-500">
                      {field.state.meta.errors.join(", ")}
                    </span>
                  )}

                  {notArchivedParticipants.map((participant) => (
                    <div key={participant.id} className="flex w-full gap-2">
                      <form.Field
                        name={`participants[${indexOf(participant)}].name`}
                        validators={{
                          onChange: ({ value }) =>
                            validatePartyParticipantName(value),
                        }}
                      >
                        {(field) => (
                          <AppTextField
                            name={field.name}
                            value={field.state.value}
                            onChange={field.handleChange}
                            onBlur={field.handleBlur}
                            aria-label={t`Participant name`}
                            className="w-full"
                            errorMessage={field.state.meta.errors?.join(", ")}
                            isInvalid={
                              field.state.meta.isTouched &&
                              field.state.meta.errors?.length > 0
                            }
                          />
                        )}
                      </form.Field>

                      {"__isNew" in participant ? (
                        <IconButton
                          icon="#lucide/trash"
                          aria-label={t`Remove`}
                          onPress={() =>
                            field.removeValue(indexOf(participant))
                          }
                          className="flex-shrink-0"
                        />
                      ) : (
                        <IconButton
                          icon="#lucide/archive"
                          aria-label={t`Archive`}
                          onPress={() => {
                            field.setValue((values) => {
                              return values.map((current) => {
                                if (current.id === participant.id) {
                                  return {
                                    ...current,
                                    isArchived: !participant.isArchived,
                                  };
                                }

                                return current;
                              });
                            });
                          }}
                          className="flex-shrink-0"
                        />
                      )}
                    </div>
                  ))}

                  <div className="flex w-full gap-2">
                    <addParticipantForm.Field
                      name="newParticipantName"
                      validators={{
                        onSubmit: ({ value }) =>
                          validatePartyParticipantName(value),
                      }}
                    >
                      {(field) => (
                        <AppTextField
                          name={field.name}
                          value={field.state.value}
                          onChange={field.handleChange}
                          onBlur={field.handleBlur}
                          aria-label={t`New participant name`}
                          className="w-full"
                          errorMessage={field.state.meta.errors?.join(", ")}
                          isInvalid={
                            field.state.meta.isTouched &&
                            field.state.meta.errors?.length > 0
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              flushSync(() => {
                                addNewParticipant();
                              });

                              e.preventDefault();

                              const target = e.target as HTMLInputElement;
                              target.focus();

                              // Check if fully in view with a little margin
                              const rect = target.getBoundingClientRect();
                              const margin = 10;

                              if (
                                rect.top >= margin &&
                                rect.left >= margin &&
                                rect.right <= window.innerWidth - margin &&
                                rect.bottom <= window.innerHeight - margin
                              ) {
                                return;
                              }

                              const newScrollTop = window.scrollY + rect.top;
                              const newScrollLeft = window.scrollX + rect.left;

                              window.scrollTo({
                                behavior: "smooth",
                                top: newScrollTop,
                                left: newScrollLeft,
                              });
                            }
                          }}
                        />
                      )}
                    </addParticipantForm.Field>

                    <IconButton
                      icon="#lucide/plus"
                      aria-label={t`Add participant`}
                      className="flex-shrink-0"
                      color="accent"
                      onPress={addNewParticipant}
                    />
                  </div>

                  {archivedParticipants.length ? (
                    <h3 className="font-medium">
                      <Trans>Archived participants</Trans>
                    </h3>
                  ) : null}

                  {archivedParticipants.map((participant) => (
                    <div key={participant.id} className="flex w-full gap-2">
                      <form.Field
                        name={`participants[${indexOf(participant)}].name`}
                        validators={{
                          onChange: ({ value }) =>
                            validatePartyParticipantName(value),
                        }}
                      >
                        {(field) => (
                          <AppTextField
                            name={field.name}
                            value={field.state.value}
                            onChange={field.handleChange}
                            onBlur={field.handleBlur}
                            aria-label={t`Participant name`}
                            className="w-full"
                            errorMessage={field.state.meta.errors?.join(", ")}
                            isInvalid={
                              field.state.meta.isTouched &&
                              field.state.meta.errors?.length > 0
                            }
                            isDisabled={true}
                          />
                        )}
                      </form.Field>

                      <IconButton
                        icon="#lucide/archive-restore"
                        aria-label={t`Restore`}
                        onPress={() => {
                          field.setValue((values) => {
                            return values.map((current) => {
                              if (current.id === participant.id) {
                                return {
                                  ...current,
                                  isArchived: !participant.isArchived,
                                };
                              }

                              return current;
                            });
                          });
                        }}
                        className="flex-shrink-0"
                      />
                    </div>
                  ))}
                </div>
              );
            }}
          </form.Field>

          <div className="h-4" />
        </div>
      </form>
    </div>
  );
}
