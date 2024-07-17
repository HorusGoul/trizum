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

export const Route = createFileRoute("/new")({
  component: New,
});

interface NewPartyFormValues {
  name: string;
  description: string;
  participants: Pick<PartyParticipant, "name">[];
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
      participants: [],
    },
    onSubmit: ({ value }) => {
      onCreateParty(value);
    },
  });

  const formId = useId();

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

          {/* TODO: Participant editor */}
        </div>
      </form>
    </div>
  );
}
