export function retiredStorageResponse(input: RequestInfo | URL): Response | null {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  try {
    const url = new URL(raw, "https://sheikhseeds.com");
    if (!/^\/storage\/v1(?:\/|$)/.test(url.pathname)) return null;
    return Response.json({ error: "Supabase Storage is retired. Use the R2 media endpoints." }, { status: 410 });
  } catch { return null; }
}
