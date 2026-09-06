// WebView compatibility for Supabase/Auth and Community Feed.
// Some Facebook in-app browsers expose Web Crypto but not crypto.randomUUID.
type CryptoUUID = Crypto & { randomUUID?: () => string };

const makeUUID = (): string => {
  const cryptoApi = (typeof globalThis !== "undefined" ? globalThis.crypto : undefined) as CryptoUUID | undefined;
  const bytes = new Uint8Array(16);

  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
};

export function ensureCryptoRandomUUID(): void {
  if (typeof globalThis === "undefined") return;

  const cryptoApi = globalThis.crypto as CryptoUUID | undefined;

  try {
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") return;
  } catch {
    // Continue with the fallback installation.
  }

  if (cryptoApi) {
    // First try the instance. This is supported by most WebViews.
    try {
      Object.defineProperty(cryptoApi, "randomUUID", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: makeUUID,
      });
      if (typeof cryptoApi.randomUUID === "function") return;
    } catch {
      // Some WebViews expose a non-extensible Crypto object.
    }

    // Then try Crypto.prototype, which works when the instance is frozen.
    try {
      const proto = Object.getPrototypeOf(cryptoApi);
      if (proto) {
        Object.defineProperty(proto, "randomUUID", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: makeUUID,
        });
        if (typeof (globalThis.crypto as CryptoUUID).randomUUID === "function") return;
      }
    } catch {
      // Continue; Community Feed also uses safe UUID fallbacks.
    }
  }

  // Very old embedded browsers may not expose Web Crypto at all.
  // Only replace globalThis.crypto when the host allows it.
  try {
    if (!cryptoApi) {
      (globalThis as unknown as { crypto: Crypto }).crypto = {
        randomUUID: makeUUID,
        getRandomValues<T extends ArrayBufferView>(array: T): T {
          const view = new Uint8Array(array.buffer as ArrayBuffer, array.byteOffset, array.byteLength);
          for (let i = 0; i < view.length; i += 1) view[i] = Math.floor(Math.random() * 256);
          return array;
        },
      } as Crypto;
    }
  } catch {
    // Host does not allow replacing crypto. Nothing else to do here.
  }
}

ensureCryptoRandomUUID();
