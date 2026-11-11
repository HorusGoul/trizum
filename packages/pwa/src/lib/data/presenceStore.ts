import type { DocHandle } from "@automerge/automerge-repo/slim";
import { z } from "zod";
import type { ExpensePresenceEntity } from "./entities.ts";

const messageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("expense-presence-update"),
    data: z.object({
      expenseId: z.string(),
      participantId: z.string(),
      elementId: z.string(),
      dateTime: z.coerce.date(),
    }),
  }),
  z.object({
    type: z.literal("expense-presence-delete"),
    data: z.object({ expenseId: z.string(), participantId: z.string() }),
  }),
]);

export function createPresenceStore(publish: (presence: ExpensePresenceEntity) => void) {
  const entries = new Map<string, { value: ExpensePresenceEntity; stop(): void }>();
  let timer: ReturnType<typeof setInterval> | undefined;

  function prepare(id: string, handle: DocHandle<object>, force: boolean) {
    const existing = entries.get(id);

    if (existing) {
      if (force) publish(existing.value);

      return;
    }

    const value: ExpensePresenceEntity = { __typename: "ExpensePresence", id, participants: [] };

    const listener = ({ message }: { message: unknown }) => {
      const result = messageSchema.safeParse(message);

      if (!result.success || result.data.data.expenseId !== id) return;
      const payload = result.data;
      value.participants = value.participants.filter(
        ({ participantId }) => participantId !== payload.data.participantId,
      );

      if (payload.type === "expense-presence-update") value.participants.push(payload.data);
      publish({ ...value });
    };

    handle.on("ephemeral-message", listener);
    entries.set(id, { value, stop: () => handle.off("ephemeral-message", listener) });
    publish({ ...value });
    timer ??= setInterval(() => {
      const cutoff = Date.now() - 10_000;

      for (const entry of entries.values()) {
        const active = entry.value.participants.filter(
          ({ dateTime }) => dateTime.getTime() >= cutoff,
        );

        if (active.length !== entry.value.participants.length) {
          entry.value.participants = active;
          publish({ ...entry.value });
        }
      }
    }, 5000);
  }

  return {
    prepare,
    get: (id: string) => entries.get(id)?.value,
    dispose() {
      clearInterval(timer);

      for (const entry of entries.values()) entry.stop();
      entries.clear();
    },
  };
}
