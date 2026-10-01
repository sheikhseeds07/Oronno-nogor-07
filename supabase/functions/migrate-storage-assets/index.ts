// Legacy migration is acknowledged without DB, Storage, or upstream requests.
Deno.serve(() => new Response(JSON.stringify({ ok: true, status: "complete", performed: false, storage: "r2" }), {
  status: 200,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
}));
