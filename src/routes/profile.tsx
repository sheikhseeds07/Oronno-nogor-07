import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/personal-supabase/client";
import { taka } from "@/lib/format";
import { format } from "date-fns";
import { useEffect } from "react";

export const Route = createFileRoute("/profile")({ component: Profile, head: () => ({ meta: [{ title: "আমার প্রোফাইল — Sheikh Seeds" }, { name: "robots", content: "noindex, nofollow" }] }) });

const statusBn: Record<string, string> = {
  pending: "অপেক্ষমাণ", confirmed: "কনফার্মড", processing: "প্রস্তুত হচ্ছে",
  shipped: "ডেলিভারিতে", delivered: "ডেলিভারি সম্পন্ন", cancelled: "বাতিল",
};

function Profile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const { data: orders } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("orders").select("*").eq("created_by", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (loading || !user) return <SiteLayout><div className="container mx-auto px-3 py-12"><BrandLoader /></div></SiteLayout>;

  return (
    <SiteLayout>
      <div className="container mx-auto px-3 py-6">
        <div className="bg-white border rounded-xl p-5 mb-5 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">আমার একাউন্ট</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
          <button onClick={logout} className="text-destructive font-semibold text-sm">লগআউট</button>
        </div>
        <h2 className="text-xl font-bold mb-3">আমার অর্ডার</h2>
        {orders && orders.length > 0 ? (
          <div className="space-y-3">
            {orders.map((o) => (
              <Link key={o.id} to="/order/$id" params={{ id: o.id }} className="block bg-white border rounded-xl p-4 hover:border-brand">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold">#{o.id.slice(0, 8).toUpperCase()}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd MMM yyyy, hh:mm a")}</div>
                  </div>
                  <span className="bg-brand-light text-brand-dark text-xs font-bold px-2 py-1 rounded">{statusBn[o.status] ?? o.status}</span>
                </div>
                <div className="mt-2 font-bold text-brand-dark">{taka(o.total)}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">কোনো অর্ডার নেই</div>
        )}
      </div>
    </SiteLayout>
  );
}
