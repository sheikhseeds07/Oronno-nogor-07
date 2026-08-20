// Compatibility shim for runtimes/WebViews where Web Crypto exists but randomUUID does not.
// Supabase Auth uses crypto.randomUUID for internal locks/session state.
export function ensureCryptoRandomUUID(): void {
  if (typeof globalThis === "undefined" || !globalThis.crypto) return;

  const cryptoObject = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof cryptoObject.randomUUID === "function") return;
  if (typeof cryptoObject.getRandomValues !== "function") return;

  const fallback = (): string => {
    const bytes = new Uint8Array(16);
    cryptoObject.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  };

  try {
    Object.defineProperty(cryptoObject, "randomUUID", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: fallback,
    });
  } catch {
    // Some runtimes expose a non-extensible Crypto object.
  }
}

ensureCryptoRandomUUID();
