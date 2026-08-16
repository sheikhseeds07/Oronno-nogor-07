import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, type Permissions } from "@/lib/auth";
import { supabase } from "@/lib/personal-supabase/client";
import logo from "@/assets/logo.jpg";
import { LayoutDashboard, Package, ShoppingBag, Users, FolderTree, Image as ImageIcon, Tag, Settings, Globe, UserCog, LogOut, Menu, X, Layers, Clock, FileSpreadsheet, PanelLeftClose, PanelLeftOpen, ChevronRight, Sparkles, Leaf } from "lucide-react";
import { NewOrderNotifier } from "@/components/admin/NewOrderNotifier";
import { AdminOrderStability } from "@/components/admin/AdminOrderStability";
import { PresswayyCard } from "@/components/admin/PresswayyCard";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean; perm?: keyof Permissions | "always"; tone: string };
const NAV: NavItem[] = [
  { to: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true, perm: "always", tone: "from-lime-400 to-green-600" },
  { to: "/admin/orders", label: "অর্ডার", icon: ShoppingBag, perm: "orders", tone: "from-emerald-400 to-green-600" },
  { to: "/admin/order-import", label: "ফাইল আপলোড করে অর্ডার", icon: FileSpreadsheet, perm: "orders", tone: "from-teal-400 to-emerald-600" },
  { to: "/admin/products", label: "প্রোডাক্ট", icon: Package, perm: "products", tone: "from-amber-400 to-lime-600" },
  { to: "/admin/categories", label: "ক্যাটাগরি", icon: FolderTree, perm: "categories", tone: "from-green-400 to-teal-600" },
  { to: "/admin/customers", label: "কাস্টমার", icon: Users, perm: "customers", tone: "from-sky-400 to-emerald-600" },
  { to: "/admin/banners", label: "ব্যানার", icon: ImageIcon, perm: "marketing", tone: "from-yellow-400 to-green-600" },
  { to: "/admin/coupons", label: "কুপন", icon: Tag, perm: "marketing", tone: "from-lime-400 to-amber-600" },
  { to: "/admin/landing-pages", label: "ল্যান্ডিং পেজ", icon: Globe, perm: "landing_pages", tone: "from-emerald-400 to-cyan-600" },
  { to: "/admin/employees", label: "কর্মচারী", icon: UserCog, perm: "hrm", tone: "from-green-400 to-emerald-700" },
  { to: "/admin/attendance", label: "হাজিরা", icon: Clock, perm: "hrm", tone: "from-lime-400 to-green-700" },
  { to: "/admin/all-api", label: "All API", icon: Layers, perm: "all_api", tone: "from-teal-400 to-green-700" },
  { to: "/admin/settings", label: "সেটিংস", icon: Settings, perm: "settings", tone: "from-slate-300 to-emerald-600" },
];

export function AdminLayout({ children, headerExtra }: { children: React.ReactNode; headerExtra?: React.ReactNode }) {
  const { user, isStaff, isAdmin, permissions, loading, initialized, role } = useAuth();
  const navigate = useNavigate(); const loc = useLocation();
  const [open, setOpen] = useState(false); const [mounted, setMounted] = useState(false); const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!initialized) return; if (!user) navigate({ to: "/login" as any }); }, [user, initialized, navigate]);
  if (!mounted || (loading && !role)) return <div className="min-h-screen flex items-center justify-center">অপেক্ষা করুন...</div>;
  if (!isStaff) return <div className="min-h-screen flex items-center justify-center bg-muted px-4"><div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm"><h1 className="text-xl font-bold text-brand-dark">প্রবেশাধিকার নেই</h1><p className="mt-2 text-sm text-muted-foreground">এই পেজটি দেখার অনুমতি আপনার নেই।</p><button onClick={() => navigate({ to: "/" })} className="mt-5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-primary-foreground">হোমে যান</button></div></div>;
  const visibleNav = NAV.filter((n) => { if (isAdmin) return true; if (n.exact && n.to === "/admin") return false; if (n.perm === "always") return true; return n.perm ? permissions[n.perm] : false; });
  const myProfileTo = !isAdmin && user?.id ? `/admin/employees_/${user.id}` : null;
  const logout = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };
  return <div className="flex min-h-screen bg-muted">
    <aside className={`fixed lg:sticky lg:top-0 top-0 left-0 h-screen z-50 overflow-hidden bg-gradient-to-br from-[#173b24] via-[#24552f] to-[#102d1b] border-r border-lime-200/15 shadow-2xl shadow-green-950/30 transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${collapsed ? "w-20" : "w-72"}`}>
      <div className="absolute inset-0 pointer-events-none opacity-80 bg-[radial-gradient(ellipse_at_top_left,rgba(163,230,53,.20),transparent_40%),radial-gradient(ellipse_at_70%_35%,rgba(34,197,94,.16),transparent_38%),radial-gradient(ellipse_at_bottom_right,rgba(20,184,166,.15),transparent_42%)]" />
      <div className="absolute inset-x-0 top-0 h-44 pointer-events-none bg-gradient-to-b from-lime-100/[.06] via-green-400/[.03] to-transparent" />
      <div className={`relative p-4 border-b border-lime-100/10 flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
        <div className="relative shrink-0"><div className="absolute -inset-1 rounded-full bg-gradient-to-r from-lime-400 to-emerald-400 blur opacity-70" /><img src={logo} className="relative w-10 h-10 rounded-xl object-cover ring-1 ring-lime-100/25" alt="" /></div>
        {!collapsed && <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300"><div className="font-extrabold text-white truncate tracking-tight">অনন্য নগর</div><div className="text-[10px] text-lime-100/60 truncate flex items-center gap-1"><Leaf className="w-3 h-3 text-lime-300" />{isAdmin ? "অ্যাডমিন প্যানেল" : "কর্মী প্যানেল"}</div></div>}
        <button onClick={() => setOpen(false)} className="lg:hidden ml-auto text-lime-100/70 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <nav className="relative p-3 overflow-y-auto h-[calc(100vh-150px)] scrollbar-thin scrollbar-thumb-lime-100/10 scrollbar-track-transparent">
        {!collapsed && <div className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-[.18em] font-bold text-lime-100/40 flex items-center gap-1.5"><Leaf className="w-3 h-3" /> মেনু</div>}
        {myProfileTo && user?.id && <Link to={"/admin/employees/$userId" as any} params={{ userId: user.id } as any} preload="intent" onClick={() => setOpen(false)} className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm mb-1 transition-all duration-300 ${loc.pathname.startsWith(myProfileTo) ? "bg-gradient-to-r from-lime-500 to-emerald-600 text-white shadow-lg shadow-green-950/30" : "text-lime-50/75 hover:text-white hover:bg-lime-100/8 hover:translate-x-1"}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-lime-400 to-green-600 shadow-lg"><Clock className="w-4 h-4" /></span>{!collapsed && <span className="font-medium">হাজিরা</span>}</Link>}
        {visibleNav.map((n) => { const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to); return <Link key={n.to} to={n.to} preload="intent" onClick={() => setOpen(false)} className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm mb-1 transition-all duration-300 ${active ? "text-white bg-lime-100/12 shadow-lg shadow-green-950/15" : "text-lime-50/75 hover:text-white hover:bg-lime-100/8 hover:translate-x-1"}`}>
          <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${n.tone} text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-2 ${active ? "ring-2 ring-lime-100/35" : ""}`}><n.icon className="w-[18px] h-[18px]" /></span>
          {!collapsed && <span className="truncate font-medium flex-1">{n.label}</span>}
          {!collapsed && <ChevronRight className={`w-4 h-4 text-lime-100/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-lime-100/70 ${active ? "text-white" : ""}`} />}
          {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-lime-300 to-emerald-400 shadow-[0_0_14px_rgba(163,230,53,.8)]" />}
        </Link>; })}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-lime-100/10 bg-[#0b2515]/55 backdrop-blur-xl">
        <button onClick={logout} className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-lime-50/70 hover:text-red-100 hover:bg-red-500/10 transition-all duration-300"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-400/10 text-red-300 group-hover:bg-red-400/20 group-hover:scale-105 transition-transform"><LogOut className="w-4 h-4" /></span>{!collapsed && <span>লগআউট</span>}</button>
      </div>
    </aside>
    <NewOrderNotifier /><AdminOrderStability />
    <div className="flex-1 min-w-0 transition-all duration-500">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
        <button onClick={() => setOpen(true)} className="lg:hidden w-9 h-9 rounded-xl border bg-white hover:bg-slate-50 flex items-center justify-center transition-transform active:scale-95"><Menu className="w-5 h-5" /></button>
        <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex items-center justify-center w-9 h-9 rounded-xl border bg-slate-50 hover:bg-slate-100 transition-all duration-300 hover:scale-105" title={collapsed ? "সাইডবার খুলুন" : "সাইডবার বন্ধ করুন"}>{collapsed ? <PanelLeftOpen className="w-5 h-5 text-gray-600" /> : <PanelLeftClose className="w-5 h-5 text-gray-600" />}</button>
        <div className="font-bold whitespace-nowrap">{isAdmin ? "অ্যাডমিন প্যানেল" : "কর্মী প্যানেল"}</div>
        <div className="ml-auto text-sm text-muted-foreground hidden sm:block truncate max-w-[200px]">{user?.email ?? ""}</div>
        {headerExtra && <div className="w-full basis-full flex items-center gap-2 overflow-x-auto pt-2">{headerExtra}</div>}
      </header>
      <div className="p-4 lg:p-6">{children}{loc.pathname === "/admin/all-api" && <div className="mt-6"><PresswayyCard /></div>}</div>
    </div>
  </div>;
}
