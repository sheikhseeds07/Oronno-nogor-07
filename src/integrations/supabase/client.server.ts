// Server-only Supabase admin client. Never import this module into client code.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function getServerEnv(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[name]) return process.env[name];
  try {
    const meta = (import.meta as unknown as { env?: Record<string, string> }).env;
    return meta?.[name];
  } catch {
    return undefined;
  }
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
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

function firstEnv(...names: string[]): string | undefined {
  for (const n of names) {
    const v = getServerEnv(n);
    if (v) return v;
  }
  return undefined;
}

// Production project of the live site ("Ek seed"). Used when the host injects no
// env var so the server never falls back to a different database than the browser.
const LIVE_SUPABASE_URL = 'https://bvuhvzccziuniujeogng.supabase.co';
const LIVE_SUPABASE_SECRET_KEY = 'sb_secret_GI6LYYrsGCYDw94b6G3ebA_QUXAOr0k';

function createSupabaseAdminClient() {
  // Hosts often only configure the VITE_* URL, so accept those aliases too.
  const SUPABASE_URL = firstEnv('SUPABASE_URL', 'VITE_SUPABASE_URL') ?? LIVE_SUPABASE_URL;
  // LIVE_DB_SECRET_KEY / SUPABASE_SECRET_KEY win so an explicitly provided project
  // key can override a platform-injected SUPABASE_SERVICE_ROLE_KEY pointing elsewhere.
  const SUPABASE_SERVICE_ROLE_KEY =
    firstEnv(
      'LIVE_DB_SECRET_KEY',
      'SUPABASE_SECRET_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SERVICE_ROLE_KEY',
    ) ?? (SUPABASE_URL === LIVE_SUPABASE_URL ? LIVE_SUPABASE_SECRET_KEY : undefined);


  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
    ];
    throw new Error(
      `Missing Supabase server environment variable(s): ${missing.join(', ')}. Configure them as Cloudflare runtime variables/secrets.`,
    );
  }


  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { fetch: createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY) },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
