import { Toaster as SonnerToaster } from "sonner";
import {
  toastClassNames,
  toastIcons,
  toastMobileOffset,
  toastOffset,
  toastStyle,
} from "./Toaster.config";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      theme="system"
      richColors={false}
      gap={8}
      offset={toastOffset}
      mobileOffset={toastMobileOffset}
      style={toastStyle}
      swipeDirections={["bottom", "right", "left"]}
      icons={toastIcons}
      toastOptions={{
        unstyled: true,
        classNames: toastClassNames,
      }}
    />
  );
}
