import { createFileRoute } from "@tanstack/react-router";

function retired() {
  return Response.json({
    ok: true,
    status: "complete",
    performed: false,
    message: "Media is served from Cloudflare R2. No legacy backfill is needed.",
  }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}

export const Route = createFileRoute("/api/internal/r2-backfill")({
  server: { handlers: { GET: retired, POST: retired } },
});
