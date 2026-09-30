import { getFbContext } from "@/lib/fb-context";
import { safeUUID } from "@/lib/uuid";

type FbqArgs = unknown[];
type Fbq = (...args: FbqArgs) => void;

type QueuedEvent = {
  event: string;
  params?: Record<string, unknown>;
  eventID: string;
};

const QUEUE_KEY = "oronno_fb_event_queue_v1";
const PIXEL_CACHE_KEY = "oronno_fb_pixel_id_v1";
const SENT_KEY = "oronno_fb_sent_ids_v1";
const MAX_QUEUE = 500;
const MAX_SENT_IDS = 200;
const DUPLICATE_WINDOW_MS = 750;
let memoryQueue: QueuedEvent[] = [];
let mirrorEnabled = true;
/** Guards against the same event id being sent twice inside one page session (StrictMode / re-renders). */
const inFlight = new Set<string>();
const recentEvents = new Map<string, { id: string; at: number }>();

function getFbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fbq === "function" ? fbq : null;
}

function readQueue(): QueuedEvent[] {
  if (typeof window === "undefined") return memoryQueue;
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE) : [];
  } catch {
    return memoryQueue;
  }
}

function writeQueue(queue: QueuedEvent[]) {
  memoryQueue = queue.slice(-MAX_QUEUE);
  if (typeof window === "undefined") return;
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(memoryQueue)); } catch { /* ignore */ }
}

/**
 * Durable "already counted" ledger, keyed by event id. Used for one-per-order
 * events so a page refresh, back-navigation, or restored tab never re-counts.
 */
function readSentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function markSent(id: string) {
  if (typeof window === "undefined") return;
  try {
    const next = [...readSentIds().filter((v) => v !== id), id].slice(-MAX_SENT_IDS);
    localStorage.setItem(SENT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

function alreadySent(id: string) {
  return inFlight.has(id) || readSentIds().includes(id);
}

function uuid() {
  return safeUUID() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function getCachedPixelId() {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(PIXEL_CACHE_KEY); } catch { return null; }
}

export function setCachedPixelId(pixelId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (pixelId) localStorage.setItem(PIXEL_CACHE_KEY, pixelId);
    else localStorage.removeItem(PIXEL_CACHE_KEY);
  } catch { /* ignore */ }
}

export function setCapiMirrorEnabled(enabled: boolean) { mirrorEnabled = enabled; }

/**
 * Server-side (Conversions API) copy of a browser event, sent with the SAME
 * event_id so Meta deduplicates browser + server into a single event.
 * Purchase is skipped here: the order server function sends it with the order
 * id as event_id, which keeps exactly one Purchase per order.
 */
function mirrorToCapi(item: QueuedEvent) {
  if (!mirrorEnabled || typeof window === "undefined" || item.event === "Purchase") return;
  const ctx = getFbContext();
  void fetch("/api/public/fb-capi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      event: {
        event_name: item.event,
        event_id: item.eventID,
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: ctx.source_url ?? window.location.href,
        custom_data: item.params ?? {},
        fbp: ctx.fbp,
        fbc: ctx.fbc,
      },
    }),
  }).catch(() => undefined);
}

function sendBrowser(item: QueuedEvent, fbq: Fbq) {
  try {
    fbq("track", item.event, item.params ?? {}, { eventID: item.eventID });
    return true;
  } catch {
    return false;
  }
}

function queueHasEventId(id: string) {
  return readQueue().some((item) => item.eventID === id);
}

function enqueue(item: QueuedEvent) {
  writeQueue([...readQueue(), item]);
}

export function flushFbqQueue() {
  const fbq = getFbq();
  if (!fbq) return;
  const queue = readQueue();
  const remaining: QueuedEvent[] = [];
  // Keep failed browser deliveries in the durable queue instead of dropping them.
  queue.forEach((item) => {
    if (sendBrowser(item, fbq)) markSent(item.eventID);
    else remaining.push(item);
  });
  writeQueue(remaining);
}

export function fbqTrack(event: string, params?: Record<string, unknown>, eventID?: string) {
  const now = Date.now();
  const signature = `${event}:${JSON.stringify(params ?? {})}`;
  const recent = recentEvents.get(signature);
  if (!eventID && recent && now - recent.at < DUPLICATE_WINDOW_MS) return recent.id;

  const id = eventID ?? uuid();
  if (inFlight.has(id)) return id;
  inFlight.add(id);
  recentEvents.set(signature, { id, at: now });
  window.setTimeout(() => inFlight.delete(id), DUPLICATE_WINDOW_MS);
  const item = { event, params, eventID: id };
  const fbq = getFbq();
  if (fbq) sendBrowser(item, fbq);
  else enqueue(item);
  // Always fire the server copy, even if the browser pixel is blocked or still loading.
  mirrorToCapi(item);
  return id;
}

export type PixelItem = { id: string; name?: string; price?: number; quantity?: number };
const toContentItems = (items: PixelItem[]) => items.map((i) => ({ id: i.id, quantity: i.quantity ?? 1, item_price: i.price ?? 0 }));

export function trackPageView() { return fbqTrack("PageView"); }
export function trackViewContent(item: PixelItem) {
  return fbqTrack("ViewContent", { content_ids: [item.id], content_name: item.name, content_type: "product", contents: toContentItems([item]), value: (item.price ?? 0) * (item.quantity ?? 1), currency: "BDT" });
}
export function trackAddToCart(item: PixelItem) {
  return fbqTrack("AddToCart", { content_ids: [item.id], content_name: item.name, content_type: "product", contents: toContentItems([item]), value: (item.price ?? 0) * (item.quantity ?? 1), currency: "BDT" });
}
export function trackInitiateCheckout(items: PixelItem[], value: number) {
  return fbqTrack("InitiateCheckout", { content_ids: items.map((i) => i.id), content_type: "product", contents: toContentItems(items), num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0), value, currency: "BDT" });
}
export function trackSearch(searchString: string) {
  return fbqTrack("Search", { search_string: searchString.slice(0, 200), content_type: "product" });
}
export function trackContact(params?: Record<string, unknown>) { return fbqTrack("Contact", params); }
export function trackLead(params?: Record<string, unknown>) { return fbqTrack("Lead", params); }

/**
 * Purchase: exactly one per order.
 * - event_id is the order id, shared with the server-side Conversions API copy.
 * - a durable ledger stops refreshes / back-navigation from re-counting it.
 */
export function trackPurchase(items: PixelItem[], value: number, eventID?: string) {
  const id = eventID ?? uuid();
  if (alreadySent(id) || queueHasEventId(id)) return id;
  inFlight.add(id);
  const params = { content_ids: items.map((i) => i.id), content_type: "product", contents: toContentItems(items), num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0), value: Number(value.toFixed(2)), currency: "BDT" };
  const item = { event: "Purchase", params, eventID: id };
  const fbq = getFbq();
  if (fbq) {
    if (sendBrowser(item, fbq)) markSent(id);
    else enqueue(item);
  } else {
    enqueue(item);
  }
  return id;
}
