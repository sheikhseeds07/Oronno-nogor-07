import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, type Permissions } from "@/lib/auth";
import { supabase } from "@/lib/personal-supabase/client";
import logo from "@/assets/logo.jpg";
import {
  LayoutDashboard, Package, ShoppingBag, Users, FolderTree, Image as ImageIcon,
  Tag, Settings, Globe, UserCog, LogOut, Menu, X, Layers, Clock, FileSpreadsheet,
  PanelLeftClose, PanelLeftOpen, ChevronRight, Sparkles
} from "lucide-react";
import { NewOrderNotifier } from "@/components/admin/NewOrderNotifier";
import { AdminOrderStability } from "@/components/admin/AdminOrderStability";
import { PresswayyCard } from "@/components/admin/PresswayyCard";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean; perm?: keyof Permissions | "always"; tone: string };
const NAV: NavItem[] = [
  { to: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true, perm: "always", tone: "from-violet-500 to-indigo-500" },
  { to: "/admin/orders", label: "অর্ডার", icon: ShoppingBag, perm: "orders", tone: "from-blue-500 to-cyan-500" },
  { to: "/admin/order-import", label: "ফাইল আপলোড করে অর্ডার", icon: FileSpreadsheet, perm: "orders", tone: "from-emerald-500 to-teal-500" },
  { to: "/admin/products", label: "প্রোডাক্ট", icon: Package, perm: "products", tone: "from-orange-500 to-amber-500" },
  { to: "/admin/categories", label: "ক্যাটাগরি", icon: FolderTree, perm: "categories", tone: "from-fuchsia-500 to-pink-500" },
  { to: "/admin/customers", label: "কাস্টমার", icon: Users, perm: "customers", tone: "from-sky-500 to-blue-500" },
  { to: "/admin/banners", label: "ব্যানার", icon: ImageIcon, perm: "marketing", tone: "from-rose-500 to-red-500" },
  { to: "/admin/coupons", label: "কুপন", icon: Tag, perm: "marketing", tone: "from-yellow-500 to-orange-500" },
  { to: "/admin/landing-pages", label: "ল্যান্ডিং পেজ", icon: Globe, perm: "landing_pages", tone: "from-cyan-500 to-blue-600" },
  { to: "/admin/employees", label: "কর্মচারী", icon: UserCog, perm: "hrm", tone: "from-green-500 to-emerald-600" },
  { to: "/admin/attendance", label: "হাজিরা", icon: Clock, perm: "hrm", tone: "from-indigo-500 to-purple-600" },
  { to: "/admin/all-api", label: "All API", icon: Layers, perm: "all_api", tone: "from-purple-500 to-fuchsia-600" },
  { to: "/admin/settings", label: "সেটিংস", icon: Settings, perm: "settings", tone: "from-slate-500 to-gray-700" },
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
    <aside className={`fixed lg:sticky lg:top-0 top-0 left-0 h-screen z-50 overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 border-r border-white/10 shadow-2xl shadow-indigo-950/10 transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${collapsed ? "w-20" : "w-72"}`}>
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,.5),transparent_35%),radial-gradient(circle_at_90%_70%,rgba(6,182,212,.25),transparent_35%)]" />
      <div className={`relative p-4 border-b border-white/10 flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
        <div className="relative shrink-0"><div className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 blur opacity-70" /><img src={logo} className="relative w-10 h-10 rounded-xl object-cover ring-1 ring-white/20" alt="" /></div>
        {!collapsed && <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300"><div className="font-extrabold text-white truncate tracking-tight">অনন্য নগর</div><div className="text-[10px] text-slate-400 truncate flex items-center gap-1"><Sparkles className="w-3 h-3 text-violet-400" />{isAdmin ? "অ্যাডমিন প্যানেল" : "কর্মী প্যানেল"}</div></div>}
        <button onClick={() => setOpen(false)} className="lg:hidden ml-auto text-slate-300 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <nav className="relative p-3 overflow-y-auto h-[calc(100vh-150px)] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {!collapsed && <div className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-[.18em] font-bold text-slate-500">মেনু</div>}
        {myProfileTo && user?.id && <Link to={"/admin/employees/$userId" as any} params={{ userId: user.id } as any} preload="intent" onClick={() => setOpen(false)} className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm mb-1 transition-all duration-300 ${loc.pathname.startsWith(myProfileTo) ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-950/30" : "text-slate-300 hover:text-white hover:bg-white/8 hover:translate-x-1"}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg"><Clock className="w-4 h-4" /></span>{!collapsed && <span className="font-medium">হাজিরা</span>}</Link>}
        {visibleNav.map((n) => { const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to); return <Link key={n.to} to={n.to} preload="intent" onClick={() => setOpen(false)} className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm mb-1 transition-all duration-300 ${active ? "text-white bg-white/12 shadow-lg shadow-black/10" : "text-slate-300 hover:text-white hover:bg-white/7 hover:translate-x-1"}`}>
          <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${n.tone} text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-2 ${active ? "ring-2 ring-white/30" : ""}`}><n.icon className="w-[18px] h-[18px]" /></span>
          {!collapsed && <span className="truncate font-medium flex-1">{n.label}</span>}
          {!collapsed && <ChevronRight className={`w-4 h-4 text-slate-600 transition-all duration-300 group-hover:translate-x-1 group-hover:text-slate-300 ${active ? "text-white rotate-0" : ""}`} />}
          {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-cyan-300 to-violet-500 shadow-[0_0_12px_rgba(139,92,246,.8)]" />}
        </Link>; })}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <button onClick={logout} className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:text-red-200 hover:bg-red-500/10 transition-all duration-300"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400 group-hover:bg-red-500/25 group-hover:scale-105 transition-transform"><LogOut className="w-4 h-4" /></span>{!collapsed && <span>লগআউট</span>}</button>
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
