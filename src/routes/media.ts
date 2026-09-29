import { createFileRoute } from "@tanstack/react-router";

const R2_PUBLIC_BASE = "https://images.sheikhseeds.com";
const SUPABASE_STORAGE_HOSTS = new Set([
  "bvuhvzccziuniujeogng.supabase.co",
  "frtzlibogmethppqmhtr.supabase.co",
  "yqhtenonavuzxzemaiyk.supabase.co",
]);

function legacyStorageToR2(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (!SUPABASE_STORAGE_HOSTS.has(parsed.hostname)) return null;
    const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const bucket = encodeURIComponent(decodeURIComponent(match[1]));
    const path = match[2].split("/").map((part) => encodeURIComponent(decodeURIComponent(part))).join("/");
    return `${R2_PUBLIC_BASE}/${bucket}/${path}`;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const src = new URL(request.url).searchParams.get("src");
        if (!src) return new Response("Missing src", { status: 400 });

        const r2Url = legacyStorageToR2(src);
        if (r2Url) {
          return Response.redirect(r2Url, 302);
        }

        try {
          const parsed = new URL(src);
          if (parsed.protocol === "https:" && parsed.hostname === "images.sheikhseeds.com") {
            return Response.redirect(parsed.toString(), 302);
          }
        } catch {}

        return new Response("Unsupported media source", {
          status: 400,
          headers: { "Cache-Control": "private, no-store" },
        });
      },
    },
  },
});
