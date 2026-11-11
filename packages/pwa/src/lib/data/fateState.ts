import { createClient, toEntityId, view } from "@nkzw/fate";
import { useState, useSyncExternalStore } from "react";

interface StateRecord {
  __typename: "ClientState";
  id: string;
  value: object;
}

/** SDK-backed and locally resolved data use the same Fate snapshot semantics. */
export function createFateState<Value>(initial: Value) {
  const client = createClient({ types: [{ type: "ClientState", fields: { value: "scalar" } }] });
  const stateView = view<StateRecord>()({ value: true });
  const ref = client.ref<StateRecord>("ClientState", "state", stateView);
  const fields = new Set(["value"]);

  function set(value: Value) {
    client.write(
      "ClientState",
      { __typename: "ClientState", id: "state", value: { current: value } },
      fields,
    );
  }

  set(initial);

  function getSnapshot(): Value {
    // SAFETY: This private single-record store is seeded with Value and only set(Value) writes it.
    return (client.peekView(stateView, ref)!.data.value as { current: Value }).current;
  }

  return {
    getSnapshot,
    set,
    update: (apply: (previous: Value) => Value) => set(apply(getSnapshot())),
    subscribe: (listener: () => void) =>
      client.store.subscribe(toEntityId("ClientState", "state"), fields, listener),
  };
}

export function useFateState<Value>(initial: Value) {
  const [state] = useState(() => createFateState(initial));
  const value = useSyncExternalStore(state.subscribe, state.getSnapshot, state.getSnapshot);

  return [value, state.set, state.update] as const;
}
