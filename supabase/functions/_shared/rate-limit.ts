// Best-effort per-isolate protection; use Cloudflare WAF/Durable Objects for
// a distributed hard limit. No Supabase writes or logs on this hot path.
export function createRateLimiter(maxKeys = 2048) {
  const windows = new Map<string, { count: number; reset: number }>();
  return (key: string, limit: number, windowMs: number, now = Date.now()): boolean => {
    const current = windows.get(key);
    if (current && current.reset > now) {
      if (current.count >= limit) return false;
      current.count++;
      return true;
    }
    windows.delete(key);
    if (windows.size >= maxKeys) {
      for (const [id, value] of windows) if (value.reset <= now) windows.delete(id);
      if (windows.size >= maxKeys) return false;
    }
    windows.set(key, { count: 1, reset: now + windowMs });
    return true;
  };
}
export const allowRequest = createRateLimiter();
