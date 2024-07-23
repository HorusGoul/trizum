import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/party/$partyId/add")({
  component: () => <div>Hello /party/$partyId/add!</div>,
});
