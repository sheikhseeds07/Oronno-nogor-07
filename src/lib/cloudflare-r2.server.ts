import { env } from "cloudflare:workers";

export type OronnoR2Bucket = {
  get?: (key: string) => Promise<unknown | null>;
  head?: (key: string) => Promise<unknown | null>;
  put?: (
    key: string,
    value: ArrayBuffer | Uint8Array | ReadableStream,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ) => Promise<unknown>;
};

/**
 * Cloudflare supports importing bindings from cloudflare:workers anywhere in
 * an ES-module Worker. Keep the old request-global fallback only for local or
 * legacy adapters; production should resolve MEDIA_BUCKET from the runtime.
 */
export function getCloudflareR2Bucket<T extends OronnoR2Bucket = OronnoR2Bucket>(): T | undefined {
  const direct = (env as unknown as { MEDIA_BUCKET?: T }).MEDIA_BUCKET;
  if (direct) return direct;

  return (globalThis as typeof globalThis & {
    __ORONNO_CF_ENV?: { MEDIA_BUCKET?: T };
  }).__ORONNO_CF_ENV?.MEDIA_BUCKET;
}
