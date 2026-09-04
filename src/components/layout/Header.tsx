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
    <img src={brandLogo} alt={brandName} width={44} height={44} loading="eager" fetchPriority="high" decoding="async" className="w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] object-cover ring-2 ring-brand/20 shadow-md group-hover:rounded-xl group-hover:ring-brand/50 group-hover:scale-[1.04] transition-all duration-300" />
  ) : <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] bg-brand-light/30 animate-pulse ring-2 ring-brand/20" aria-hidden="true" />;
  const drawerLogoNode = brandLogo ? <img src={brandLogo} alt={brandName} width={48} height={48} decoding="async" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/40 shadow-lg" /> : <div className="w-12 h-12 rounded-2xl bg-white/10 animate-pulse ring-2 ring-white/20" aria-hidden="true" />;

  return <>
    <header className="sticky top-0 z-40 bg-white/92 backdrop-blur-2xl border-b border-brand-light/45 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="h-[3px] bg-gradient-to-r from-brand/20 via-brand to-brand-dark/20 relative overflow-hidden"><span className="absolute inset-y-0 -left-1/3 w-1/3 bg-white/70 blur-sm animate-[pulse_2.2s_ease-in-out_infinite]" /></div>
      <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="relative">
            {logoNode}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-brand rounded-full ring-2 ring-white flex items-center justify-center shadow-sm"><Sparkles className="w-2.5 h-2.5 text-white animate-pulse" /></span>
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="font-black text-brand-dark text-[17px] lg:text-[19px] tracking-[-0.02em]">{brandName}</div>
            <div className="text-[8px] lg:text-[9px] text-muted-foreground font-bold tracking-[0.16em] mt-0.5">{brandSubtitle}</div>
          </div>
        </Link>

        <form onSubmit={submit} className="flex-1 relative max-w-2xl mx-auto group/search">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-brand/65 group-focus-within/search:text-brand transition-colors" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="পছন্দের বীজ খুঁজুন..." className="w-full h-11 bg-brand-light/20 border border-brand-light/55 rounded-2xl pl-10 pr-[76px] sm:pr-[82px] text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:bg-white focus:border-brand/70 focus:ring-4 focus:ring-brand/10 transition-all duration-300 shadow-inner" />
          <button type="submit" className="absolute right-1 top-1 bottom-1 px-3.5 sm:px-4 bg-brand text-white rounded-xl text-xs font-extrabold shadow-sm hover:bg-brand-dark hover:shadow-md active:scale-95 transition-all">খুঁজুন</button>
        </form>

        <button onClick={() => setCartOpen(true)} className={`relative shrink-0 flex items-center gap-1 sm:gap-1.5 rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white pl-2.5 pr-2 py-1.5 shadow-lg shadow-brand/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 overflow-visible ${bump ? "ring-4 ring-brand/15 scale-[1.03]" : ""}`} aria-label="অর্ডার কার্ট">
          <span className="flex flex-col items-start leading-none px-1"><span className="font-black text-[11px] sm:text-xs">অর্ডার</span><span className="text-[8px] text-white/70 font-semibold mt-0.5">কার্ট দেখুন</span></span>
          <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
          <span className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm"><ShoppingCart className={`w-[17px] h-[17px] sm:w-[18px] sm:h-[18px] ${bump ? "animate-bounce" : ""}`} />{count > 0 && <span key={bumpKey} className="badge-pop absolute -top-2 -right-2 bg-white text-brand-dark text-[10px] font-black rounded-full min-w-[20px] h-[20px] px-1 flex items-center justify-center ring-2 ring-brand shadow-md">{bnDigits(count)}</span>}</span>
          <span className="absolute inset-0 rounded-2xl bg-white/20 animate-[ping_3.2s_ease-out_infinite] pointer-events-none opacity-10" />
        </button>

        <button onClick={() => setDrawer(true)} className="p-2.5 rounded-2xl bg-white border border-brand-light/60 text-brand-dark shadow-sm hover:bg-brand-light/25 hover:border-brand/30 hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all shrink-0" aria-label="মেনু"><Menu className="w-5 h-5" /></button>
      </div>

      <div className="hidden md:block border-t border-brand-light/30 bg-white/70">
        <div className="container mx-auto px-3 py-1.5 flex items-center gap-1 overflow-x-auto">
          <Link to="/" className="flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold text-brand-dark bg-brand-light/25 hover:bg-brand-light/45 rounded-xl transition shrink-0"><Home className="w-3.5 h-3.5" /> হোম</Link>
          <Link to="/shop" className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-foreground/80 hover:text-brand-dark hover:bg-brand-light/35 rounded-xl transition shrink-0"><Grid3x3 className="w-3.5 h-3.5" /> সকল পণ্য</Link>
          <span className="w-px h-5 bg-brand-light/60 mx-1" />
          {categories.map((c) => <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} className="px-3 py-2 text-xs font-semibold text-foreground/75 hover:text-brand-dark hover:bg-brand-light/35 rounded-xl transition shrink-0">{c.name}</Link>)}
          <span className="ml-auto" />
          <Link to="/contact" className="flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold text-brand-dark hover:bg-brand-light/35 rounded-xl transition shrink-0"><Phone className="w-3.5 h-3.5" /> যোগাযোগ</Link>
        </div>
      </div>
    </header>

    {drawer && <div className="fixed inset-0 z-50 flex"><div className="flex-1 bg-black/55 backdrop-blur-[2px] animate-fade-in" onClick={() => setDrawer(false)} /><aside className="w-[88%] max-w-sm bg-white h-full flex flex-col shadow-2xl animate-slide-in-right"><div className="flex items-center justify-between p-4 border-b bg-gradient-to-br from-brand to-brand-dark text-white"><div className="flex items-center gap-3">{drawerLogoNode}<div><div className="font-extrabold">{brandName}</div><div className="text-[11px] text-white/80">{brand.tagline || "দেশী ও বিদেশী বীজ"}</div></div></div><button onClick={() => setDrawer(false)} className="p-2 rounded-xl hover:bg-white/15 active:scale-95 transition"><X className="w-5 h-5" /></button></div><nav className="flex-1 overflow-y-auto p-2"><Link to="/" onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-muted font-semibold border-b"><span>হোম</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></Link><Link to="/shop" onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-muted font-semibold border-b"><span>সকল পণ্য</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></Link><Link to="/contact" onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-muted font-semibold border-b"><span>যোগাযোগ</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></Link><div className="pt-4 pb-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">ক্যাটাগরি</div>{categories.map((c) => <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-brand-light/30 hover:text-brand-dark border-b"><span className="font-medium">{c.name}</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></Link>)}</nav></aside></div>}
    {cartOpen && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />}
  </>;
}
