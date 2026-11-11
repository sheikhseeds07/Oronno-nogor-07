import { useEffect } from "react";
import { safeUUID } from "@/lib/uuid";

type TikTokBridge = (event: string, properties?: Record<string, unknown>, eventId?: string) => string;
declare global { interface Window { ttq?: any; __oronnoTikTokOwner?: boolean; __oronnoTikTokTrack?: TikTokBridge; } }

function init(pixelId: string) {
  if (typeof window === "undefined") return;
  const w = window as Window;
  if (!w.ttq) {
    const ttq: any = [];
    ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
    ttq.setAndDefer = (target: any, method: string) => { target[method] = (...args: unknown[]) => target.push([method, ...args]); };
    for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
    ttq.load = (id: string, options?: Record<string, unknown>) => {
      ttq._i = ttq._i || {};
      ttq._i[id] = [];
      ttq._i[id]._u = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._t = ttq._t || {};
      ttq._t[id] = Date.now();
      ttq._o = ttq._o || {};
      ttq._o[id] = options || {};
      const script = document.createElement("script");
      script.async = true;
      script.type = "text/javascript";
      script.dataset.oronnoTiktok = "1";
      script.src = "https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=" + encodeURIComponent(id) + "&lib=ttq";
      if (!document.querySelector('script[data-oronno-tiktok="1"]')) document.head.appendChild(script);
    };
    w.ttq = ttq;
  }
  if (!w.ttq._i?.[pixelId]) w.ttq.load(pixelId);
}
function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}
function writeAttributionCookie(name: string, value: string) {
  document.cookie = name + "=" + encodeURIComponent(value) + "; Max-Age=7776000; Path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
}
export function TikTokPixel() {
  useEffect(() => {
    if (window.location.pathname.startsWith("/admin") || window.__oronnoTikTokOwner) return;
    window.__oronnoTikTokOwner = true;
    const initialClickId = new URLSearchParams(window.location.search).get("ttclid");
    if (initialClickId) writeAttributionCookie("_ttclid", initialClickId);
    let lastPath = "";
    let enabled = false;
    const send: TikTokBridge = (event, properties = {}, eventId = safeUUID() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) => {
      if (!enabled || !window.ttq) return eventId;
      const params = { ...properties, event_id: eventId };
      if (event === "PageView") window.ttq.page();
      else window.ttq.track(event, params);
      void fetch("/api/public/tiktok-events", {
        method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify({ event, event_id: eventId, event_source_url: window.location.href, properties, ttclid: readCookie("_ttclid"), ttp: readCookie("_ttp") }),
      }).catch(() => undefined);
      return eventId;
    };
    const pageView = () => {
      const path = window.location.pathname + window.location.search;
      if (path === lastPath || path.startsWith("/admin")) return;
      lastPath = path;
      send("PageView");
    };
    let active = true;
    void fetch("/api/public/tiktok-events").then(response => response.ok ? response.json() : null).then(config => {
      if (!active || !config?.enabled || !config?.pixel_id) return;
      init(config.pixel_id);
      enabled = true;
      pageView();
    }).catch(() => undefined);
    const originalPush = history.pushState, originalReplace = history.replaceState;
    const onRoute = () => pageView();
    history.pushState = function(...args: Parameters<History["pushState"]>) { const result = originalPush.apply(this, args); window.dispatchEvent(new Event("oronno:tiktok-route")); return result; };
    history.replaceState = function(...args: Parameters<History["replaceState"]>) { const result = originalReplace.apply(this, args); window.dispatchEvent(new Event("oronno:tiktok-route")); return result; };
    window.addEventListener("popstate", onRoute);
    window.addEventListener("oronno:tiktok-route", onRoute);
    window.__oronnoTikTokTrack = send;
    return () => {
      active = false;
      window.__oronnoTikTokOwner = false;
      history.pushState = originalPush;
      history.replaceState = originalReplace;
      window.removeEventListener("popstate", onRoute);
      window.removeEventListener("oronno:tiktok-route", onRoute);
      delete window.__oronnoTikTokTrack;
    };
  }, []);
  return null;
}
