import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/internal/r2-backfill")({
  server: { handlers: { POST: async () => new Response("Migration endpoint retired", { status: 410 }) } },
});
