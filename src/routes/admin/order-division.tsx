import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { OrderDistributionSettings } from "@/components/admin/OrderDistributionSettings";

export const Route = createFileRoute("/admin/order-division")({ component: OrderDivisionPage });
function OrderDivisionPage() {
  return <AdminLayout><div className="mx-auto max-w-5xl"><OrderDistributionSettings /></div></AdminLayout>;
}
