const tricountUrlPattern = /https?:\/\/(?:www\.)?tricount\.com\/[^\s<>"']+/i;
const tricountKeyPattern = /^[a-zA-Z0-9]+$/;
const localeSegmentPattern = /^[a-z]{2}(?:-[a-z]{2})?$/i;

export function extractTricountId(input: string): string | null {
  const value = input.trim();
  const urlMatch = value.match(tricountUrlPattern);

  if (urlMatch) {
    return extractTricountIdFromUrl(urlMatch[0]);
  }

  if (tricountKeyPattern.test(value)) {
    return value;
  }

  return null;
}

function extractTricountIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value.replace(/[),.;:!?]+$/, ""));
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const idSegments =
      pathSegments.length > 1 && localeSegmentPattern.test(pathSegments[0] ?? "")
        ? pathSegments.slice(1)
        : pathSegments;

    return idSegments.find((segment) => tricountKeyPattern.test(segment)) ?? null;
  } catch {
    return null;
  }
}
