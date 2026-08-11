import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";

export const Route = createFileRoute("/login")({ component: Login });

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
      <div className="container mx-auto px-3 py-12 max-w-md">
        <div className="bg-white border rounded-2xl p-7 shadow-sm">
          <div className="flex flex-col items-center mb-5">
            <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mb-3">
              <LogIn className="w-6 h-6 text-brand" />
            </div>
            <h1 className="text-xl font-bold">লগইন করুন</h1>
            <p className="text-xs text-muted-foreground mt-1">এডমিন বা কর্মী একাউন্ট দিয়ে প্রবেশ করুন</p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">ইমেইল</label>
              <input
                required
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">পাসওয়ার্ড</label>
              <input
                required
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm"
                autoComplete="current-password"
              />
            </div>
            <button
              disabled={loading}
              className="w-full bg-brand text-white py-3 rounded-lg font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {loading ? "অপেক্ষা করুন..." : "লগইন করুন"}
            </button>
          </form>

          <Link to="/" className="block text-center text-sm text-muted-foreground mt-5">← হোমে ফিরে যান</Link>
        </div>
      </div>
    </SiteLayout>
  );
}
