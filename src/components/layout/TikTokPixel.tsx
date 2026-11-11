import { useEffect } from "react";
import { safeUUID } from "@/lib/uuid";

type TikTokFn = ((...args: unknown[]) => void) & { methods?: string[]; setAndDefer?: (target: Record<string, unknown>, method: string) => void; instance?: (id: string) => TikTokFn; load?: (id: string, options?: Record<string, unknown>) => void; page?: () => void; track?: (event: string, properties?: Record<string, unknown>) => void; identify?: (data: Record<string, unknown>) => void; ready?: (callback: () => void) => void; };

declare global { interface Window { ttq?: TikTokFn; __oronnoTikTokOwner?: boolean; } }
const methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
function init(pixelId: string) {
  if (typeof window === "undefined") return;
  const w = window as Window;
  if (!w.ttq) {
    const ttq = function(this: unknown, ...args: unknown[]) { (ttq as unknown as { queue: unknown[][] }).queue.push(args); } as TikTokFn & { queue: unknown[][]; _i: unknown[]; _t: Record<string, number>; _o: Record<string, unknown>; };
    ttq.queue = []; ttq._i = []; ttq._t = {}; ttq._o = {};
    for (const method of methods) ttq[method as keyof TikTokFn] = ((...args: unknown[]) => ttq.queue.push([method, ...args])) as never;
    ttq.load = (id: string, options?: Record<string, unknown>) => {
      ttq._i.push([id, options] as never);
      const script = document.createElement("script"); script.async = true; script.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(id)}&lib=ttq`; script.dataset.oronnoTikTok = "1";
      if (!document.querySelector('script[data-oronno-tiktok="1"]')) document.head.appendChild(script);
    };
    ttq.page = () => ttq.queue.push(["page"]);
    ttq.track = (event: string, properties?: Record<string, unknown>) => ttq.queue.push(["track", event, properties]);
    w.ttq = ttq;
  }
  const ttq = w.ttq;
  if (!(ttq as unknown as { _i?: unknown[] })._i?.some((entry: unknown) => Array.isArray(entry) && entry[0] === pixelId)) ttq.load?.(pixelId);
}
export function TikTokPixel() {
  useEffect(() => {
    if (window.location.pathname.startsWith("/admin") || window.__oronnoTikTokOwner) return;
    window.__oronnoTikTokOwner = true;
    let lastPath = "";
    let enabled = false;
    const send = (event: string, properties: Record<string, unknown> = {}, eventId = safeUUID() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) => {
      if (!enabled || !window.ttq) return eventId;
      const ttq = window.ttq;
      const params = { ...properties, event_id: eventId };
      if (event === "PageView") ttq.page?.();
      else ttq.track?.(event, params);
      const readCookie = (name: string) => document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"))?.[1] ? decodeURIComponent(document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"))![1]) : null;
      void fetch("/api/public/tiktok-events", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ event, event_id: eventId, event_source_url: window.location.href, properties, ttclid: new URLSearchParams(window.location.search).get("ttclid"), ttp: readCookie("_ttp") }) }).catch(() => undefined);
      return eventId;
    };
    const pageView = () => { const path = window.location.pathname + window.location.search; if (path === lastPath || path.startsWith("/admin")) return; lastPath = path; send("PageView"); };
    let active = true;
    void fetch("/api/public/tiktok-events").then(r => r.ok ? r.json() : null).then(config => {
      if (!active || !config?.enabled || !config?.pixel_id) return;
      init(config.pixel_id); enabled = true; pageView();
    }).catch(() => undefined);
    const originalPush = history.pushState, originalReplace = history.replaceState;
    const onRoute = () => pageView();
    history.pushState = function(...args: Parameters<History["pushState"]>) { const result = originalPush.apply(this,args); window.dispatchEvent(new Event("oronno:tiktok-route")); return result; };
    history.replaceState = function(...args: Parameters<History["replaceState"]>) { const result = originalReplace.apply(this,args); window.dispatchEvent(new Event("oronno:tiktok-route")); return result; };
    window.addEventListener("popstate", onRoute); window.addEventListener("oronno:tiktok-route", onRoute);
    const api = window as Window & { __oronnoTikTokTrack?: (event: string, properties?: Record<string, unknown>, eventId?: string) => string };
    api.__oronnoTikTokTrack = send;
    return () => { active = false; window.__oronnoTikTokOwner = false; history.pushState = originalPush; history.replaceState = originalReplace; window.removeEventListener("popstate",onRoute); window.removeEventListener("oronno:tiktok-route",onRoute); delete api.__oronnoTikTokTrack; };
  }, []);
  return null;
}
