// Shared resolver for the Supabase URL + publishable key on the server.
// Hosts (Cloudflare/Vercel) often inject only the VITE_* variables, or nothing
// at all, so we accept every common alias and finally fall back to the live
// project ("Ek seed"). Publishable keys are safe to ship in code.
export const LIVE_SUPABASE_URL = 'https://frtzlibogmethppqmhtr.supabase.co';
export const LIVE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IwyqncvDdP4OF2UDNMlK9g_bn6Hu6n1';

function readEnv(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  if (fromProcess) return fromProcess;
  try {
    const meta = (import.meta as unknown as { env?: Record<string, string> }).env;
    if (meta?.[name]) return meta[name];
  } catch {
    /* ignore */
  }
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
  return firstEnv('SUPABASE_URL', 'VITE_SUPABASE_URL') ?? LIVE_SUPABASE_URL;
}

export function resolveSupabasePublishableKey(): string {
  const url = resolveSupabaseUrl();
  const fromEnv = firstEnv(
    'SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
  );
  if (fromEnv) return fromEnv;
  // Only use the built-in key when it belongs to the resolved project.
  if (url === LIVE_SUPABASE_URL) return LIVE_SUPABASE_PUBLISHABLE_KEY;
  throw new Error('Supabase publishable key is not configured for ' + url);
}

export function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

// New-format sb_ keys are opaque strings, not JWTs: send them as `apikey` only.
export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}
