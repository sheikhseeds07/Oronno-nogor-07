import { createFileRoute } from "@tanstack/react-router";
import { buildSitemapXml, sitemapResponse } from "@/lib/sitemap.server";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => sitemapResponse(await buildSitemapXml()),
    },
  },
});
