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

    const path = url.pathname.replace(/\/+/g, "/");
    if (path.includes("/auth/v1/") || path.includes("/functions/v1/record_endpoint_egress")) return null;

    if (path.startsWith("/rest/v1/rpc/")) return `/rpc/${path.slice("/rest/v1/rpc/".length)}`;
    if (path.startsWith("/rest/v1/")) return `/rest/${path.slice("/rest/v1/".length)}`;
    if (path.startsWith("/storage/v1/")) return `/storage/${path.slice("/storage/v1/".length)}`;
    return path;
  } catch {
    return null;
  }
}

export function recordSupabaseEgress(
  input: RequestInfo | URL,
  method: string,
  status: number,
  responseBytes: number,
) {
  if (typeof window === "undefined") return;
  const endpoint = normalizeEndpoint(input);
  if (!endpoint || endpoint.includes("endpoint_egress")) return;

  const bucket = new Date();
  bucket.setMinutes(0, 0, 0);
  const bucketHour = bucket.toISOString();
  const statusClass = Math.floor(status / 100);
  const rows = readQueue();
  const existing = rows.find(
    (row) =>
      row.bucket_hour === bucketHour &&
      row.endpoint === endpoint &&
      row.method === method.toUpperCase() &&
      row.status_class === statusClass,
  );

  if (existing) {
    existing.request_count += 1;
    existing.response_bytes += Math.max(0, responseBytes || 0);
  } else {
    rows.push({
      bucket_hour: bucketHour,
      endpoint,
      method: method.toUpperCase(),
      status_class: statusClass,
      request_count: 1,
      response_bytes: Math.max(0, responseBytes || 0),
    });
  }

  writeQueue(rows);
  scheduleEgressFlush();
}

async function flushEgressMetrics() {
  if (flushing || typeof window === "undefined") return;
  const rows = readQueue();
  if (!rows.length) return;

  const batch = rows.slice(0, MAX_BATCH);
  flushing = true;
  try {
    const url = `${window.location.origin}/__supabase_egress_metrics`;
    // The application fetch wrapper replaces this with a Supabase RPC request.
    // This fallback is intentionally a no-op until the client wires the RPC.
    void url;
  } finally {
    flushing = false;
  }
}

export function scheduleEgressFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flushEgressMetrics();
  }, FLUSH_INTERVAL_MS);
}

export function takeSupabaseEgressMetrics(): EgressMetric[] {
  const rows = readQueue();
  if (!rows.length) return [];
  writeQueue([]);
  return rows.slice(0, MAX_BATCH);
}
