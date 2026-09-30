import { SafeImage } from "@/components/SafeImage";
import { useQuery } from "@tanstack/react-query";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";

type SiteSettings = { site_name?: string; logo_url?: string };

export function BrandLoader({ label, className = "" }: { label?: string; className?: string }) {
  const { data: row, isLoading } = useQuery(publicSiteSettingsQuery);
  const settings = (row?.settings as SiteSettings) ?? {};
  const brandName = label || settings.site_name || "Sheikh Seeds";
  const logo = settings.logo_url || "/logo.jpg";
  const hasBranding = Boolean(logo);

  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-6 ${className}`}>
      <div className="relative h-10 w-10">
        {hasBranding ? (
          <>
            <div className="absolute inset-0 rounded-full bg-brand/20 animate-ping" />
            <SafeImage src={logo} alt={brandName} width={40} height={40} loading="eager" fetchPriority="high" decoding="async" className="relative h-10 w-10 rounded-full object-cover ring-2 ring-brand/40" />
          </>
        ) : (
          <div className="h-10 w-10 rounded-full border-2 border-brand/20 border-t-brand animate-spin" aria-hidden="true" />
        )}
      </div>
      <div className="text-xs font-bold text-brand-dark">{isLoading && !hasBranding ? "" : brandName}</div>
      <div className="flex gap-1"><span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "0ms" }} /><span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "120ms" }} /><span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "240ms" }} /></div>
    </div>
  );
}
