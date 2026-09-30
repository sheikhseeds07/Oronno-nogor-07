import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/lib/auth";
import { PremiumDashboard } from "@/components/admin/PremiumDashboard";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    links: [{ rel: "manifest", href: "/admin.webmanifest" }],
  }),
  component: DashboardGate,
});

function DashboardGate() {
  return <DashboardOrRedirect />;
}

function DashboardOrRedirect() {
  const { user, isAdmin: isAdminRole, permissions, loading } = useAuth();
  const isAdmin = isAdminRole || permissions.dashboard;
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      navigate({ to: "/admin/employees/$userId", params: { userId: user.id }, replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  // Keep the auth bootstrap state separate from the redirect state.
  // This prevents the "রিডিরেক্ট হচ্ছে..." message from flashing on every refresh
  // before the current user's permissions have finished loading.
  if (loading) {
    return <AdminLayout><div className="p-8" aria-hidden="true" /></AdminLayout>;
  }

  if (user && !isAdmin) {
    return <AdminLayout><div className="p-8 text-center text-muted-foreground">রিডিরেক্ট হচ্ছে...</div></AdminLayout>;
  }

  return <PremiumDashboard />;
}
