import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/party/$partyId")({
  component: () => <div>Hello /party/$partyId!</div>,
});
