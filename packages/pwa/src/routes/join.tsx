import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/join")({
  component: () => <div>Hello /join!</div>,
});
