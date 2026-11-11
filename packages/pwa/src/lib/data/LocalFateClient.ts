import { FateClient, type Entity, type Selection, type View, type ViewRef } from "@nkzw/fate";
import type { appRoots, appMutations } from "./schema.ts";

export type AppClient = FateClient<typeof appRoots, typeof appMutations>;

/** Source hydration is part of reference construction, before a React view reads it. */
export class LocalFateClient extends FateClient<typeof appRoots, typeof appMutations> {
  constructor(
    options: ConstructorParameters<typeof FateClient<typeof appRoots, typeof appMutations>>[0],
    private readonly prepareLocal: (type: string, id: string, missing: boolean) => void,
  ) {
    super(options);
  }

  override ref<Model extends Entity>(
    type: Model["__typename"],
    id: string | number,
    selected: View<Model, Selection<Model>>,
  ): ViewRef<Model["__typename"]> {
    const ref = super.ref<Model>(type, id, selected);
    this.prepareLocal(type, String(id), !super.peekView(selected, ref));

    return ref;
  }
}

declare module "@nkzw/fate" {
  interface ClientRegistration {
    client: LocalFateClient;
  }
}
