import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, type Permissions } from "@/lib/auth";
import { supabase } from "@/lib/personal-supabase/client";
import logo from "@/assets/logo.jpg";
import {
  LayoutDashboard, Package, ShoppingBag, Users, FolderTree, Image as ImageIcon,
  Tag, Settings, Globe, UserCog, LogOut, Menu, X, Layers, Clock, FileSpreadsheet,
} from "lucide-react";
import { NewOrderNotifier } from "@/components/admin/NewOrderNotifier";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  perm?: keyof Permissions | "always";
};

const NAV: NavItem[] = [
  { to: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true, perm: "always" },
  { to: "/admin/orders", label: "অর্ডার", icon: ShoppingBag, perm: "orders" },
  { to: "/admin/order-import", label: "ফাইল থেকে অর্ডার", icon: FileSpreadsheet, perm: "orders" },
  { to: "/admin/products", label: "প্রোডাক্ট", icon: Package, perm: "products" },
  { to: "/admin/categories", label: "ক্যাটাগরি", icon: FolderTree, perm: "categories" },
  { to: "/admin/customers", label: "কাস্টমার", icon: Users, perm: "customers" },
  { to: "/admin/banners", label: "ব্যানার", icon: ImageIcon, perm: "marketing" },
  { to: "/admin/coupons", label: "কুপন", icon: Tag, perm: "marketing" },
  { to: "/admin/landing-pages", label: "ল্যান্ডিং পেজ", icon: Globe, perm: "landing_pages" },
  { to: "/admin/employees", label: "এমপ্লয়ি", icon: UserCog, perm: "hrm" },
  { to: "/admin/attendance", label: "হাজিরা", icon: Clock, perm: "hrm" },
  { to: "/admin/all-api", label: "All API", icon: Layers, perm: "all_api" },
  { to: "/admin/settings", label: "সেটিংস", icon: Settings, perm: "settings" },
];

export function AdminLayout({ children, headerExtra }: { children: React.ReactNode; headerExtra?: React.ReactNode }) {
  const { user, isStaff, isAdmin, permissions, loading, initialized, role } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!initialized) return;
    if (!user) navigate({ to: "/login" });
  }, [user, initialized, navigate]);

  // Avoid SSR/CSR hydration mismatch: render spinner on SSR + first client paint.
  if (!mounted || (loading && !role)) {
    return <div className="min-h-screen flex items-center justify-center">যাচাই করা হচ্ছে...</div>;
  }


  if (!isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-4">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-brand-dark">প্রবেশাধিকার নেই</h1>
          <p className="mt-2 text-sm text-muted-foreground">এই একাউন্টে স্টাফ রোল নেই।</p>
          <button onClick={() => navigate({ to: "/" })} className="mt-5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-primary-foreground">হোমে যান</button>
        </div>
      </div>
    );
  }

  // Filter nav by permissions (admin sees everything; employee never sees dashboard)
  const visibleNav = NAV.filter((n) => {
    if (isAdmin) return true;
    if (n.exact && n.to === "/admin") return false; // hide dashboard for employees
    if (n.perm === "always") return true;
    return n.perm ? permissions[n.perm] : false;
  });

  const myProfileTo = !isAdmin && user?.id ? `/admin/employees_/${user.id}` : null;

  const logout = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };

  return (
    <div className="flex min-h-screen bg-muted">
      <aside className={`fixed lg:sticky lg:top-0 top-0 left-0 h-screen w-64 bg-sidebar border-r z-50 transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-4 border-b flex items-center gap-2">
          <img src={logo} className="w-9 h-9 rounded-full" alt="" />
          <div>
            <div className="font-extrabold text-sidebar-foreground">অরন্য নগর</div>
            <div className="text-[10px] text-muted-foreground">{isAdmin ? "অ্যাডমিন প্যানেল" : "কর্মী প্যানেল"}</div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden ml-auto"><X className="w-5 h-5" /></button>
        </div>
        <nav className="p-2 overflow-y-auto h-[calc(100vh-140px)]">
          {myProfileTo && user?.id && (
            <Link
              to="/admin/employees/$userId"
              params={{ userId: user.id }}
              preload="intent"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 ${loc.pathname.startsWith(myProfileTo) ? "bg-brand text-white font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}
            >
              <Clock className="w-4 h-4" />
              হাজিরা
            </Link>
          )}
          {visibleNav.map((n) => {
            const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                preload="intent"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 ${active ? "bg-brand text-white font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}
              >
                <n.icon className="w-4 h-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t bg-sidebar">
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4" /> লগআউট
          </button>
        </div>
      </aside>

      <NewOrderNotifier />
      <div className="flex-1 lg:ml-0 min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => setOpen(true)} className="lg:hidden"><Menu className="w-6 h-6" /></button>
          <div className="font-bold whitespace-nowrap">{isAdmin ? "অ্যাডমিন" : "কর্মী"}</div>
          <div className="ml-auto text-sm text-muted-foreground hidden sm:block">{user?.email ?? ""}</div>
          {headerExtra && <div className="w-full basis-full flex items-center gap-2 overflow-x-auto">{headerExtra}</div>}
        </header>
        <div className="p-4 lg:p-6">{children}</div>
      </div>
    </div>
  );
}
