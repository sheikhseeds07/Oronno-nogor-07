import { supabase } from "@/lib/personal-supabase/client";
import { readPublicSettingsCacheEntry, writePublicSettingsCache } from "@/lib/public-settings-cache";

export type PublicSiteSettings = Record<string, unknown> & {
  site_name?: string;
  tagline?: string;
  header_subtitle?: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  youtube?: string;
  tiktok?: string;
  contact_phone?: string;
  contact_page_message_url?: string;
  delivery_charge_inside?: number;
  delivery_charge_outside?: number;
  free_delivery_above?: number;
  delivery_zones?: Array<{ id: string; label: string; fee: number }>;
  delivery_rules?: Array<{ id: string; min_order: number; fee: number }>;
};

export type PublicSiteSettingsRow = { settings: PublicSiteSettings } | null;

let serverSettingsCache: { at: number; value: PublicSiteSettingsRow } | null = null;
const SETTINGS_CACHE_TTL_MS = 5 * 60_000;

/**
 * Public settings use a short five-minute cache to protect Supabase from
 * repeated reads. Browser cache timestamps are preserved so expired values
 * never become artificially fresh during hydration. Admin saves write through
 * to both the browser cache and React Query cache.
 */
export const publicSiteSettingsQuery = {
  queryKey: ["site-settings-public"] as const,
  initialData: (): PublicSiteSettingsRow | undefined => {
    const cached = readPublicSettingsCacheEntry<PublicSiteSettings>();
    return cached ? { settings: cached.value } : undefined;
  },
  initialDataUpdatedAt: (): number | undefined =>
    readPublicSettingsCacheEntry<PublicSiteSettings>()?.savedAt,
  queryFn: async (): Promise<PublicSiteSettingsRow> => {
    if (typeof window === "undefined" && serverSettingsCache && Date.now() - serverSettingsCache.at < SETTINGS_CACHE_TTL_MS) {
      return serverSettingsCache.value;
    }
    const { data, error } = await supabase.from("site_settings").select("settings").maybeSingle();
    if (error) throw error;
    const settings = (data?.settings as PublicSiteSettings | null) ?? {};
    const value = { settings };
    if (typeof window === "undefined") serverSettingsCache = { at: Date.now(), value };
    writePublicSettingsCache(settings);
    return value;
  },
  staleTime: SETTINGS_CACHE_TTL_MS,
  refetchOnMount: true,
  gcTime: 12 * 60 * 60_000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
};
