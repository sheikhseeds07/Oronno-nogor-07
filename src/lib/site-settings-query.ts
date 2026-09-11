import { supabase } from "@/lib/personal-supabase/client";
import { readPublicSettingsCache, writePublicSettingsCache } from "@/lib/public-settings-cache";

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

/**
 * Public settings are configuration, not long-lived content. In particular,
 * delivery charges must reflect the admin setting on the next checkout visit.
 * localStorage is kept only for fast first paint; it is immediately
 * revalidated against Supabase so old delivery charges cannot persist for hours.
 */
export const publicSiteSettingsQuery = {
  queryKey: ["site-settings-public"] as const,
  initialData: (): PublicSiteSettingsRow | undefined => {
    const cached = readPublicSettingsCache<PublicSiteSettings>();
    return cached ? { settings: cached } : undefined;
  },
  queryFn: async (): Promise<PublicSiteSettingsRow> => {
    const { data, error } = await supabase.from("site_settings").select("settings").maybeSingle();
    if (error) throw error;
    const settings = (data?.settings as PublicSiteSettings | null) ?? {};
    writePublicSettingsCache(settings);
    return { settings };
  },
  staleTime: 0,
  gcTime: 12 * 60 * 60_000,
  refetchOnMount: true,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
};
