import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { OrderRateLimitSettings } from "@/components/admin/OrderRateLimitSettings";

export const Route = createFileRoute("/admin/order-rate-limit")({ component: OrderRateLimitPage });

function OrderRateLimitPage() {
  return (
    <AdminLayout>
      <h1 className="mb-1 text-2xl font-bold">অর্ডার সিকিউরিটি</h1>
      <p className="mb-5 text-sm text-muted-foreground">রিপিট অর্ডার নিয়ন্ত্রণ ও অর্ডার রেট-লিমিট</p>
      <OrderRateLimitSettings />
    </AdminLayout>
  );
}
