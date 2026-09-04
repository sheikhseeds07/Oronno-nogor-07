import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Search, Menu, X, ChevronRight, Home, Grid3x3, Phone, Sparkles, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { hydrateCartStore, useCart } from "@/lib/cart-store";
import { bnDigits } from "@/lib/format";
import { supabase } from "@/lib/personal-supabase/client";
import { readPublicSettingsCache, writePublicSettingsCache } from "@/lib/public-settings-cache";
import { CartDrawer } from "@/components/shop/CartDrawer";

type NavCategory = { id: string; name: string; slug: string };
type SiteSettings = { site_name?: string; tagline?: string; header_subtitle?: string; logo_url?: string };

export function Header() {
  const count = useCart((s) => s.count());
  const bumpKey = useCart((s) => s.bumpKey);
  const [drawer, setDrawer] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const { data: brandRow } = useQuery({
    queryKey: ["site-settings-public"],
    initialData: () => { const cached = readPublicSettingsCache<SiteSettings>(); return cached ? { settings: cached } : undefined; },
    queryFn: async () => { const { data } = await supabase.from("site_settings").select("settings").maybeSingle(); if (data?.settings) writePublicSettingsCache(data.settings as SiteSettings); return data; },
    staleTime: 60_000,
  });
  const brand = (brandRow?.settings as SiteSettings) ?? {};
  const brandName = brand.site_name || "Sheikh Seeds";
  const brandLogo = brand.logo_url || "/logo.jpg";
  const brandSubtitle = brand.header_subtitle || "PREMIUM SEED HOUSE";

  useEffect(() => {
    if (bumpKey === 0) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 650);
    return () => clearTimeout(t);
  }, [bumpKey]);

  const { data: categories = [] } = useQuery({
    queryKey: ["nav-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any).select("id,name,slug").is("parent_id", null).eq("is_hidden_from_home", false).order("display_order").order("created_at");
      if (error) throw error;
      return (data ?? []) as NavCategory[];
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const submit = (e: React.FormEvent) => { e.preventDefault(); navigate({ to: "/shop", search: { q } as never }); setDrawer(false); };
  useEffect(() => { if (!drawer) return; const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, [drawer]);
  useEffect(() => { void hydrateCartStore(); }, []);

  const logoNode = brandLogo ? (
    <img src={brandLogo} alt={brandName} width={44} height={44} loading="eager" fetchPriority="high" decoding="async" className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-brand/30 shadow-lg group-hover:ring-brand transition duration-300" />
  ) : <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-brand-light/30 animate-pulse ring-2 ring-brand/20" aria-hidden="true" />;
  const drawerLogoNode = brandLogo ? <img src={brandLogo} alt={brandName} width={48} height={48} decoding="async" className="w-12 h-12 rounded-full object-cover ring-2 ring-white/40" /> : <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse ring-2 ring-white/20" aria-hidden="true" />;

  return <>
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-brand-light/50 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
      <div className="h-0.5 bg-gradient-to-r from-brand/30 via-brand to-brand-dark/30" />
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <div className="relative">
            {logoNode}
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-gradient-to-br from-brand to-brand-dark rounded-full ring-2 ring-white flex items-center justify-center shadow-sm animate-pulse"><Sparkles className="w-2 h-2 text-white" /></span>
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="font-extrabold text-brand-dark text-lg tracking-tight">{brandName}</div>
            <div className="text-[9px] text-muted-foreground font-semibold tracking-[0.14em]">{brandSubtitle}</div>
          </div>
        </Link>

        <form onSubmit={submit} className="flex-1 relative max-w-2xl mx-auto">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-brand/70" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="পছন্দের বীজ খুঁজুন..." className="w-full bg-brand-light/25 border border-brand-light/60 rounded-full pl-10 pr-20 py-2.5 text-sm placeholder:text-muted-foreground/75 focus:outline-none focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all duration-300" />
          <button type="submit" className="absolute right-1 top-1 bottom-1 px-4 bg-gradient-to-r from-brand to-brand-dark text-white rounded-full text-xs font-bold hover:shadow-lg hover:scale-[1.02] active:scale-95 transition">খুঁজুন</button>
        </form>

        <button
          onClick={() => setCartOpen(true)}
          className={`relative shrink-0 flex items-center gap-1.5 sm:gap-2 rounded-full bg-gradient-to-r from-brand to-brand-dark text-white pl-2.5 pr-2 sm:pr-2.5 py-2 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 ${bump ? "cart-bump ring-4 ring-brand/20" : ""}`}
          aria-label="অর্ডার কার্ট"
        >
          <span className="font-extrabold text-xs sm:text-sm whitespace-nowrap">অর্ডার</span>
          <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-90 animate-[pulse_1.8s_ease-in-out_infinite]" />
          <span className="relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/15 ring-1 ring-white/25">
            <ShoppingCart className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${bump ? "animate-bounce" : ""}`} />
            {count > 0 && <span key={bumpKey} className="badge-pop absolute -top-2 -right-2 bg-white text-brand-dark text-[10px] font-extrabold rounded-full min-w-[19px] h-[19px] px-1 flex items-center justify-center ring-2 ring-brand shadow-md">{bnDigits(count)}</span>}
          </span>
          <span className="absolute inset-0 rounded-full bg-white/20 animate-[ping_2.8s_cubic-bezier(0,0,0.2,1)_infinite] pointer-events-none opacity-20" />
        </button>

        <button onClick={() => setDrawer(true)} className="p-2.5 rounded-full bg-gradient-to-br from-brand to-brand-dark text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition shrink-0" aria-label="মেনু"><Menu className="w-5 h-5" /></button>
      </div>

      <div className="hidden md:block border-t border-brand-light/30 bg-gradient-to-r from-brand-light/10 via-white to-brand-light/10">
        <div className="container mx-auto px-3 py-2 flex items-center gap-1 overflow-x-auto">
          <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-dark hover:bg-brand-light/40 rounded-full transition shrink-0"><Home className="w-3.5 h-3.5" /> হোম</Link>
          <Link to="/shop" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-dark hover:bg-brand-light/40 rounded-full transition shrink-0"><Grid3x3 className="w-3.5 h-3.5" /> সকল পণ্য</Link>
          <span className="w-px h-4 bg-brand-light/60 mx-1" />
          {categories.map((c) => <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} className="px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:text-brand hover:bg-brand-light/40 rounded-full transition shrink-0">{c.name}</Link>)}
          <span className="ml-auto" />
          <Link to="/contact" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-dark hover:bg-brand-light/40 rounded-full transition shrink-0"><Phone className="w-3.5 h-3.5" /> যোগাযোগ</Link>
        </div>
      </div>
    </header>

    {drawer && <div className="fixed inset-0 z-50 flex"><div className="flex-1 bg-black/50 animate-fade-in" onClick={() => setDrawer(false)} /><aside className="w-[85%] max-w-sm bg-white h-full flex flex-col shadow-2xl animate-slide-in-right"><div className="flex items-center justify-between p-4 border-b bg-gradient-to-br from-brand to-brand-dark text-white"><div className="flex items-center gap-3">{drawerLogoNode}<div><div className="font-extrabold">{brandName}</div><div className="text-[11px] text-white/80">{brand.tagline || "দেশী ও বিদেশী বীজ"}</div></div></div><button onClick={() => setDrawer(false)} className="p-1.5 rounded-full hover:bg-white/20"><X className="w-5 h-5" /></button></div><nav className="flex-1 overflow-y-auto p-2"><Link to="/" onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted font-semibold border-b"><span>হোম</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></Link><Link to="/shop" onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted font-semibold border-b"><span>সকল পণ্য</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></Link><Link to="/contact" onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted font-semibold border-b"><span>যোগাযোগ</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></Link><div className="pt-4 pb-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">ক্যাটাগরি</div>{categories.map((c) => <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-brand-light/30 hover:text-brand-dark border-b"><span className="font-medium">{c.name}</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></Link>)}</nav></aside></div>}
    {cartOpen && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />}
  </>;
}
