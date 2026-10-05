import { SafeImage } from "@/components/SafeImage";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, type Permissions } from "@/lib/auth";
import { supabase } from "@/lib/personal-supabase/client";
import { readPublicSettingsCache, writePublicSettingsCache } from "@/lib/public-settings-cache";
import { LayoutDashboard, Package, ShoppingBag, Users, FolderTree, Image as ImageIcon, Settings, Globe, UserCog, LogOut, Menu, X, Layers, FileSpreadsheet, PanelLeftClose, PanelLeftOpen, ChevronRight, Sparkles, Leaf } from "lucide-react";
import { NewOrderNotifier } from "@/components/admin/NewOrderNotifier";
import { AdminOrderStability } from "@/components/admin/AdminOrderStability";
import { PresswayyCard } from "@/components/admin/PresswayyCard";

type SiteSettings = { site_name?: string; logo_url?: string; admin_header_announcement?: string };
type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean; perm: keyof Permissions; tone: string };
const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, perm: "dashboard", tone: "from-emerald-400 to-cyan-500" },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag, perm: "orders", tone: "from-blue-400 to-cyan-500" },
  { to: "/admin/order-import", label: "Import Orders", icon: FileSpreadsheet, perm: "order_import", tone: "from-teal-400 to-emerald-500" },
  { to: "/admin/products", label: "Products", icon: Package, perm: "products", tone: "from-amber-400 to-orange-500" },
  { to: "/admin/offers", label: "Offers", icon: Sparkles, perm: "products", tone: "from-emerald-400 to-teal-500" },
  { to: "/admin/offers", label: "Offers", icon: Sparkles, perm: "offers", tone: "from-orange-400 to-rose-500" },
  { to: "/admin/categories", label: "Categories", icon: FolderTree, perm: "categories", tone: "from-fuchsia-400 to-pink-500" },
  { to: "/admin/customers", label: "Customers", icon: Users, perm: "customers", tone: "from-sky-400 to-blue-500" },
  { to: "/admin/banners", label: "Banners", icon: ImageIcon, perm: "banners", tone: "from-rose-400 to-red-500" },
  { to: "/admin/landing-pages", label: "Landing Pages", icon: Globe, perm: "landing_pages", tone: "from-cyan-400 to-blue-600" },
  { to: "/admin/employees", label: "Employees", icon: UserCog, perm: "employees", tone: "from-green-400 to-emerald-600" },
  { to: "/admin/all-api", label: "All APIs", icon: Layers, perm: "all_api", tone: "from-indigo-400 to-violet-600" },
  { to: "/admin/settings", label: "Settings", icon: Settings, perm: "settings", tone: "from-slate-300 to-slate-500" },
];

// Per-page permission map. Every admin page (including ones without a sidebar
// entry) resolves to one of the 13 modules the CEO grants in
// Employees → Permissions. Unmapped pages are denied — there is no fallback.
const ROUTE_PERMS: { prefix: string; perm: keyof Permissions }[] = [
  { prefix: "/admin/orders", perm: "orders" },
  { prefix: "/admin/order-division", perm: "orders" },
  { prefix: "/admin/order-rate-limit", perm: "orders" },
  { prefix: "/admin/deleted-orders", perm: "orders" },
  { prefix: "/admin/order-import", perm: "order_import" },
  { prefix: "/admin/products", perm: "products" },
  { prefix: "/admin/offers", perm: "offers" },
  { prefix: "/admin/categories", perm: "categories" },
  { prefix: "/admin/customers", perm: "customers" },
  { prefix: "/admin/customer-management", perm: "customers" },
  { prefix: "/admin/customer-feedback", perm: "customers" },
  { prefix: "/admin/banners", perm: "banners" },
  { prefix: "/admin/landing-pages", perm: "landing_pages" },
  { prefix: "/admin/landing-seeds", perm: "landing_pages" },
  { prefix: "/admin/landing-template", perm: "landing_pages" },
  { prefix: "/admin/employees", perm: "employees" },
  { prefix: "/admin/all-api", perm: "all_api" },
  { prefix: "/admin/integrations", perm: "all_api" },
  { prefix: "/admin/meta-ad-account", perm: "all_api" },
  { prefix: "/admin/courier", perm: "all_api" },
  { prefix: "/admin/settings", perm: "settings" },
];

function requiredPermFor(pathname: string): keyof Permissions | null {
  if (pathname === "/admin" || pathname === "/admin/") return "dashboard";
  const match = ROUTE_PERMS.filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match ? match.perm : null;
}

const orderUiCss = `
[data-admin-route="/admin/orders"] > div:last-child { background: radial-gradient(circle at 8% 0%,rgba(20,184,166,.10),transparent 28%),radial-gradient(circle at 92% 18%,rgba(99,102,241,.08),transparent 30%),linear-gradient(180deg,#f8fbfa 0%,#f3f7f7 52%,#f8f8fb 100%); }
[data-admin-route="/admin/orders"] .order-extra-shell { margin-top: 2px; }
[data-admin-route="/admin/orders"] .order-extra-shell > div { background:linear-gradient(135deg,#ffffff 0%,#f2f8f7 48%,#f8f5ff 100%) !important; border:1px solid rgba(148,163,184,.24) !important; border-radius:18px !important; padding:5px !important; box-shadow:0 12px 32px rgba(15,23,42,.07),inset 0 1px 0 rgba(255,255,255,.95) !important; }
[data-admin-route="/admin/orders"] .order-extra-shell button { min-height:42px; border-radius:13px !important; border:1px solid transparent !important; font-weight:800 !important; transition:transform .25s cubic-bezier(.22,1,.36,1),box-shadow .25s ease,background .25s ease,color .25s ease !important; }
[data-admin-route="/admin/orders"] .order-extra-shell button:hover { transform:translateY(-2px); box-shadow:0 8px 18px rgba(15,23,42,.10); }
[data-admin-route="/admin/orders"] .order-extra-shell button:active { transform:scale(.97); }
[data-admin-route="/admin/orders"] .order-extra-shell button:first-child { background:linear-gradient(135deg,#0f766e,#0d9488) !important; color:#fff !important; box-shadow:0 8px 20px rgba(13,148,136,.24); }
[data-admin-route="/admin/orders"] .order-extra-shell button:first-child:hover { background:linear-gradient(135deg,#0d9488,#0891b2) !important; }
[data-admin-route="/admin/orders"] .order-extra-shell svg { transition:transform .25s ease; }
[data-admin-route="/admin/orders"] .order-extra-shell button:hover svg { transform:scale(1.12) rotate(-3deg); }
[data-admin-route="/admin/orders"] input, [data-admin-route="/admin/orders"] select { border-color:rgba(148,163,184,.30) !important; border-radius:13px !important; box-shadow:0 3px 10px rgba(15,23,42,.035); transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease,background .2s ease; }
[data-admin-route="/admin/orders"] input:focus, [data-admin-route="/admin/orders"] select:focus { border-color:rgba(13,148,136,.55) !important; background:#fff !important; box-shadow:0 0 0 4px rgba(13,148,136,.10),0 8px 20px rgba(15,23,42,.06) !important; }
[data-admin-route="/admin/orders"] > div:last-child > div { max-width:1800px; margin:0 auto; }
[data-admin-route="/admin/orders"] > div:last-child > div > div.mb-3.relative { margin-top:2px; padding:5px; border-radius:18px; background:rgba(255,255,255,.92); border:1px solid rgba(148,163,184,.18); box-shadow:0 12px 34px rgba(15,23,42,.06); }
[data-admin-route="/admin/orders"] > div:last-child > div > div.mb-3.relative input { height:48px; border:0 !important; border-radius:13px !important; background:#f8fafc; padding-left:44px; font-weight:650; }
[data-admin-route="/admin/orders"] > div:last-child > div > div.mb-3.relative input::placeholder { color:#94a3b8; font-weight:500; }
[data-admin-route="/admin/orders"] > div:last-child > div > div.mb-3.relative input:focus { background:#fff; }
[data-admin-route="/admin/orders"] > div:last-child > div > div.flex.gap-2.mb-3.overflow-x-auto { padding:6px; margin:10px 0 13px; border-radius:18px; background:rgba(255,255,255,.74); border:1px solid rgba(148,163,184,.16); box-shadow:0 8px 24px rgba(15,23,42,.045); scrollbar-width:none; }
[data-admin-route="/admin/orders"] > div:last-child > div > div.flex.gap-2.mb-3.overflow-x-auto::-webkit-scrollbar { display:none; }
[data-admin-route="/admin/orders"] > div:last-child > div > div.flex.gap-2.mb-3.overflow-x-auto > button { min-height:40px; padding-left:14px; padding-right:14px; border-radius:12px; border:1px solid rgba(148,163,184,.17); background:rgba(255,255,255,.9); color:#475569; box-shadow:0 3px 9px rgba(15,23,42,.035); transition:all .22s cubic-bezier(.22,1,.36,1); }
[data-admin-route="/admin/orders"] > div:last-child > div > div.flex.gap-2.mb-3.overflow-x-auto > button:hover { transform:translateY(-2px); border-color:rgba(13,148,136,.25); color:#0f172a; box-shadow:0 9px 20px rgba(15,118,110,.10); }
[data-admin-route="/admin/orders"] > div:last-child > div > div.flex.gap-2.mb-3.overflow-x-auto > button:first-child { background:linear-gradient(135deg,#0f766e,#14b8a6); color:#fff; border-color:transparent; box-shadow:0 8px 20px rgba(13,148,136,.22); }
[data-admin-route="/admin/orders"] > div:last-child > div > div.flex.gap-2.mb-3.overflow-x-auto > button span { font-variant-numeric:tabular-nums; }
[data-admin-route="/admin/orders"] > div:last-child > div > div.bg-white.border.border-slate-200.rounded-xl.overflow-hidden.shadow-sm { border:1px solid rgba(148,163,184,.17); border-radius:20px; background:rgba(255,255,255,.94); box-shadow:0 20px 55px rgba(15,23,42,.075); overflow:hidden; }
[data-admin-route="/admin/orders"] table { border-collapse:separate !important; border-spacing:0 7px !important; }
[data-admin-route="/admin/orders"] thead { background:linear-gradient(135deg,#0b1320,#164e63) !important; }
[data-admin-route="/admin/orders"] thead tr { background:linear-gradient(135deg,#0f766e,#115e59) !important; }
[data-admin-route="/admin/orders"] thead th { color:#ecfeff !important; border:0 !important; padding-top:13px !important; padding-bottom:13px !important; font-size:10px !important; font-weight:850 !important; letter-spacing:.07em; text-transform:uppercase; white-space:nowrap; }
[data-admin-route="/admin/orders"] tbody tr { background:rgba(255,255,255,.97) !important; box-shadow:0 4px 15px rgba(15,23,42,.05); transition:transform .22s ease,box-shadow .22s ease,background .22s ease; }
[data-admin-route="/admin/orders"] tbody tr:hover { transform:translateY(-2px); background:#fbfffe !important; box-shadow:0 10px 26px rgba(15,23,42,.09); }
[data-admin-route="/admin/orders"] tbody td { border-top:1px solid rgba(226,232,240,.72) !important; border-bottom:1px solid rgba(226,232,240,.72) !important; background:transparent !important; padding-top:14px !important; padding-bottom:14px !important; }
[data-admin-route="/admin/orders"] tbody td:first-child { border-left:1px solid rgba(226,232,240,.72) !important; border-radius:12px 0 0 12px; }
[data-admin-route="/admin/orders"] tbody td:last-child { border-right:1px solid rgba(226,232,240,.72) !important; border-radius:0 12px 12px 0; }
[data-admin-route="/admin/orders"] tbody td .font-semibold { color:#0f172a; }
[data-admin-route="/admin/orders"] tbody td .font-mono { color:#475569; }
[data-admin-route="/admin/orders"] tbody td:nth-child(4) { background:linear-gradient(90deg,rgba(248,250,252,.25),rgba(240,253,250,.42)) !important; }
[data-admin-route="/admin/orders"] tbody td:last-child a { border-radius:10px !important; border-color:rgba(14,116,144,.16) !important; background:linear-gradient(135deg,#eff6ff,#ecfeff) !important; color:#0369a1 !important; box-shadow:0 4px 12px rgba(14,116,144,.08); }
[data-admin-route="/admin/orders"] tbody td:last-child a:hover { background:linear-gradient(135deg,#e0f2fe,#cffafe) !important; }
[data-admin-route="/admin/orders"] tbody input[type="checkbox"] { width:16px; height:16px; accent-color:#0d9488; }
[data-admin-route="/admin/orders"] .rounded-full { transition:transform .2s ease; }
[data-admin-route="/admin/orders"] .rounded-full:hover { transform:scale(1.04); }
@media (max-width: 640px) {
  [data-admin-route="/admin/orders"] .order-extra-shell { margin-left:-3px; margin-right:-3px; }
  [data-admin-route="/admin/orders"] .order-extra-shell > div { gap:3px !important; padding:3px !important; border-radius:15px !important; }
  [data-admin-route="/admin/orders"] .order-extra-shell button { min-height:36px; min-width:98px; padding:6px 8px !important; font-size:10px !important; }
  [data-admin-route="/admin/orders"] > div:last-child { padding:10px !important; }
  [data-admin-route="/admin/orders"] > div:last-child > div > div.mb-3.relative { padding:4px; }
  [data-admin-route="/admin/orders"] > div:last-child > div > div.mb-3.relative input { height:44px; font-size:12px; }
  [data-admin-route="/admin/orders"] > div:last-child > div > div.flex.gap-2.mb-3.overflow-x-auto { margin-top:8px; }
  [data-admin-route="/admin/orders"] > div:last-child > div > div.flex.gap-2.mb-3.overflow-x-auto > button { min-height:36px; padding-left:12px; padding-right:12px; }
  [data-admin-route="/admin/orders"] > div:last-child > div > div.bg-white.border.border-slate-200.rounded-xl.overflow-hidden.shadow-sm { border-radius:16px; }
  [data-admin-route="/admin/orders"] table { min-width:760px; }
}
`;

const adminHeaderAnnouncementCss = `
@keyframes admin-announcement-marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.admin-header-shell {
  background: linear-gradient(105deg,#052e2b 0%,#064e3b 38%,#0f766e 72%,#164e63 100%);
  border-bottom: 1px solid rgba(20,184,166,.35);
  box-shadow: 0 5px 22px rgba(6,78,59,.18);
}
.admin-header-title {
  color:#ffffff;
  text-shadow:0 1px 8px rgba(0,0,0,.18);
}
.admin-header-announcement {
  position:relative;
  min-width:0;
  overflow:hidden;
  border:1px solid rgba(255,255,255,.18);
  background:linear-gradient(90deg,rgba(255,255,255,.13),rgba(255,255,255,.07),rgba(255,255,255,.13));
  border-radius:12px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 4px 14px rgba(0,0,0,.10);
}
.admin-header-announcement::before {
  content:"";
  position:absolute;
  inset:0;
  z-index:2;
  pointer-events:none;
  background:linear-gradient(90deg,#064e3b 0%,transparent 7%,transparent 93%,#164e63 100%);
}
.admin-header-announcement-track {
  display:flex;
  width:max-content;
  min-width:200%;
  align-items:center;
  white-space:nowrap;
  animation:admin-announcement-marquee 34s linear infinite;
  will-change:transform;
}
.admin-header-announcement-text {
  display:inline-flex;
  align-items:center;
  padding:7px 34px 7px 18px;
  color:#f0fdfa;
  font-weight:800;
  letter-spacing:.01em;
  text-shadow:0 1px 5px rgba(0,0,0,.22);
}
.admin-header-announcement-dot {
  display:inline-block;
  width:7px;
  height:7px;
  margin-right:9px;
  border-radius:999px;
  background:#facc15;
  box-shadow:0 0 0 4px rgba(250,204,21,.14),0 0 12px rgba(250,204,21,.55);
  flex:none;
}
@media (prefers-reduced-motion: reduce) {
  .admin-header-announcement-track { animation:none; transform:none; }
}
`;

const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

export function AdminLayout({ children, headerExtra }: { children: React.ReactNode; headerExtra?: React.ReactNode }) {
  const { user, isStaff, isAdmin, isSuperAdmin, permissions, loading, initialized, role } = useAuth();
  const navigate = useNavigate(); const loc = useLocation();
  const [open, setOpen] = useState(false); const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { data: brandRow } = useQuery({
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
    staleTime: 5 * 60_000,
  });
  const brand = (brandRow?.settings as SiteSettings) ?? {};
  const brandLogo = brand.logo_url;
  const brandName = brand.site_name;
  const adminAnnouncement = (brand.admin_header_announcement || "আসসালামু আলাইকুম। গতকালের তুলনায় আজ আমাদের অর্ডারের সংখ্যা কিছুটা বেশি। তাই দয়া করে ধীরে, মনোযোগ দিয়ে অর্ডার কনফার্ম করুন। প্রয়োজনে একসাথে বেশি অর্ডার না নিয়ে কম সংখ্যক অর্ডার করে প্রতিটি কাস্টমারের সঙ্গে সুন্দরভাবে কথা বলে, বিস্তারিত বুঝিয়ে তারপর কনফার্ম করুন।").trim();
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch { /* localStorage may be unavailable */ }
  }, []);
  useEffect(() => {
    if (!mounted) return;
    try { window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* ignore storage errors */ }
  }, [collapsed, mounted]);
  useEffect(() => { if (!initialized) return; if (!user) navigate({ to: "/login" as any }); }, [user, initialized, navigate]);
  // Denied page → silently land on the first module the CEO granted (no error screen).
  const allowedNav = isSuperAdmin ? NAV : NAV.filter((n) => permissions[n.perm] === true);
  const pagePerm = requiredPermFor(loc.pathname);
  const pageAllowed = isSuperAdmin || (pagePerm !== null && permissions[pagePerm] === true);
  const firstAllowed = allowedNav[0]?.to;
  useEffect(() => {
    if (!initialized || !isStaff || pageAllowed || !firstAllowed) return;
    navigate({ to: firstAllowed as any, replace: true });
  }, [initialized, isStaff, pageAllowed, firstAllowed, navigate]);
  if (!mounted || (loading && !role)) return <div className="min-h-screen flex items-center justify-center">Please wait...</div>;
  if (!isStaff) return <div className="min-h-screen flex items-center justify-center bg-muted px-4"><div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm"><h1 className="text-xl font-bold text-brand-dark">Access Denied</h1><p className="mt-2 text-sm text-muted-foreground">You do not have permission to view this page.</p><button onClick={() => navigate({ to: "/" })} className="mt-5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-primary-foreground">Go Home</button></div></div>;
  const visibleNav = allowedNav;
  if (!pageAllowed) return <div className="min-h-screen flex items-center justify-center bg-muted px-4">{firstAllowed ? <div className="text-sm text-muted-foreground">এক মুহূর্ত…</div> : <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm"><h1 className="text-xl font-bold text-brand-dark">কোনো অনুমতি দেওয়া হয়নি</h1><p className="mt-2 text-sm text-muted-foreground">আপনার জন্য এখনো কোনো অংশের অনুমতি দেওয়া হয়নি। CEO-কে জানান।</p><button onClick={() => navigate({ to: "/" })} className="mt-5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-primary-foreground">হোমে যান</button></div>}</div>;
  const logout = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };
  return <div data-admin-route={loc.pathname} className="flex min-h-screen bg-muted">
    {<style>{adminHeaderAnnouncementCss}</style>}{loc.pathname === "/admin/orders" && <style>{orderUiCss}</style>}
    <aside className={`fixed lg:sticky lg:top-0 top-0 left-0 h-screen z-50 overflow-hidden bg-[#101827] border-r border-white/10 shadow-2xl shadow-slate-950/30 transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${collapsed ? "w-20" : "w-72"}`}>
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_5%,rgba(16,185,129,.22),transparent_32%),radial-gradient(circle_at_90%_18%,rgba(59,130,246,.20),transparent_30%),radial-gradient(circle_at_70%_78%,rgba(139,92,246,.18),transparent_34%),radial-gradient(circle_at_10%_95%,rgba(6,182,212,.14),transparent_28%)]" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(135deg,rgba(255,255,255,.055),transparent_28%,rgba(255,255,255,.015)_60%,rgba(255,255,255,.04))]" />
      <div className={`relative p-4 border-b border-white/10 flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
        <div className="relative shrink-0"><div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-500 blur opacity-60" />{brandLogo ? <SafeImage src={brandLogo} className="relative w-10 h-10 rounded-xl object-cover ring-1 ring-white/25" alt={brandName ?? ""} /> : <div className="relative w-10 h-10 rounded-xl bg-white/10 ring-1 ring-white/10 animate-pulse" />}</div>
        {!collapsed && <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300"><div className="font-extrabold text-white truncate tracking-tight">{brandName || ""}</div><div className="text-[10px] text-slate-400 truncate flex items-center gap-1"><Sparkles className="w-3 h-3 text-emerald-300" />{isAdmin ? "Admin Panel" : "Employee Panel"}</div></div>}
        <button onClick={() => setOpen(false)} className="lg:hidden ml-auto text-slate-300 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <nav className="relative p-3 overflow-y-auto h-[calc(100vh-150px)] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {!collapsed && <div className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-[.18em] font-bold text-slate-500 flex items-center gap-1.5"><Leaf className="w-3 h-3 text-emerald-400" /> Menu</div>}
        {visibleNav.map((n) => { const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to); return <Link key={n.to} to={n.to} preload="intent" onClick={() => setOpen(false)} className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm mb-1 transition-all duration-300 ${active ? "text-white bg-white/10 shadow-lg shadow-black/10" : "text-slate-300 hover:text-white hover:bg-white/7 hover:translate-x-1"}`}>
          <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${n.tone} text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-2 ${active ? "ring-2 ring-white/30" : ""}`}><n.icon className="w-[18px] h-[18px]" /></span>
          {!collapsed && <span className="truncate font-medium flex-1">{n.label}</span>}
          {!collapsed && <ChevronRight className={`w-4 h-4 text-slate-600 transition-all duration-300 group-hover:translate-x-1 group-hover:text-slate-300 ${active ? "text-white" : ""}`} />}
          {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-emerald-300 via-cyan-300 to-violet-400 shadow-[0_0_14px_rgba(45,212,191,.8)]" />}
        </Link>; })}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10 bg-slate-950/45 backdrop-blur-xl">
        <button onClick={logout} className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:text-red-200 hover:bg-red-500/10 transition-all duration-300"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400 group-hover:bg-red-500/25 group-hover:scale-105 transition-transform"><LogOut className="w-4 h-4" /></span>{!collapsed && <span>Logout</span>}</button>
      </div>
    </aside>
    <NewOrderNotifier /><AdminOrderStability />
    <div className="flex-1 min-w-0 transition-all duration-500">
      <header className="admin-header-shell sticky top-0 z-30 px-4 py-2.5 flex items-center gap-3 flex-nowrap shadow-sm">
        <button onClick={() => setOpen(true)} className="lg:hidden w-9 h-9 rounded-xl border bg-white hover:bg-slate-50 flex items-center justify-center transition-transform active:scale-95"><Menu className="w-5 h-5" /></button>
        <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex items-center justify-center w-9 h-9 rounded-xl border bg-slate-50 hover:bg-slate-100 transition-all duration-300 hover:scale-105" title={collapsed ? "Open Sidebar" : "Close Sidebar"}>{collapsed ? <PanelLeftOpen className="w-5 h-5 text-gray-600" /> : <PanelLeftClose className="w-5 h-5 text-gray-600" />}</button>
        <div className="admin-header-title font-extrabold whitespace-nowrap shrink-0 text-sm sm:text-base">{isAdmin ? "Admin Panel" : "Employee Panel"}</div>
        <div className="admin-header-announcement flex-1 min-w-0" title={adminAnnouncement}><div className="admin-header-announcement-track"><span className="admin-header-announcement-text"><i className="admin-header-announcement-dot" />{adminAnnouncement}</span><span className="admin-header-announcement-text" aria-hidden="true"><i className="admin-header-announcement-dot" />{adminAnnouncement}</span></div></div>
        <div className="ml-auto text-sm text-white/95 font-semibold hidden sm:block truncate max-w-[200px] shrink-0">{user?.email ?? ""}</div>
        {headerExtra && <div className={`w-full basis-full flex items-center gap-2 overflow-x-auto pt-2 ${loc.pathname === "/admin/orders" ? "order-extra-shell" : ""}`}>{headerExtra}</div>}
      </header>
      <div className="p-4 lg:p-6">{children}{loc.pathname === "/admin/all-api" && <div className="mt-6"><PresswayyCard /></div>}</div>
    </div>
  </div>;
}
