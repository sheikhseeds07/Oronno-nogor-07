type FbqArgs = unknown[];
type Fbq = (...args: FbqArgs) => void;

type QueuedEvent = {
  event: string;
  params?: Record<string, unknown>;
  eventID: string;
};

const QUEUE_KEY = "oronno_fb_event_queue_v1";
const PIXEL_CACHE_KEY = "oronno_fb_pixel_id_v1";
const MAX_QUEUE = 50;
let memoryQueue: QueuedEvent[] = [];
let mirrorEnabled = true;

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

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
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

function mirrorToCapi(item: QueuedEvent) {
  if (!mirrorEnabled || typeof window === "undefined" || item.event === "Purchase") return;
  void fetch("/api/public/fb-capi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      event: {
        event_name: item.event,
        event_id: item.eventID,
        event_source_url: window.location.href,
        custom_data: item.params ?? {},
      },
    }),
  }).catch(() => undefined);
}

function send(item: QueuedEvent, fbq: Fbq) {
  try { fbq("track", item.event, item.params ?? {}, { eventID: item.eventID }); } catch { /* ignore */ }
  mirrorToCapi(item);
}

function enqueue(item: QueuedEvent) {
  writeQueue([...readQueue(), item]);
}

export function flushFbqQueue() {
  const fbq = getFbq();
  if (!fbq) return;
  const queue = readQueue();
  writeQueue([]);
  queue.forEach((item) => send(item, fbq));
}

export function fbqTrack(event: string, params?: Record<string, unknown>, eventID = uuid()) {
  const item = { event, params, eventID };
  const fbq = getFbq();
  if (fbq) {
    send(item, fbq);
  } else {
    enqueue(item);
  }
  return eventID;
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

export function trackPurchase(items: PixelItem[], value: number, eventID?: string) {
  const id = eventID ?? uuid();
  const params = { content_ids: items.map((i) => i.id), content_type: "product", contents: toContentItems(items), num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0), value, currency: "BDT" };
  const item = { event: "Purchase", params, eventID: id };
  const fbq = getFbq();
  if (fbq) send(item, fbq); else enqueue(item);
  return id;
}
