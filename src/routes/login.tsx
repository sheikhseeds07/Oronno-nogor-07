import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { MechanicalLogin } from "@/components/login/MechanicalLogin";

export const Route = createFileRoute("/login")({ component: Login, head: () => ({ meta: [{ title: "এডমিন লগইন — Sheikh Seeds" }, { name: "description", content: "Sheikh Seeds এডমিন ও কর্মীদের নিরাপদ প্রবেশ।" }, { property: "og:title", content: "এডমিন লগইন — Sheikh Seeds" }, { property: "og:description", content: "Sheikh Seeds এডমিন ও কর্মীদের নিরাপদ প্রবেশ।" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }) });

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const goAfterLogin = async (uid?: string) => {
    if (!uid) return navigate({ to: "/" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .in("role", ["super_admin", "admin", "employee"]);
    navigate({ to: roles && roles.length > 0 ? "/admin" : "/" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) throw error;
      toast.success("লগইন সফল");
      await goAfterLogin(data.user?.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "লগইন ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteLayout>
      <MechanicalLogin email={email} password={password} loading={loading} onEmailChange={setEmail} onPasswordChange={setPassword} onSubmit={submit} />
    </SiteLayout>
  );
}
