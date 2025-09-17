import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      theme="dark"
      richColors={true}
      swipeDirections={["bottom", "right", "left"]}
    />
  );
}
