type EgressMetric = {
  bucket_hour: string;
  endpoint: string;
  method: string;
  status_class: number;
  request_count: number;
  response_bytes: number;
};

const QUEUE_KEY = "sk_supabase_egress_metrics_v1";
const FLUSH_INTERVAL_MS = 60_000;
const MAX_BATCH = 100;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;
let sendMetrics: ((rows: EgressMetric[]) => Promise<void>) | undefined;

function readQueue(): EgressMetric[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as EgressMetric[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(rows: EgressMetric[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-500)));
  } catch {
    // Metrics must never affect application behavior.
  }
}

function normalizeEndpoint(input: RequestInfo | URL): string | null {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, typeof window !== "undefined" ? window.location.origin : undefined);
    if (!url.hostname.includes("supabase.co")) return null;

    const path = url.pathname.replace(/\\+/g, "/");
    if (path.includes("/auth/v1/") || path.includes("endpoint_egress")) return null;
    if (path.startsWith("/rest/v1/rpc/")) return `/rpc/${path.slice("/rest/v1/rpc/".length)}`;
    if (path.startsWith("/rest/v1/")) return `/rest/${path.slice("/rest/v1/".length)}`;
    if (path.startsWith("/storage/v1/")) return `/storage/${path.slice("/storage/v1/".length)}`;
    return path;
  } catch {
    return null;
  }
}

export function setSupabaseEgressSender(sender: (rows: EgressMetric[]) => Promise<void>) {
  sendMetrics = sender;
  scheduleEgressFlush(0);
}

export function recordSupabaseEgress(
  input: RequestInfo | URL,
  method: string,
  status: number,
  responseBytes: number,
) {
  if (typeof window === "undefined") return;
  const endpoint = normalizeEndpoint(input);
  if (!endpoint) return;

  const bucket = new Date();
  bucket.setMinutes(0, 0, 0);
  const bucketHour = bucket.toISOString();
  const statusClass = Math.floor(status / 100);
  const rows = readQueue();
  const methodUpper = method.toUpperCase();
  const existing = rows.find(
    (row) =>
      row.bucket_hour === bucketHour &&
      row.endpoint === endpoint &&
      row.method === methodUpper &&
      row.status_class === statusClass,
  );

  if (existing) {
    existing.request_count += 1;
    existing.response_bytes += Math.max(0, responseBytes || 0);
  } else {
    rows.push({
      bucket_hour: bucketHour,
      endpoint,
      method: methodUpper,
      status_class: statusClass,
      request_count: 1,
      response_bytes: Math.max(0, responseBytes || 0),
    });
  }

  writeQueue(rows);
  scheduleEgressFlush();
}

async function flushEgressMetrics() {
  if (flushing || !sendMetrics || typeof window === "undefined") return;
  const rows = readQueue();
  if (!rows.length) return;

  const batch = rows.slice(0, MAX_BATCH);
  flushing = true;
  try {
    await sendMetrics(batch);
    writeQueue(rows.slice(batch.length));
  } catch {
    // Keep metrics queued so a temporary network failure does not lose them.
  } finally {
    flushing = false;
  }
}

export function scheduleEgressFlush(delay = FLUSH_INTERVAL_MS) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flushEgressMetrics();
  }, delay);
}

export function flushSupabaseEgressNow() {
  void flushEgressMetrics();
}
