import { Toaster as SonnerToaster } from "sonner";
import {
  toastClassNames,
  toastIcons,
  toastMobileOffset,
  toastOffset,
  toastStyle,
  toastTheme,
} from "./Toaster.config.js";

export function Toaster() {
  // Swipe intent thresholds are tuned in patches/sonner@2.0.8.patch.
  return (
    <SonnerToaster
      position="bottom-center"
      theme={toastTheme}
      richColors={false}
      gap={8}
      offset={toastOffset}
      mobileOffset={toastMobileOffset}
      style={toastStyle}
      swipeDirections={["left", "right", "bottom"]}
      icons={toastIcons}
      toastOptions={{
        unstyled: true,
        classNames: toastClassNames,
      }}
    />
  );
}
