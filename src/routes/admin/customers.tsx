import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/customers")({ component: Customers });

function Customers() {
  const { data } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-4">কাস্টমার</h1>
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr><th className="text-left p-3">নাম</th><th className="text-left p-3">ফোন</th><th className="text-left p-3">ঠিকানা</th><th className="text-left p-3">যোগ দিয়েছেন</th></tr></thead>
            <tbody>
              {data?.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3 font-semibold">{c.full_name ?? "—"}</td>
                  <td className="p-3">{c.phone ?? "—"}</td>
                  <td className="p-3 text-xs">{c.address ?? "—"}</td>
                  <td className="p-3 text-xs">{format(new Date(c.created_at), "dd MMM yyyy")}</td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">কোনো কাস্টমার নেই</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
