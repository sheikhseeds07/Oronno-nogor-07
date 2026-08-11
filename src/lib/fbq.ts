// Lightweight Facebook Pixel helper. Safe to call from anywhere — no-ops on SSR
// or if the pixel hasn't loaded yet. The pixel itself is initialized by
// <FacebookPixel /> (site-wide) and by landing pages (per-page).

type FbqArgs = unknown[];
type Fbq = (...args: FbqArgs) => void;

function getFbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { fbq?: Fbq };
  return typeof w.fbq === "function" ? w.fbq : null;
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
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    contents: toContentItems([item]),
    value: (item.price ?? 0) * (item.quantity ?? 1),
    currency: "BDT",
  });
}

export function trackAddToCart(item: PixelItem) {
  fbqTrack("AddToCart", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    contents: toContentItems([item]),
    value: (item.price ?? 0) * (item.quantity ?? 1),
    currency: "BDT",
  });
}

export function trackInitiateCheckout(items: PixelItem[], value: number) {
  fbqTrack("InitiateCheckout", {
    content_ids: items.map((i) => i.id),
    content_type: "product",
    contents: toContentItems(items),
    num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
    value,
    currency: "BDT",
  });
}

export function trackPurchase(items: PixelItem[], value: number, eventID?: string) {
  fbqTrack(
    "Purchase",
    {
      content_ids: items.map((i) => i.id),
      content_type: "product",
      contents: toContentItems(items),
      num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
      value,
      currency: "BDT",
    },
    eventID,
  );
}

export function trackLead(params?: Record<string, unknown>) {
  fbqTrack("Lead", params);
}
