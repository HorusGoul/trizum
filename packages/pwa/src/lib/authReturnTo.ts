import { z } from "zod";

/** Authentication may return to an app path, never an external destination. */
function normalizeAuthReturnTo(value: string): string | undefined {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\p{Cc}\s]/u.test(value)
  )
    return undefined;

  try {
    const url = new URL(value, "https://trizum.app");

    if (url.origin !== "https://trizum.app" || url.pathname.startsWith("//")) return undefined;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

const parseAuthReturnToSchema = z
  .string()
  .transform(normalizeAuthReturnTo)
  .optional()
  .catch(undefined);

export const parseAuthReturnTo = parseAuthReturnToSchema.parse.bind(parseAuthReturnToSchema);
