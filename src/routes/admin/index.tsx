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

  if (loading || (user && !isAdmin)) {
    return <AdminLayout><div className="p-8 text-center text-muted-foreground">রিডিরেক্ট হচ্ছে...</div></AdminLayout>;
  }

  return <PremiumDashboard />;
}
