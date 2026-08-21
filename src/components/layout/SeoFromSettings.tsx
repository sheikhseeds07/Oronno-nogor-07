import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/personal-supabase/client";
import { toImg } from "@/lib/img";
import { readPublicSettingsCache, writePublicSettingsCache } from "@/lib/public-settings-cache";

export type SeoSettings = {
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  seo_og_image?: string;
  seo_site_url?: string;
  seo_google_verification?: string;
  seo_robots?: string;
};

type SettingsRow = { settings: SeoSettings | null };

function setMeta(attr: "name" | "property", key: string, content?: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href?: string) {
  if (!href) return;
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Applies admin SEO settings without repeatedly downloading them from Supabase. */
export function SeoFromSettings() {
  const { data: row } = useQuery<SettingsRow | null>({
    queryKey: ["site-settings-public"],
    initialData: () => {
      const settings = readPublicSettingsCache<SeoSettings>();
      return settings ? { settings } : undefined;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("settings")
        .maybeSingle();
      if (error) throw error;
      const next = (data?.settings as SeoSettings | null) ?? {};
      writePublicSettingsCache(next);
      return { settings: next };
    },
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const s = row?.settings ?? {};
  const path = typeof window === "undefined" ? "/" : window.location.pathname;
  const isHome = path === "/";

  useEffect(() => {
    if (typeof document === "undefined") return;
    const base = (s.seo_site_url || "").replace(/\/$/, "");
    const url = base ? `${base}${path}` : undefined;
    const ogImage = s.seo_og_image
      ? new URL(toImg(s.seo_og_image), window.location.origin).toString()
      : undefined;

    setMeta("name", "robots", s.seo_robots);
    setMeta("name", "google-site-verification", s.seo_google_verification);
    setLink("canonical", url);
    if (!isHome) return;

    if (s.seo_title) {
      document.title = s.seo_title;
      setMeta("property", "og:title", s.seo_title);
      setMeta("name", "twitter:title", s.seo_title);
    }
    setMeta("name", "description", s.seo_description);
    setMeta("property", "og:description", s.seo_description);
    setMeta("name", "twitter:description", s.seo_description);
    setMeta("name", "keywords", s.seo_keywords);
    setMeta("property", "og:image", ogImage);
    setMeta("name", "twitter:image", ogImage);
    setMeta("property", "og:url", url);
  }, [s.seo_title, s.seo_description, s.seo_keywords, s.seo_og_image, s.seo_site_url, s.seo_google_verification, s.seo_robots, path, isHome]);

  return null;
}
