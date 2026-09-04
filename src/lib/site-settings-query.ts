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
};

export type PublicSiteSettingsRow = { settings: PublicSiteSettings } | null;

/**
 * Every public surface (header, footer, floating contact, loader, SEO, checkout)
 * needs the same settings row. Sharing one query key, one long stale window and
 * the persisted localStorage copy keeps this to roughly one request per visitor
 * per day instead of one request per component mount.
 */
export const publicSiteSettingsQuery = {
  queryKey: ["site-settings-public"] as const,
  initialData: (): PublicSiteSettingsRow | undefined => {
    const cached = readPublicSettingsCache<PublicSiteSettings>();
    return cached ? { settings: cached } : undefined;
  },
  queryFn: async (): Promise<PublicSiteSettingsRow> => {
    const { data } = await supabase.from("site_settings").select("settings").maybeSingle();
    const settings = (data?.settings as PublicSiteSettings | null) ?? {};
    writePublicSettingsCache(settings);
    return { settings };
  },
  staleTime: 6 * 60 * 60_000,
  gcTime: 12 * 60 * 60_000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
};
