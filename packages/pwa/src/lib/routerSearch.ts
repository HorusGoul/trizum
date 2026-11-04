import { z } from "zod";
import { defaultParseSearch, defaultStringifySearch } from "@tanstack/react-router";

export type AppSearchValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | AppSearchValue[]
  | AppSearch;

/** The router's JSON-decoded query values, before individual routes validate their fields. */
export interface AppSearch {
  [key: string]: AppSearchValue;
}

/** Codes are opaque text: JSON coercion loses exponent spelling and integer precision. */
export function parseAppSearch(search: string): AppSearch {
  const parsed: AppSearch = defaultParseSearch(search);
  const codes = new URLSearchParams(search).getAll("code");

  if (codes.length === 1) parsed.code = codes[0];

  return parsed;
}

export function stringifyAppSearch(search: AppSearch): string {
  const serialized = defaultStringifySearch(search);

  const code = optionalSearchTextSchema.parse(search.code);

  if (code === undefined) return serialized;
  const params = new URLSearchParams(serialized);
  params.set("code", code);

  return `?${params}`;
}

export const optionalSearchTextSchema = z.string().optional().catch(undefined);
export const optionalNonemptySearchTextSchema = z.string().min(1).optional().catch(undefined);
export const optionalSearchNumberSchema = z.number().optional().catch(undefined);
export const optionalMediaIndexSchema = z.number().min(0).optional().catch(undefined);

export const expenseEditorSearchSchema = z.object({
  calculator: optionalNonemptySearchTextSchema,
  media: optionalMediaIndexSchema,
});
