import { z } from "zod";

const failureMessageSchema = z.object({ message: z.string() });

export function getFailureMessage(cause: unknown) {
  const result = failureMessageSchema.safeParse(cause);

  return result.success ? result.data.message : undefined;
}
