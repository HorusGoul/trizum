import { useView, useViews } from "react-fate";
import type { View, ViewEntityName, ViewRef } from "@nkzw/fate";

/** All required domain views include the transport's availability field. */
export function useRequiredView<Selected extends View<any, any>>(
  selected: Selected,
  ref: ViewRef<ViewEntityName<Selected>>,
) {
  const entity = useView(selected, ref);

  if (!("available" in entity) || !entity.available) throw new Error("Record unavailable");

  return entity;
}

export function useRequiredViews<Selected extends View<any, any>>(
  selected: Selected,
  refs: ViewRef<ViewEntityName<Selected>>[],
) {
  const entities = useViews(selected, refs);

  for (const entity of entities) {
    if (!("available" in entity) || !entity.available) throw new Error("Record unavailable");
  }

  return entities;
}
