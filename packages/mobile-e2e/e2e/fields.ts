import type { Screen } from "e2e";

/**
 * A text field by its label. iOS names a WebView field after its label;
 * Android leaves it unnamed and exposes the label, followed by any help text,
 * as the placeholder.
 */
export function textField(screen: Screen, label: string) {
  const escaped = label.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

  return screen
    .getByRole("textbox", label)
    .or(screen.getByPlaceholder(new RegExp(`^${escaped}(?: |$)`)));
}
