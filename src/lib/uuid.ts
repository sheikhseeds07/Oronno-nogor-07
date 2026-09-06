// Safe UUID generator for embedded browsers (Facebook / Instagram in-app WebView)
// where crypto.randomUUID may be missing or throw.
export function safeUUID(): string {
  try {
    const c = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    const bytes = new Uint8Array(16);
    if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
  } catch {
    return `u-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  }
}
