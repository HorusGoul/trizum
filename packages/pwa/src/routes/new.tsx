import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/new")({
  component: () => <div>Hello /new!</div>,
});
