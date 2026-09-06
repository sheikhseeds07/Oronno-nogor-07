// Compatibility shim for browsers/WebViews (including Facebook's in-app browser)
// where Web Crypto exists but crypto.randomUUID is missing or cannot be added
// directly to the Crypto instance.

type CryptoWithUUID = Crypto & { randomUUID?: () => string };

function fallbackUUID(): string {
  const cryptoApi = (typeof globalThis !== "undefined" ? globalThis.crypto : undefined) as CryptoWithUUID | undefined;
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
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

export function ensureCryptoRandomUUID(): void {
  if (typeof globalThis === "undefined") return;

  let cryptoObject = globalThis.crypto as CryptoWithUUID | undefined;

  // Normal modern browsers.
  try {
    if (cryptoObject && typeof cryptoObject.randomUUID === "function") return;
  } catch {
    // Continue with the compatibility paths below.
  }

  // Facebook/older WebViews may expose Crypto as a non-extensible object.
  // In that case patch its prototype instead of the instance.
  if (cryptoObject) {
    const install = (target: object): boolean => {
      try {
        Object.defineProperty(target, "randomUUID", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: fallbackUUID,
        });
        return typeof (cryptoObject as CryptoWithUUID).randomUUID === "function";
      } catch {
        return false;
      }
    };

    if (install(cryptoObject)) return;
    const proto = Object.getPrototypeOf(cryptoObject);
    if (proto && install(proto)) return;
  }

  // Very old embedded browsers can expose no Web Crypto at all. If the
  // global property is writable, install a minimal compatibility object.
  try {
    if (!cryptoObject) {
      const compatibilityCrypto = {
        getRandomValues<T extends ArrayBufferView>(array: T): T {
          const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
          for (let i = 0; i < view.length; i += 1) view[i] = Math.floor(Math.random() * 256);
          return array;
        },
        randomUUID: fallbackUUID,
      } as unknown as Crypto;
      (globalThis as typeof globalThis & { crypto?: Crypto }).crypto = compatibilityCrypto;
      cryptoObject = compatibilityCrypto as CryptoWithUUID;
    }
  } catch {
    // Nothing else is required here; the app has its own UUID fallbacks.
  }
}

ensureCryptoRandomUUID();
