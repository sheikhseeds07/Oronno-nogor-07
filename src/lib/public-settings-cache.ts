const STORAGE_KEY = "sheikh_seeds_public_site_settings_v2";
const TTL_MS = 24 * 60 * 60 * 1000;

type CacheEnvelope<T> = { savedAt: number; value: T };

export function readPublicSettingsCache<T>(): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || !parsed.value || Date.now() - parsed.savedAt >= TTL_MS) return undefined;
    return parsed.value;
  } catch {
    return undefined;
  }
}

export function writePublicSettingsCache<T>(value: T) {
  if (typeof window === "undefined" || !value) return;
  try {
    const payload: CacheEnvelope<T> = { savedAt: Date.now(), value };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Local storage is an optimization only; never break the app if unavailable.
  }
}

export function clearPublicSettingsCache() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}
