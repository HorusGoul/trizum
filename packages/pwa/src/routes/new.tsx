import { usePartyList } from "#src/hooks/usePartyList.js";
import { EURO } from "#src/models/currency.js";
import type { Party, PartyParticipant } from "#src/models/party.js";
import { IconButton } from "#src/ui/IconButton.js";
import { AppTextField } from "#src/ui/TextField.js";
import type { DocumentId } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { Suspense, useId } from "react";
import { flushSync } from "react-dom";

export const Route = createFileRoute("/new")({
  component: New,
});

interface NewPartyFormValues {
  name: string;
  description: string;
  participants: Pick<PartyParticipant, "name">[];
  newParticipantName: string;
}

function New() {
  const repo = useRepo();
  const { addPartyToList } = usePartyList();
  const navigate = useNavigate();

  function onCreateParty(values: NewPartyFormValues) {
    const participants = values.participants.map((participant) => ({
      ...participant,
      id: crypto.randomUUID(),
    }));

    const handle = repo.create<Party>({
      id: "" as DocumentId,
      name: values.name,
      description: values.description,
      currency: EURO,
      participants: participants.reduce<Party["participants"]>(
        (result, next) => {
          result[next.id] = {
            id: next.id,
            name: next.name,
          };
          return result;
        },
        {},
      ),
      expenses: [],
    });
    handle.change((doc) => (doc.id = handle.documentId));
    addPartyToList(handle.documentId);
    navigate({
      to: "/party/$partyId",
      params: { partyId: handle.documentId },
      replace: true,
    });

    return handle.documentId;
  }

  const form = useForm<NewPartyFormValues>({
    defaultValues: {
      name: "",
      description: "",
      participants: [
        {
          name: "You",
        },
      ],
      newParticipantName: "",
    },
    onSubmit: ({ value }) => {
      onCreateParty(value);
    },
  });

  const formId = useId();

  function addNewParticipant() {
    const newParticipantName = form.getFieldValue("newParticipantName");

    form.pushFieldValue("participants", {
      name: newParticipantName,
    });

    form.setFieldValue("newParticipantName", "");
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <IconButton icon="arrow-left" aria-label="Go Back" />

        <h1 className="pl-4 text-2xl font-bold">New trizum</h1>

        <div className="flex-1" />

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) =>
            canSubmit ? (
              <Suspense fallback={null}>
                <IconButton
                  icon="check"
                  aria-label={isSubmitting ? "Submitting..." : "Save"}
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
        <form.Field name="name">
          {(field) => (
            <AppTextField
              label="Title"
              description="How do you want to call this party?"
              minLength={1}
              maxLength={50}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <AppTextField
              label="Description"
              description="What is this party about?"
              maxLength={500}
              textArea={true}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>

        {/* TODO: Currency picker */}

        <div>
          <h2 className="text-lg font-medium">Participants</h2>

          <p className="mt-2">
            Who is invited to this party? You can add more participants later.
          </p>

          <form.Field name="participants" mode="array">
            {(field) => (
              <div className="mt-4 flex flex-col gap-4">
                {field.state.value.map((_, index) => (
                  <div key={index} className="flex w-full items-center gap-2">
                    <form.Field name={`participants[${index}].name`}>
                      {(field) => (
                        <AppTextField
                          name={field.name}
                          value={field.state.value}
                          onChange={field.handleChange}
                          onBlur={field.handleBlur}
                          aria-label="Participant name"
                          className="w-full"
                        />
                      )}
                    </form.Field>

                    <IconButton
                      icon="trash"
                      aria-label="Remove"
                      onPress={() => field.removeValue(index)}
                      className="flex-shrink-0"
                    />
                  </div>
                ))}

                <div className="flex w-full items-center gap-2">
                  <form.Field name="newParticipantName">
                    {(field) => (
                      <AppTextField
                        name={field.name}
                        value={field.state.value}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                        aria-label="New participant name"
                        className="w-full"
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
                  </form.Field>

                  <IconButton
                    icon="plus"
                    aria-label="Add participant"
                    className="flex-shrink-0"
                    color="accent"
                    onPress={addNewParticipant}
                  />
                </div>
              </div>
            )}
          </form.Field>

          <div className="h-4" />
        </div>
      </form>
    </div>
  );
}
