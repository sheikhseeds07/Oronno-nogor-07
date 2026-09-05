import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/personal-supabase/client";
import { taka } from "@/lib/format";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({ component: Profile, head: () => ({ meta: [{ title: "আমার প্রোফাইল — Sheikh Seeds" }, { name: "robots", content: "noindex, nofollow" }] }) });

const statusBn: Record<string, string> = {
  pending: "অপেক্ষমাণ", confirmed: "কনফার্মড", processing: "প্রস্তুত হচ্ছে",
  shipped: "ডেলিভারিতে", delivered: "ডেলিভারি সম্পন্ন", cancelled: "বাতিল",
};

function Profile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["customer-profile-edit", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any).from("customer_profiles")
        .select("id, phone, full_name, avatar_url, cover_url, bio")
        .eq("id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? "");
      setBio(profile.bio ?? "");
      setAvatar(profile.avatar_url ?? null);
      setCover(profile.cover_url ?? null);
    }
  }, [profile]);

  const { data: orders } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("orders").select("*").eq("created_by", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const uploadImage = async (file: File, kind: "avatar" | "cover") => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("শুধু ছবি আপলোড করুন");
    if (file.size > 5 * 1024 * 1024) return toast.error("ছবির সাইজ সর্বোচ্চ ৫MB হতে পারবে");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("customer-profiles").upload(path, file, { upsert: true, contentType: file.type });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("customer-profiles").getPublicUrl(path);
    if (kind === "avatar") setAvatar(data.publicUrl); else setCover(data.publicUrl);
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error("আপনার নাম লিখুন");
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("customer_profiles").upsert({
        id: user.id, phone: profile?.phone ?? user.user_metadata?.phone ?? null,
        full_name: name.trim(), bio: bio.trim() || null,
        avatar_url: avatar, cover_url: cover, updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["customer-profile-edit", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["customer-profile", user.id] });
      setEditing(false);
      toast.success("প্রোফাইল আপডেট হয়েছে");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "প্রোফাইল আপডেট করা যায়নি");
    } finally { setSaving(false); }
  };

  const logout = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };

  if (loading || !user) return <SiteLayout><div className="container mx-auto px-3 py-12"><BrandLoader /></div></SiteLayout>;

  const displayName = profile?.full_name || user.user_metadata?.full_name || "কাস্টমার";

  return (
    <SiteLayout>
      <div className="container mx-auto px-3 py-6 max-w-3xl">
        <div className="bg-white border rounded-2xl overflow-hidden mb-5 shadow-sm">
          <div className="relative h-36 sm:h-44 bg-gradient-to-br from-brand/30 via-brand-light to-muted">
            {cover && <img src={cover} alt="কভার" className="w-full h-full object-cover" />}
            {editing && <button onClick={() => coverRef.current?.click()} className="absolute right-3 top-3 bg-black/60 text-white rounded-full px-3 py-2 text-xs font-bold flex items-center gap-1.5"><ImagePlus className="w-4 h-4" /> কভার বদলান</button>}
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "cover")} />
          </div>
          <div className="px-5 pb-5">
            <div className="flex items-end justify-between -mt-10 relative">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-white bg-brand-light overflow-hidden shadow-md flex items-center justify-center">
                  {avatar ? <img src={avatar} alt={displayName} className="w-full h-full object-cover" /> : <span className="text-2xl font-black text-brand-dark">{displayName.slice(0, 1)}</span>}
                </div>
                {editing && <button onClick={() => avatarRef.current?.click()} className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center border-2 border-white"><Camera className="w-3.5 h-3.5" /></button>}
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "avatar")} />
              </div>
              <div className="flex gap-2">
                {editing ? <><button onClick={() => setEditing(false)} className="border rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-1"><X className="w-4 h-4" /> বাতিল</button><button onClick={saveProfile} disabled={saving} className="bg-brand text-white rounded-xl px-3 py-2 text-sm font-bold flex items-center gap-1 disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} সেভ</button></> : <button onClick={() => setEditing(true)} className="border rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-1 hover:border-brand"><Pencil className="w-4 h-4" /> প্রোফাইল সাজান</button>}
              </div>
            </div>
            <div className="mt-3">
              {editing ? <div className="space-y-3"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="w-full border rounded-xl px-3 py-2.5 outline-none focus:border-brand font-semibold" placeholder="আপনার নাম" /><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} className="w-full border rounded-xl px-3 py-2.5 outline-none focus:border-brand resize-none" placeholder="নিজের সম্পর্কে ছোট করে লিখুন..." /></div> : <><h1 className="text-xl font-extrabold">{displayName}</h1><p className="text-sm text-muted-foreground mt-1">{profile?.bio || "আপনার প্রোফাইলটি নিজের মতো করে সাজান 🌱"}</p><p className="text-xs text-muted-foreground mt-2">{profile?.phone || ""}</p></>}
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5 mb-5 flex items-center justify-between">
          <div><div className="font-bold text-lg">আমার একাউন্ট</div><div className="text-sm text-muted-foreground">{user.email}</div></div>
          <button onClick={logout} className="text-destructive font-semibold text-sm">লগআউট</button>
        </div>
        <h2 className="text-xl font-bold mb-3">আমার অর্ডার</h2>
        {orders && orders.length > 0 ? <div className="space-y-3">{orders.map((o) => <Link key={o.id} to="/order/$id" params={{ id: o.id }} className="block bg-white border rounded-xl p-4 hover:border-brand"><div className="flex justify-between items-start"><div><div className="font-bold">#{o.id.slice(0, 8).toUpperCase()}</div><div className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd MMM yyyy, hh:mm a")}</div></div><span className="bg-brand-light text-brand-dark text-xs font-bold px-2 py-1 rounded">{statusBn[o.status] ?? o.status}</span></div><div className="mt-2 font-bold text-brand-dark">{taka(o.total)}</div></Link>)}</div> : <div className="text-center py-12 text-muted-foreground">কোনো অর্ডার নেই</div>}
      </div>
    </SiteLayout>
  );
}
