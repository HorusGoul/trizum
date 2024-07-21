import { IconButton } from "#src/ui/IconButton.js";
import { useRouter } from "@tanstack/react-router";

export function BackButton() {
  const { history } = useRouter();

  return (
    <IconButton
      icon="arrow-left"
      aria-label="Go Back"
      onPress={() => {
        history.go(-1);
      }}
    />
  );
}
