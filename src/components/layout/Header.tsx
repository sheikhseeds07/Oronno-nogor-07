import { SafeImage } from "@/components/SafeImage";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Search, X, ChevronRight, Home, Grid3x3, Phone, ArrowRight, Palette, Leaf, Sprout, Flower2, TreePine, Wheat, Sun, UserRound, BadgePercent } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { hydrateCartStore, useCart } from "@/lib/cart-store";
import { bnDigits } from "@/lib/format";
import { supabase } from "@/lib/personal-supabase/client";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";
import { CartDrawer } from "@/components/shop/CartDrawer";
import { SITE_THEMES, applyTheme, getStoredTheme } from "@/lib/theme-store";

type NavCategory = { id: string; name: string; slug: string };
type SiteSettings = { site_name?: string; tagline?: string; header_subtitle?: string; logo_url?: string };

const CAT_ICONS = [Leaf, Sprout, Flower2, TreePine, Wheat, Sun];

export function Header() {
  const count = useCart((s) => s.count());
  const bumpKey = useCart((s) => s.bumpKey);
  const [drawer, setDrawer] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState("default");
  const navigate = useNavigate();

  const { data: brandRow } = useQuery(publicSiteSettingsQuery);
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

  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeDrawer = useCallback(() => {
    if (closing) return;
    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => { setDrawer(false); setClosing(false); }, 340);
  }, [closing]);
  const submit = (e: React.FormEvent) => { e.preventDefault(); navigate({ to: "/shop", search: { q } as never }); closeDrawer(); };
  useEffect(() => { if (!drawer) return; const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, [drawer]);
  useEffect(() => { void hydrateCartStore(); const t = getStoredTheme(); setTheme(t); applyTheme(t); }, []);

  const logoNode = brandLogo ? (
    <SafeImage src={brandLogo} alt={brandName} width={40} height={40} loading="eager" fetchPriority="high" decoding="async"  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-brand/30 shadow-md group-hover:ring-brand group-hover:scale-110 group-hover:rotate-3 transition-all duration-300" />
  ) : <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-brand-light/40 animate-pulse ring-2 ring-brand/20" aria-hidden="true" />;
  const drawerLogoNode = brandLogo ? <SafeImage src={brandLogo} alt={brandName} width={48} height={48} decoding="async"  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/50 shadow-xl" /> : <div className="w-12 h-12 rounded-2xl bg-white/10 animate-pulse ring-2 ring-white/20" aria-hidden="true" />;

  let itemIdx = 0;
  const nextDelay = () => `${80 + itemIdx++ * 45}ms`;

  return <>
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-2xl border-b border-brand-light/50 shadow-[0_4px_20px_rgba(22,101,52,0.08)]">
      {/* colorful gradient hairline */}
      <div className="h-[3px] w-full bg-gradient-to-r from-brand via-lime-400 via-40% to-brand-dark" />
      <div className="container mx-auto px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center gap-2">
        <button onClick={() => setDrawer(true)} className="group shrink-0 flex flex-col items-center justify-center gap-[4px] w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark shadow-md shadow-brand/30 hover:shadow-lg hover:shadow-brand/40 hover:-translate-y-0.5 active:scale-90 transition-all duration-300" aria-label="মেনু">
          <span className="block w-[16px] h-[2px] rounded-full bg-white group-hover:w-[11px] transition-all duration-300 origin-left" />
          <span className="block w-[16px] h-[2px] rounded-full bg-white transition-all duration-300" />
          <span className="block w-[10px] h-[2px] rounded-full bg-white group-hover:w-[16px] transition-all duration-300 origin-left" />
        </button>

        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          {logoNode}
          <div className="leading-tight hidden sm:block">
            <div className="font-black text-[16px] lg:text-[18px] tracking-[-0.02em] bg-gradient-to-r from-brand-dark via-brand to-brand-dark bg-clip-text text-transparent">{brandName}</div>
            <div className="text-[8px] lg:text-[9px] text-brand/80 font-bold tracking-[0.18em] mt-px">{brandSubtitle}</div>
          </div>
        </Link>

        <form onSubmit={submit} className="flex-1 relative max-w-2xl mx-auto group/search">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-brand group-focus-within/search:text-brand-dark transition-colors" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="পণ্য খুঁজুন" className="w-full h-9 sm:h-10 bg-gradient-to-r from-brand-light/40 to-lime-100/50 border border-brand-light/70 rounded-full pl-10 pr-4 text-[13px] font-medium placeholder:text-brand-dark/50 focus:outline-none focus:bg-white focus:border-brand/70 focus:ring-4 focus:ring-brand/15 transition-all duration-300" />
        </form>

        <button onClick={() => setCartOpen(true)} className={`relative shrink-0 flex items-center gap-1 sm:gap-1.5 rounded-full bg-gradient-to-r from-brand to-brand-dark pl-3 sm:pl-4 pr-1 py-1 shadow-md shadow-brand/30 hover:shadow-lg hover:shadow-brand/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 ${bump ? "ring-4 ring-brand/20 scale-[1.05]" : ""}`} aria-label="অর্ডার কার্ট">
          <span className="font-black text-white text-[12px] sm:text-[13px] drop-shadow-sm">অর্ডার</span>
          <ArrowRight className="w-3.5 h-3.5 text-white/90" />
          <span className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white shadow-inner">
            <ShoppingCart className={`w-4 h-4 text-brand-dark ${bump ? "animate-bounce" : ""}`} />
            {count > 0 && <span key={bumpKey} className="badge-pop absolute -top-1.5 -right-1.5 bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[10px] font-black rounded-full min-w-[19px] h-[19px] px-1 flex items-center justify-center ring-2 ring-white shadow-md">{bnDigits(count)}</span>}
          </span>
        </button>
      </div>

      <div className="hidden md:block border-t border-brand-light/40 bg-gradient-to-r from-brand-light/15 via-white to-brand-light/15">
        <div className="container mx-auto px-3 py-1 flex items-center gap-1 overflow-x-auto">
          <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-gradient-to-r from-brand to-brand-dark shadow-sm shadow-brand/25 rounded-full transition shrink-0"><Home className="w-3.5 h-3.5" /> হোম</Link>
          <Link to="/shop" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-dark hover:text-white hover:bg-gradient-to-r hover:from-brand hover:to-brand-dark rounded-full transition shrink-0"><Grid3x3 className="w-3.5 h-3.5" /> সকল পণ্য</Link>
          <span className="w-px h-4 bg-brand-light mx-1" />
          {categories.map((c) => <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} className="px-3 py-1.5 text-xs font-semibold text-foreground/75 hover:text-white hover:bg-gradient-to-r hover:from-brand hover:to-brand-dark rounded-full transition shrink-0">{c.name}</Link>)}
          <span className="ml-auto" />
          <Link to="/contact" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-brand-dark hover:text-white hover:bg-gradient-to-r hover:from-brand hover:to-brand-dark rounded-full transition shrink-0"><Phone className="w-3.5 h-3.5" /> যোগাযোগ</Link>
        </div>
      </div>
    </header>

    {drawer && (
      <div className={`fixed inset-0 z-50 ${closing ? "drawer-exit" : ""}`}>
        <div className="drawer-backdrop absolute inset-0 bg-gradient-to-br from-brand-dark/60 via-black/55 to-brand-dark/60 backdrop-blur-sm" onClick={closeDrawer} />
        <aside className="drawer-panel absolute left-0 top-0 h-full w-[82%] max-w-[310px] bg-white flex flex-col shadow-[8px_0_40px_rgba(20,83,45,0.35)] rounded-r-[24px] overflow-hidden">
          {/* premium gradient head */}
          <div className="relative bg-gradient-to-br from-brand via-brand-dark to-[oklch(0.3_0.1_150)] text-white px-4 pt-4 pb-4 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-2xl pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-lime-300/20 blur-2xl pointer-events-none" aria-hidden="true" />
            <button type="button" onClick={closeDrawer} className="absolute top-3 right-3 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 hover:rotate-90 active:scale-90 transition-all duration-300 cursor-pointer" aria-label="বন্ধ করুন"><X className="w-4 h-4" /></button>
            <div className="relative flex items-center gap-2.5">
              {drawerLogoNode}
              <div>
                <div className="font-black text-[16px] tracking-tight drop-shadow-sm">{brandName}</div>
                <div className="text-[10px] text-white/85 font-medium">{brand.tagline || "দেশী ও বিদেশী বীজ"}</div>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2.5 py-2.5">
            <div className="space-y-1">
              <Link to="/" onClick={closeDrawer} style={{ "--d": nextDelay() } as React.CSSProperties} className="drawer-item group flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-gradient-to-r from-brand-light/40 to-transparent hover:from-brand-light/60 transition">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm shadow-brand/30 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300"><Home className="w-3.5 h-3.5" /></span>
                <span className="font-bold text-[13px] text-brand-dark">হোম</span>
                <ChevronRight className="w-4 h-4 ml-auto text-brand/50 group-hover:translate-x-1 group-hover:text-brand transition-all" />
              </Link>
              <Link to="/shop" onClick={closeDrawer} style={{ "--d": nextDelay() } as React.CSSProperties} className="drawer-item group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-gradient-to-r hover:from-brand-light/60 hover:to-transparent transition">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-lime-500 to-brand text-white shadow-sm shadow-brand/30 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300"><Grid3x3 className="w-3.5 h-3.5" /></span>
                <span className="font-bold text-[13px]">সকল পণ্য</span>
                <ChevronRight className="w-4 h-4 ml-auto text-brand/50 group-hover:translate-x-1 group-hover:text-brand transition-all" />
              </Link>
              <Link to="/offers" onClick={closeDrawer} style={{ "--d": nextDelay() } as React.CSSProperties} className="drawer-item group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-gradient-to-r hover:from-brand-light/60 hover:to-transparent transition">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/30 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300"><BadgePercent className="w-3.5 h-3.5" /></span>
                <span className="font-bold text-[13px]">অফার</span>
                <ChevronRight className="w-4 h-4 ml-auto text-brand/50 group-hover:translate-x-1 group-hover:text-brand transition-all" />
              </Link>
              <Link to="/customer-login" onClick={closeDrawer} style={{ "--d": nextDelay() } as React.CSSProperties} className="drawer-item group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-gradient-to-r hover:from-brand-light/60 hover:to-transparent transition">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-sm shadow-sky-500/30 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300"><UserRound className="w-3.5 h-3.5" /></span>
                <span className="font-bold text-[13px]">আমার অ্যাকাউন্ট</span>
                <ChevronRight className="w-4 h-4 ml-auto text-brand/50 group-hover:translate-x-1 group-hover:text-brand transition-all" />
              </Link>
              <Link to="/contact" onClick={closeDrawer} style={{ "--d": nextDelay() } as React.CSSProperties} className="drawer-item group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-gradient-to-r hover:from-brand-light/60 hover:to-transparent transition">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-500/30 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300"><Phone className="w-3.5 h-3.5" /></span>
                <span className="font-bold text-[13px]">যোগাযোগ</span>
                <ChevronRight className="w-4 h-4 ml-auto text-brand/50 group-hover:translate-x-1 group-hover:text-brand transition-all" />
              </Link>
            </div>

            {categories.length > 0 && <>
              <div className="drawer-item flex items-center gap-2 pt-3.5 pb-1.5 px-2.5" style={{ "--d": nextDelay() } as React.CSSProperties}>
                <span className="text-[10px] font-black text-brand-dark/70 uppercase tracking-[0.2em]">ক্যাটাগরি</span>
                <span className="flex-1 h-px bg-gradient-to-r from-brand/40 to-transparent" />
              </div>
              <div className="space-y-1">
                {categories.map((c, i) => {
                  const Icon = CAT_ICONS[i % CAT_ICONS.length];
                  return (
                    <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} onClick={closeDrawer} style={{ "--d": nextDelay() } as React.CSSProperties} className="drawer-item group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-gradient-to-r hover:from-brand-light/60 hover:to-transparent transition">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-light/50 text-brand-dark ring-1 ring-brand/20 group-hover:bg-gradient-to-br group-hover:from-brand group-hover:to-brand-dark group-hover:text-white group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300"><Icon className="w-3.5 h-3.5" /></span>
                      <span className="font-semibold text-[12.5px]">{c.name}</span>
                      <ChevronRight className="w-4 h-4 ml-auto text-brand/40 group-hover:translate-x-1 group-hover:text-brand transition-all" />
                    </Link>
                  );
                })}
              </div>
            </>}

            <div className="drawer-item flex items-center gap-2 pt-4 pb-2 px-2.5" style={{ "--d": nextDelay() } as React.CSSProperties}>
              <Palette className="w-3.5 h-3.5 text-brand" />
              <span className="text-[10px] font-black text-brand-dark/70 uppercase tracking-[0.2em]">থিম</span>
              <span className="flex-1 h-px bg-gradient-to-r from-brand/40 to-transparent" />
            </div>
            <div className="drawer-item flex flex-wrap gap-1.5 px-2 pb-2" style={{ "--d": nextDelay() } as React.CSSProperties}>
              {SITE_THEMES.map((t) => {
                const active = t.id === theme;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setTheme(t.id); applyTheme(t.id); }}
                    aria-pressed={active}
                    className={`theme-swatch flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1.5 border transition ${active ? "border-brand ring-2 ring-brand/25 bg-brand-light/40 shadow-sm" : "border-brand-light/70 hover:border-brand/50 hover:bg-brand-light/20"}`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full ring-1 ring-black/15 shrink-0" style={{ background: `linear-gradient(135deg, ${t.colors[0]} 0%, ${t.colors[1]} 100%)` }} />
                    <span className={`text-[11px] font-bold leading-none ${active ? "text-brand-dark" : "text-foreground/75"}`}>{t.name}</span>
                  </button>
                );
              })}
            </div>

          </nav>

          <div className="px-4 py-3 border-t border-brand-light/50 bg-gradient-to-r from-brand-light/25 to-transparent">
            <div className="text-[10px] font-bold text-brand-dark/60 tracking-wide text-center">🌱 {brandName} — সাথেই আছে, সাথেই থাকবে</div>
          </div>

        </aside>
      </div>
    )}
    {cartOpen && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />}
  </>;
}
