import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.js";
import { useParty } from "#src/hooks/useParty.js";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import {
  validatePartyDescription,
  validatePartyParticipantName,
  validatePartySymbol,
  validatePartyTitle,
} from "#src/lib/validation.js";
import {
  DEFAULT_PARTY_SYMBOL,
  type Party,
  type PartyParticipant,
} from "#src/models/party.js";
import { ColorSlider, ColorThumb, SliderTrack } from "#src/ui/Color.tsx";
import { Label } from "#src/ui/Field.tsx";
import { IconButton } from "#src/ui/IconButton.js";
import { AppEmojiField, AppTextField } from "#src/ui/TextField.js";
import { defaultThemeHue, setThemeHue } from "#src/ui/theme.ts";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { Suspense, useId } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

export const Route = createFileRoute("/party_/$partyId/settings")({
  component: PartySettings,
  pendingComponent: PartyPendingComponent,
  loader: async ({ context, params, location }) => {
    await guardParticipatingInParty(params.partyId, context, location);
  },
});

interface PartySettingsFormValues {
  name: string;
  symbol: string;
  description: string;
  participants: (PartyParticipant | (PartyParticipant & { __isNew: true }))[];
  hue: number;
}

function PartySettings() {
  const params = Route.useParams();
  const { party, updateSettings } = useParty(params.partyId);

  function onSaveSettings(values: PartySettingsFormValues) {
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
      symbol: values.symbol,
      description: values.description,
      participants,
      hue: values.hue,
    });

    toast.success(t`Party settings saved!`);
  }

  const form = useForm({
    defaultValues: {
      name: party.name,
      symbol: party.symbol || DEFAULT_PARTY_SYMBOL,
      description: party.description,
      participants: Object.values(party.participants),
      hue: party.hue ?? defaultThemeHue,
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
    void addParticipantForm.validateField("newParticipantName", "submit");

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
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/party/$partyId" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
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
          void form.handleSubmit();
        }}
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <div className="flex items-start gap-2">
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => validatePartyTitle(value),
            }}
          >
            {(field) => (
              <AppTextField
                label={t`Name`}
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
                className="flex-1"
              />
            )}
          </form.Field>

          <form.Field
            name="symbol"
            validators={{
              onChange: ({ value }) => validatePartySymbol(value),
            }}
          >
            {(field) => (
              <AppEmojiField
                label={t`Symbol`}
                visuallyHideLabel
                value={field.state.value}
                onChange={field.handleChange}
                errorMessage={field.state.meta.errors?.join(", ")}
                isInvalid={
                  field.state.meta.isTouched &&
                  field.state.meta.errors?.length > 0
                }
              />
            )}
          </form.Field>
        </div>

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

        <form.Field name="hue">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>{t`Color`}</Label>
              <ColorSlider
                id={field.name}
                value={`hsl(${field.state.value}, 100%, 50%)`}
                onChange={(value) => {
                  const hue = value.getChannelValue("hue");
                  field.setValue(hue);
                  setThemeHue(hue);
                }}
                channel="hue"
                className="w-full"
              >
                <SliderTrack className="w-full">
                  <ColorThumb className="top-1/2" />
                </SliderTrack>
              </ColorSlider>
            </div>
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

          <div className="h-16 flex-shrink-0" />
        </div>
      </form>
    </div>
  );
}
