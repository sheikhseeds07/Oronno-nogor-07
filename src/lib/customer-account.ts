import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/personal-supabase/client";
import { useAuth } from "@/lib/auth";

export type CustomerProfile = {
  id: string;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  address: string | null;
  district: string | null;
  thana: string | null;
};

/** Logged-in customer profile (null for guests and for staff-only accounts). */
export function useCustomer() {
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["customer-profile", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("customer_profiles")
        .select("id, phone, full_name, avatar_url, address, district, thana")
        .eq("id", user!.id)
        .maybeSingle();
      return (data as CustomerProfile | null) ?? null;
    },
  });

  const displayName =
    data?.full_name?.trim() ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (data?.phone ? `কাস্টমার ${data.phone.slice(-4)}` : user?.email?.split("@")[0]) ||
    "কাস্টমার";

  return {
    user,
    profile: data ?? null,
    displayName,
    isLoggedIn: !!user,
    loading: loading || (!!user && isLoading),
  };
}

export async function customerSignOut() {
  await supabase.auth.signOut();
}

/** Untyped view of the client for community tables that are not in generated types yet. */
export const db = supabase as unknown as {
  from: (table: string) => any;
};
