import { useTransition } from "react";

export type AsyncAction<Args extends unknown[] = []> = (...args: Args) => void | Promise<void>;

export function useActionProp<Args extends unknown[]>({
  action,
  onAction,
}: {
  action?: AsyncAction<Args>;
  onAction?: (...args: Args) => void;
}) {
  const [isPending, startTransition] = useTransition();

  if (!action) {
    return [false, onAction] as const;
  }

  return [
    isPending,
    (...args: Args) => {
      onAction?.(...args);
      startTransition(async () => {
        await action(...args);
      });
    },
  ] as const;
}
