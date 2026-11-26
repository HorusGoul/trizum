import type { Device } from "@e2e-dev/mobile";
import type { Screen } from "e2e";

/**
 * Closes the soft keyboard the same way the Maestro flows do: the WKWebView
 * keyboard toolbar's Done button on iOS, and the platform dismiss on Android.
 */
export async function closeKeyboard({
  platform,
  screen,
  device,
}: {
  platform: string;
  screen: Screen;
  device: Device;
}) {
  if (platform === "ios") {
    await screen.getByRole("button", "Done").tap();
  } else {
    await device.dismissKeyboard();
  }
}
