// Lightweight site visit tracking. Fires once per browser session per path,
// scheduled in idle time so it never blocks first paint.
import { supabase } from "@/lib/personal-supabase/client";

const SESSION_KEY = "sk_visit_sid";
const SENT_KEY = "sk_visit_sent";

function createSessionId(): string {
  try {
    const cryptoApi = globalThis.crypto as Crypto & { randomUUID?: unknown } | undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return cryptoApi.randomUUID() as string;
    }
  } catch {
    // Fall through to a browser-safe identifier.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = createSessionId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return createSessionId();
  }
}

function getSentSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SENT_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSent(path: string, set: Set<string>) {
  set.add(path);
  try {
    sessionStorage.setItem(SENT_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function trackVisit(path: string) {
  if (typeof window === "undefined") return;
  const sent = getSentSet();
  if (sent.has(path)) return;

  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  const schedule = w.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));

  schedule(() => {
    markSent(path, sent);
    void supabase.from("site_visits").insert({
      session_id: getSessionId(),
      path,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent.slice(0, 500),
    }).then(() => { /* ignore */ }, () => { /* ignore */ });
  }, { timeout: 3000 });
}
