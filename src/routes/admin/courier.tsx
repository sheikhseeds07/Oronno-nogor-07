import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/courier")({
  beforeLoad: () => { throw redirect({ to: "/admin/all-api" }); },
  component: () => null,
});
