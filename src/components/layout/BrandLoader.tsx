import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/personal-supabase/client";
import { readPublicSettingsCache, writePublicSettingsCache } from "@/lib/public-settings-cache";

const DEFAULT_LOGO = "/sheikh-seeds-logo.svg";
type SiteSettings = { site_name?: string; logo_url?: string };

export function BrandLoader({ label, className = "" }: { label?: string; className?: string }) {
  const { data: row } = useQuery({
    queryKey: ["site-settings-public"],
    initialData: () => {
      const cached = readPublicSettingsCache<SiteSettings>();
      return cached ? { settings: cached } : undefined;
    },
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("settings").maybeSingle();
      if (data?.settings) writePublicSettingsCache(data.settings as SiteSettings);
      return data;
    },
    staleTime: 60_000,
  });
  const settings = (row?.settings as SiteSettings) ?? {};
  const brandName = label || settings.site_name || "Sheikh Seeds";
  const logo = settings.logo_url || DEFAULT_LOGO;

  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-6 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-brand/20 animate-ping" />
        <img src={logo} alt={brandName} className="relative w-10 h-10 rounded-full object-cover ring-2 ring-brand/40" />
      </div>
      <div className="text-xs font-bold text-brand-dark">{brandName}</div>
      <div className="flex gap-1"><span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "0ms" }} /><span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "120ms" }} /><span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "240ms" }} /></div>
    </div>
  );
}
