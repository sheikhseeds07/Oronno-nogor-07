// R2 migration is complete. Retired endpoint: no DB, Storage, or upstream calls.
Deno.serve(() => new Response(JSON.stringify({ error: "Storage migration endpoint retired; use Cloudflare R2" }), {
  status: 410,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
}));
