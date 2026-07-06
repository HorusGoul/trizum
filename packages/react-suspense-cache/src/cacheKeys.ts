export function getDefaultCacheKey(params: readonly unknown[]): string {
  return params.map((param) => String(param)).join(",");
}
