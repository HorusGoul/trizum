export function getAppLink(path: string) {
  if (window.location.origin.includes("horusdev") || import.meta.env.DEV) {
    // Preview environment or development
    return `${window.location.origin}${path}`;
  }

  return `https://trizum.app${path}`;
}
