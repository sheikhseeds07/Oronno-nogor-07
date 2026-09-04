import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Search, Menu, X, ChevronRight, Home, Grid3x3, Phone, Sparkles, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { hydrateCartStore, useCart } from "@/lib/cart-store";
import { bnDigits } from "@/lib/format";
import { supabase } from "@/lib/personal-supabase/client";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";
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

  const submit = (e: React.FormEvent) => { e.preventDefault(); navigate({ to: "/shop", search: { q } as never }); setDrawer(false); };
  useEffect(() => { if (!drawer) return; const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, [drawer]);
  useEffect(() => { void hydrateCartStore(); }, []);

  const logoNode = brandLogo ? (
    <img src={brandLogo} alt={brandName} width={48} height={48} loading="eager" fetchPriority="high" decoding="async" className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover ring-2 ring-brand/25 shadow-md group-hover:ring-brand/60 group-hover:scale-105 group-hover:shadow-lg transition-all duration-300" />
  ) : <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-brand-light/30 animate-pulse ring-2 ring-brand/20" aria-hidden="true" />;
  const drawerLogoNode = brandLogo ? <img src={brandLogo} alt={brandName} width={48} height={48} decoding="async" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/40 shadow-lg" /> : <div className="w-12 h-12 rounded-2xl bg-white/10 animate-pulse ring-2 ring-white/20" aria-hidden="true" />;

  return <>
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-2xl border-b border-brand-light/40 shadow-[0_6px_24px_rgba(0,0,0,0.05)]">
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3">
        <button onClick={() => setDrawer(true)} className="group shrink-0 flex flex-col items-center justify-center gap-[5px] w-11 h-11 rounded-full bg-white border border-brand-light/70 shadow-sm hover:shadow-md hover:border-brand/40 hover:-translate-y-0.5 active:scale-90 transition-all duration-300" aria-label="মেনু">
          <span className="block w-[18px] h-[2px] rounded-full bg-brand-dark group-hover:w-[14px] group-hover:bg-brand transition-all duration-300 origin-left" />
          <span className="block w-[18px] h-[2px] rounded-full bg-brand-dark group-hover:bg-brand transition-all duration-300" />
          <span className="block w-[12px] h-[2px] rounded-full bg-brand-dark group-hover:w-[18px] group-hover:bg-brand transition-all duration-300 origin-left" />
        </button>

        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          {logoNode}
          <div className="leading-tight hidden sm:block">
            <div className="font-black text-brand-dark text-[17px] lg:text-[19px] tracking-[-0.02em]">{brandName}</div>
            <div className="text-[8px] lg:text-[9px] text-muted-foreground font-bold tracking-[0.16em] mt-0.5">{brandSubtitle}</div>
          </div>
        </Link>

        <form onSubmit={submit} className="flex-1 relative max-w-2xl mx-auto group/search">
          <Search className="w-[18px] h-[18px] absolute left-4 top-1/2 -translate-y-1/2 text-brand/70 group-focus-within/search:text-brand transition-colors" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="শ্যাড খুঁজুন" className="w-full h-11 sm:h-12 bg-brand-light/35 border border-transparent rounded-full pl-11 pr-4 text-sm font-medium placeholder:text-muted-foreground/80 focus:outline-none focus:bg-white focus:border-brand/60 focus:ring-4 focus:ring-brand/10 transition-all duration-300 shadow-inner" />
        </form>

        <button onClick={() => setCartOpen(true)} className={`relative shrink-0 flex items-center gap-1.5 sm:gap-2 rounded-full bg-brand-light/30 border border-brand/25 pl-4 sm:pl-5 pr-1.5 py-1.5 shadow-sm hover:shadow-md hover:border-brand/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 ${bump ? "ring-4 ring-brand/15 scale-[1.03]" : ""}`} aria-label="অর্ডার কার্ট">
          <span className="font-black text-brand-dark text-[13px] sm:text-sm">অর্ডার</span>
          <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-dark/80" />
          <span className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark text-white shadow-md">
            <ShoppingCart className={`w-[18px] h-[18px] ${bump ? "animate-bounce" : ""}`} />
            {count > 0 && <span key={bumpKey} className="badge-pop absolute -top-1.5 -right-1.5 bg-white text-brand-dark text-[10px] font-black rounded-full min-w-[20px] h-[20px] px-1 flex items-center justify-center ring-2 ring-brand shadow-md">{bnDigits(count)}</span>}
          </span>
        </button>
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
