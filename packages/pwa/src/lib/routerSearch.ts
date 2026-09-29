import { defaultParseSearch, defaultStringifySearch } from "@tanstack/react-router";

/** Codes are opaque text: JSON coercion loses exponent spelling and integer precision. */
export function parseAppSearch(search: string): Record<string, unknown> {
  const parsed: Record<string, unknown> = defaultParseSearch(search);
  const codes = new URLSearchParams(search).getAll("code");
  if (codes.length === 1) parsed.code = codes[0];
  return parsed;
}

export function stringifyAppSearch(search: Record<string, unknown>): string {
  const serialized = defaultStringifySearch(search);
  if (typeof search.code !== "string") return serialized;
  const params = new URLSearchParams(serialized);
  params.set("code", search.code);
  return `?${params}`;
}
