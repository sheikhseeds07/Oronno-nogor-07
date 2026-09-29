declare module "cloudflare:workers" {
  export const env: {
    SUPA_CACHE?: {
      get(key: string, type?: "text"): Promise<string | null>;
      put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
      delete(key: string): Promise<void>;
    };
    [key: string]: unknown;
  };
}
