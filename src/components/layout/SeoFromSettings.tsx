import { useEffect } from "react";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";
import { useQuery } from "@tanstack/react-query";
import { toImg } from "@/lib/img";
import { WaitPopupEnhancer } from "./WaitPopupEnhancer";

export type SeoSettings = {
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  seo_og_image?: string;
  seo_site_url?: string;
  seo_google_verification?: string;
  seo_robots?: string;
  logo_url?: string;
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

/** Applies admin SEO settings and the configured site logo as the favicon. */
export function SeoFromSettings() {
  const { data: row } = useQuery(publicSiteSettingsQuery) as { data: SettingsRow | null | undefined };
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

    const favicon = s.logo_url ? toImg(s.logo_url) : "/icon-512-v2.png";
    setLink("icon", new URL(favicon, window.location.origin).toString());
    setLink("shortcut icon", new URL(favicon, window.location.origin).toString());
    setLink("apple-touch-icon", new URL(favicon, window.location.origin).toString());

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
  }, [s.logo_url, s.seo_title, s.seo_description, s.seo_keywords, s.seo_og_image, s.seo_site_url, s.seo_google_verification, s.seo_robots, path, isHome]);

  return <WaitPopupEnhancer />;
}
