import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Search, Menu, X, ChevronRight, Home, Grid3x3, Phone, ShieldCheck, Truck, BadgeCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { hydrateCartStore, useCart } from "@/lib/cart-store";
import { bnDigits } from "@/lib/format";
import { supabase } from "@/lib/personal-supabase/client";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";
import { CartDrawer } from "@/components/shop/CartDrawer";

type NavCategory = { id: string; name: string; slug: string };
type SiteSettings = { site_name?: string; tagline?: string; header_subtitle?: string; logo_url?: string; phone?: string; contact_phone?: string };

export function Header() {
  const count = useCart((s) => s.count());
  const bumpKey = useCart((s) => s.bumpKey);
  const [drawer, setDrawer] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  const { data: brandRow } = useQuery(publicSiteSettingsQuery);
  const brand = (brandRow?.settings as SiteSettings) ?? {};
  const brandName = brand.site_name || "Sheikh Seeds";
  const brandLogo = brand.logo_url || "/logo.jpg";
  const brandSubtitle = brand.header_subtitle || "PREMIUM SEED HOUSE";
  const brandPhone = brand.contact_phone || brand.phone || "";

  useEffect(() => {
    if (bumpKey === 0) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 650);
    return () => clearTimeout(t);
  }, [bumpKey]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    <img src={brandLogo} alt={brandName} width={48} height={48} loading="eager" fetchPriority="high" decoding="async" className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover ring-1 ring-brand/25 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.35)] transition-transform duration-500 group-hover:scale-[1.05]" />
  ) : <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-brand-light/30 animate-pulse ring-1 ring-brand/20" aria-hidden="true" />;
  const drawerLogoNode = brandLogo ? <img src={brandLogo} alt={brandName} width={48} height={48} decoding="async" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/40 shadow-lg" /> : <div className="w-12 h-12 rounded-2xl bg-white/10 animate-pulse ring-2 ring-white/20" aria-hidden="true" />;

  const navLink = "relative px-3.5 py-2 text-[13px] font-semibold text-foreground/75 rounded-full transition-colors duration-200 hover:text-brand-dark hover:bg-brand-light/30 shrink-0";

  return <>
    <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? "shadow-[0_10px_34px_-18px_rgba(0,0,0,0.45)]" : ""}`}>
      {/* Top utility strip */}
      <div className="hidden sm:block bg-gradient-to-r from-brand-dark via-brand to-brand-dark text-white/90">
        <div className="container mx-auto px-4 h-9 flex items-center justify-between text-[11px] font-medium tracking-wide">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 opacity-80" /> সারা দেশে দ্রুত হোম ডেলিভারি</span>
            <span className="hidden lg:flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 opacity-80" /> ১০০% অরিজিনাল বীজের নিশ্চয়তা</span>
          </div>
          <div className="flex items-center gap-5">
            <span className="hidden md:flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5 opacity-80" /> ক্যাশ অন ডেলিভারি</span>
            {brandPhone && <a href={`tel:${brandPhone}`} className="flex items-center gap-1.5 font-semibold hover:text-white transition-colors"><Phone className="w-3.5 h-3.5" /> {brandPhone}</a>}
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className={`bg-white/85 backdrop-blur-xl border-b border-brand-light/40 transition-all duration-300`}>
        <div className={`container mx-auto px-3 sm:px-4 flex items-center gap-2.5 sm:gap-4 ${scrolled ? "py-2" : "py-3"} transition-all duration-300`}>
          <Link to="/" className="flex items-center gap-3 shrink-0 group">
            {logoNode}
            <div className="leading-tight hidden sm:block">
              <div className="font-extrabold text-brand-dark text-[18px] lg:text-[20px] tracking-[-0.02em]">{brandName}</div>
              <div className="text-[8.5px] lg:text-[9.5px] text-muted-foreground font-semibold tracking-[0.22em] mt-0.5 uppercase">{brandSubtitle}</div>
            </div>
          </Link>

          <form onSubmit={submit} className="flex-1 relative max-w-2xl mx-auto group/search">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/search:text-brand transition-colors" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="পছন্দের বীজ খুঁজুন..." className="w-full h-11 bg-muted/50 border border-border/70 rounded-full pl-10 pr-[78px] sm:pr-[88px] text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:bg-white focus:border-brand/60 focus:ring-4 focus:ring-brand/10 transition-all duration-300" />
            <button type="submit" className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-brand-dark text-white rounded-full text-xs font-bold tracking-wide hover:bg-brand transition-colors active:scale-95">খুঁজুন</button>
          </form>

          <button onClick={() => setCartOpen(true)} className={`relative shrink-0 flex items-center gap-2 rounded-full bg-brand-dark text-white pl-4 pr-2 py-2 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] hover:bg-brand transition-all duration-300 ${bump ? "ring-4 ring-brand/20" : ""}`} aria-label="অর্ডার কার্ট">
            <span className="hidden sm:block text-[12px] font-bold tracking-wide">কার্ট</span>
            <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/15 ring-1 ring-white/20">
              <ShoppingCart className={`w-[17px] h-[17px] ${bump ? "animate-bounce" : ""}`} />
              {count > 0 && <span key={bumpKey} className="badge-pop absolute -top-1.5 -right-1.5 bg-white text-brand-dark text-[10px] font-black rounded-full min-w-[19px] h-[19px] px-1 flex items-center justify-center ring-2 ring-brand-dark">{bnDigits(count)}</span>}
            </span>
          </button>

          <button onClick={() => setDrawer(true)} className="p-2.5 rounded-full border border-border/70 text-brand-dark hover:bg-brand-light/30 hover:border-brand/30 active:scale-95 transition-all shrink-0" aria-label="মেনু"><Menu className="w-5 h-5" /></button>
        </div>

        {/* Category nav */}
        <div className="hidden md:block border-t border-brand-light/30">
          <div className="container mx-auto px-3 py-1.5 flex items-center gap-1 overflow-x-auto">
            <Link to="/" className={navLink} activeProps={{ className: `${navLink} text-brand-dark bg-brand-light/40` }}><span className="flex items-center gap-1.5"><Home className="w-3.5 h-3.5" /> হোম</span></Link>
            <Link to="/shop" className={navLink} activeProps={{ className: `${navLink} text-brand-dark bg-brand-light/40` }}><span className="flex items-center gap-1.5"><Grid3x3 className="w-3.5 h-3.5" /> সকল পণ্য</span></Link>
            <span className="w-px h-4 bg-border mx-1.5 shrink-0" />
            {categories.map((c) => <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} className={navLink} activeProps={{ className: `${navLink} text-brand-dark bg-brand-light/40` }}>{c.name}</Link>)}
            <span className="ml-auto" />
            <Link to="/contact" className="shrink-0 ml-2 flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold text-brand-dark border border-brand/30 rounded-full hover:bg-brand-dark hover:text-white hover:border-brand-dark transition-all duration-200"><Phone className="w-3.5 h-3.5" /> যোগাযোগ</Link>
          </div>
        </div>
      </div>
    </header>

    {drawer && <div className="fixed inset-0 z-50 flex"><div className="flex-1 bg-black/55 backdrop-blur-[2px] animate-fade-in" onClick={() => setDrawer(false)} /><aside className="w-[88%] max-w-sm bg-white h-full flex flex-col shadow-2xl animate-slide-in-right"><div className="flex items-center justify-between p-4 border-b bg-gradient-to-br from-brand to-brand-dark text-white"><div className="flex items-center gap-3">{drawerLogoNode}<div><div className="font-extrabold">{brandName}</div><div className="text-[11px] text-white/80">{brand.tagline || "দেশী ও বিদেশী বীজ"}</div></div></div><button onClick={() => setDrawer(false)} className="p-2 rounded-xl hover:bg-white/15 active:scale-95 transition"><X className="w-5 h-5" /></button></div><nav className="flex-1 overflow-y-auto p-2"><Link to="/" onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-muted font-semibold border-b"><span>হোম</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></Link><Link to="/shop" onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-muted font-semibold border-b"><span>সকল পণ্য</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></Link><Link to="/contact" onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-muted font-semibold border-b"><span>যোগাযোগ</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></Link><div className="pt-4 pb-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">ক্যাটাগরি</div>{categories.map((c) => <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-brand-light/30 hover:text-brand-dark border-b"><span className="font-medium">{c.name}</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></Link>)}</nav></aside></div>}
    {cartOpen && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />}
  </>;
}
