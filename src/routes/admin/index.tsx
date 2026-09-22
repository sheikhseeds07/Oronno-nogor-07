import { createFileRoute } from "@tanstack/react-router";
import { PremiumDashboard } from "@/components/admin/PremiumDashboard";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    links: [{ rel: "manifest", href: "/admin.webmanifest" }],
  }),
  component: PremiumDashboard,
});
