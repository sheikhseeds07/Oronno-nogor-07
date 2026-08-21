// Batched, low-egress site visit tracking.
// Visits are queued in the browser and sent as one insert batch instead of one
// Supabase request per page-view. No heartbeat requests are generated.
import { supabase } from "@/lib/personal-supabase/client";

const SESSION_KEY = "sk_visit_sid";
const QUEUE_KEY = "sk_visit_queue_v2";
const SENT_KEY = "sk_visit_sent_v2";
const FLUSH_INTERVAL_MS = 60_000;
const MAX_BATCH = 25;

type Visit = { session_id: string; path: string; referrer: string | null; user_agent: string };

function createSessionId(): string {
  try {
    const cryptoApi = globalThis.crypto as Crypto & { randomUUID?: unknown } | undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID() as string;
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) { id = createSessionId(); sessionStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch { return createSessionId(); }
}
function readQueue(): Visit[] {
  try { const raw = localStorage.getItem(QUEUE_KEY); return raw ? (JSON.parse(raw) as Visit[]) : []; } catch { return []; }
}
function writeQueue(queue: Visit[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-100))); } catch {}
}
function getSentSet(): Set<string> {
  try { const raw = sessionStorage.getItem(SENT_KEY); return new Set(raw ? (JSON.parse(raw) as string[]) : []); } catch { return new Set(); }
}
function markSent(path: string, set: Set<string>) {
  set.add(path);
  try { sessionStorage.setItem(SENT_KEY, JSON.stringify([...set].slice(-200))); } catch {}
}
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;

export async function flushVisitQueue() {
  if (typeof window === "undefined" || flushing) return;
  const queue = readQueue();
  if (!queue.length) return;
  flushing = true;
  const batch = queue.slice(0, MAX_BATCH);
  try {
    const { error } = await supabase.from("site_visits").insert(batch);
    if (!error) writeQueue(queue.slice(batch.length));
  } catch {} finally { flushing = false; }
}
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = undefined; void flushVisitQueue(); }, FLUSH_INTERVAL_MS);
}
export function trackVisit(path: string) {
  if (typeof window === "undefined") return;
  const normalizedPath = path || window.location.pathname;
  const sent = getSentSet();
  if (sent.has(normalizedPath)) return;
  markSent(normalizedPath, sent);
  const queue = readQueue();
  queue.push({ session_id: getSessionId(), path: normalizedPath, referrer: document.referrer || null, user_agent: navigator.userAgent.slice(0, 200) });
  writeQueue(queue);
  scheduleFlush();
  if (queue.length >= MAX_BATCH) void flushVisitQueue();
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void flushVisitQueue(), { passive: true });
  window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flushVisitQueue(); });
}
