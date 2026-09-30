import { createFileRoute } from "@tanstack/react-router";

function retired() {
  return Response.json({
    error: "legacy_storage_migration_retired",
    message: "Media is served from Cloudflare R2. Supabase Storage backfill is permanently disabled.",
  }, { status: 410, headers: { "Cache-Control": "private, no-store" } });
}

export const Route = createFileRoute("/api/internal/r2-backfill")({
  server: { handlers: { GET: retired, POST: retired } },
});
