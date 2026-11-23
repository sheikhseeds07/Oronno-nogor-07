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
    const { data, error } = await supabase.from("site_settings").select("settings").limit(10);
    if (error) throw error;
    // Settings have historically been split across multiple rows. Merge them instead of maybeSingle().
    const rows = Array.isArray(data) ? data : [];
    const settings = rows.reduce((merged, row) => ({ ...merged, ...((row?.settings as PublicSiteSettings | null) ?? {}) }), {} as PublicSiteSettings);
    // Prefer any row that explicitly contains the home NUTRIMIX popup configuration.
    const popupKeys = ["home_nutrimix_popup_enabled", "home_nutrimix_product_name", "home_nutrimix_product_price", "home_nutrimix_product_old_price", "home_nutrimix_product_image", "home_nutrimix_popup_heading", "home_nutrimix_popup_description", "home_nutrimix_accept_text", "home_nutrimix_decline_text"] as const;
    for (const row of rows) {
      const rowSettings = (row?.settings as PublicSiteSettings | null) ?? {};
      for (const key of popupKeys) if (key in rowSettings) (settings as Record<string, unknown>)[key] = rowSettings[key];
    }
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
