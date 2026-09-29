function readEnv(name: string): string | undefined {
  const fromProcess = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (fromProcess) return fromProcess;
  try {
    const meta = (import.meta as unknown as { env?: Record<string, string> }).env;
    if (meta?.[name]) return meta[name];
  } catch {}
  return undefined;
}

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return undefined;
}

export function resolveSupabaseUrl(): string {
  const value = firstEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  if (!value) throw new Error("SUPABASE_URL/VITE_SUPABASE_URL is not configured");
  return value.replace(/\/$/, "");
}

export function resolveSupabasePublishableKey(): string {
  const value = firstEnv(
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
  );
  if (!value) throw new Error("Supabase publishable key is not configured");
  return value;
}

export function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}
