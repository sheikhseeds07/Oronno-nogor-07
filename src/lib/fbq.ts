// Lightweight Facebook Pixel helper. Safe to call from anywhere — no-ops on SSR.
// Purchase waits briefly for the Pixel library so slow script loading does not
// silently lose conversions. Browser Purchase uses the same eventID as CAPI.

type FbqArgs = unknown[];
type Fbq = (...args: FbqArgs) => void;

function getFbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { fbq?: Fbq };
  return typeof w.fbq === "function" ? w.fbq : null;
}

function waitForFbq(timeoutMs = 5000): Promise<Fbq | null> {
  const existing = getFbq();
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const fbq = getFbq();
      if (fbq || Date.now() - started >= timeoutMs) {
        window.clearInterval(timer);
        resolve(fbq);
      }
    }, 50);
  });
}

export function fbqTrack(event: string, params?: Record<string, unknown>, eventID?: string) {
  const fbq = getFbq();
  if (!fbq) return;
  try {
    if (eventID) fbq("track", event, params ?? {}, { eventID });
    else if (params) fbq("track", event, params);
    else fbq("track", event);
  } catch {
    /* ignore */
  }
}

export type PixelItem = {
  id: string;
  name?: string;
  price?: number;
  quantity?: number;
};

function toContentItems(items: PixelItem[]) {
  return items.map((i) => ({ id: i.id, quantity: i.quantity ?? 1, item_price: i.price ?? 0 }));
}

export function trackViewContent(item: PixelItem) {
  fbqTrack("ViewContent", {
    content_ids: [item.id], content_name: item.name, content_type: "product",
    contents: toContentItems([item]), value: (item.price ?? 0) * (item.quantity ?? 1), currency: "BDT",
  });
}

export function trackAddToCart(item: PixelItem) {
  fbqTrack("AddToCart", {
    content_ids: [item.id], content_name: item.name, content_type: "product",
    contents: toContentItems([item]), value: (item.price ?? 0) * (item.quantity ?? 1), currency: "BDT",
  });
}

export function trackInitiateCheckout(items: PixelItem[], value: number) {
  fbqTrack("InitiateCheckout", {
    content_ids: items.map((i) => i.id), content_type: "product", contents: toContentItems(items),
    num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0), value, currency: "BDT",
  });
}

export function trackPurchase(items: PixelItem[], value: number, eventID?: string) {
  const send = (fbq: Fbq) => {
    try {
      const params = {
        content_ids: items.map((i) => i.id), content_type: "product", contents: toContentItems(items),
        num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0), value, currency: "BDT",
      };
      if (eventID) fbq("track", "Purchase", params, { eventID });
      else fbq("track", "Purchase", params);
    } catch {
      /* ignore */
    }
  };

  // Unlike the other events, never immediately drop Purchase when fbq is
  // still loading. This is the conversion event we must not lose.
  void waitForFbq().then((fbq) => {
    if (fbq) send(fbq);
    else console.warn("[FB Pixel] Purchase could not be sent", { eventID });
  });
}

export function trackLead(params?: Record<string, unknown>) {
  fbqTrack("Lead", params);
}
