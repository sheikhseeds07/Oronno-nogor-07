import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Pencil, Save, X, ShoppingBag, Star, MessageSquareWarning, Phone, ShieldCheck, ChevronRight, LogOut } from "lucide-react";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/personal-supabase/client";
import { uploadToBucket } from "@/lib/storage-upload";
import { taka } from "@/lib/format";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({ ssr: false, component: Profile, pendingMs: 0, pendingComponent: () => (<SiteLayout><ProfileSkeleton /></SiteLayout>), head: () => ({ meta: [{ title: "আমার প্রোফাইল — Sheikh Seeds" }, { name: "robots", content: "noindex, nofollow" }] }) });

const DEFAULT_COVER = "/customer-profile-cover.svg";
const DEFAULT_AVATAR = "/customer-profile-avatar.svg";
const statusBn: Record<string, string> = { pending: "অপেক্ষমাণ", confirmed: "কনফার্মড", processing: "প্রস্তুত হচ্ছে", shipped: "ডেলিভারিতে", delivered: "ডেলিভারি সম্পন্ন", cancelled: "বাতিল" };
const complaintStatus: Record<string, string> = { open: "খোলা", in_progress: "কাজ চলছে", resolved: "সমাধান হয়েছে", closed: "বন্ধ" };
type Tab = "orders" | "reviews" | "complaints";

function Profile() {
  const { user, loading, initialized } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("orders");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [complaintSaving, setComplaintSaving] = useState(false);

  useEffect(() => {
    if (initialized && !user) navigate({ to: "/customer-login", replace: true });
  }, [initialized, user, navigate]);

  const profileQ = useQuery({
    queryKey: ["customer-profile-edit", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("customer_profiles").select("id,phone,full_name,avatar_url,cover_url,bio").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const profile = profileQ.data;

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? "");
      setBio(profile.bio ?? "");
      setAvatar(profile.avatar_url ?? null);
      setCover(profile.cover_url ?? null);
    }
  }, [profile]);

  const ordersQ = useQuery({
    queryKey: ["my-orders-real", user?.id, profile?.phone],
    enabled: !!user && !!profile?.phone,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_customer_orders");
      if (error) throw error;
      return data ?? [];
    },
  });

  const reviewsQ = useQuery({
    queryKey: ["my-reviews-real", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("product_reviews").select("id,product_id,rating,body,verified_purchase,created_at").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const complaintsQ = useQuery({
    queryKey: ["my-complaints", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("customer_complaints").select("id,subject,message,status,admin_reply,created_at").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const uploadImage = async (file: File, kind: "avatar" | "cover") => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("শুধু ছবি আপলোড করুন");
    if (file.size > 5 * 1024 * 1024) return toast.error("ছবির সাইজ সর্বোচ্চ ৫MB হতে পারবে");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    try {
      const url = await uploadToBucket("customer-profiles", path, file, { upsert: true });
      if (kind === "avatar") setAvatar(url); else setCover(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ছবি আপলোড করা যায়নি");
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error("আপনার নাম লিখুন");
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("customer_profiles").upsert({ id: user.id, phone: profile?.phone ?? null, full_name: name.trim(), bio: bio.trim() || null, avatar_url: avatar, cover_url: cover, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["customer-profile-edit", user.id] });
      setEditing(false);
      toast.success("প্রোফাইল আপডেট হয়েছে");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "প্রোফাইল আপডেট করা যায়নি");
    } finally { setSaving(false); }
  };

  const submitComplaint = async () => {
    if (!user || !subject.trim() || !message.trim()) return toast.error("বিষয় ও বিস্তারিত লিখুন");
    setComplaintSaving(true);
    try {
      const { error } = await (supabase as any).from("customer_complaints").insert({ user_id: user.id, subject: subject.trim(), message: message.trim() });
      if (error) throw error;
      setSubject(""); setMessage("");
      await qc.invalidateQueries({ queryKey: ["my-complaints", user.id] });
      toast.success("অভিযোগ পাঠানো হয়েছে");
    } catch (e) { toast.error(e instanceof Error ? e.message : "অভিযোগ পাঠানো যায়নি"); }
    finally { setComplaintSaving(false); }
  };

  if (!initialized || loading || !user) return <SiteLayout><ProfileSkeleton /></SiteLayout>;

  const displayName = profile?.full_name || user.user_metadata?.full_name || "কাস্টমার";
  const orders = ordersQ.data ?? [];
  const reviews = reviewsQ.data ?? [];
  const complaints = complaintsQ.data ?? [];
  const tabs = [
    { id: "orders" as Tab, label: "অর্ডার", icon: ShoppingBag, count: orders.length },
    { id: "reviews" as Tab, label: "রিভিউ", icon: Star, count: reviews.length },
    { id: "complaints" as Tab, label: "অভিযোগ", icon: MessageSquareWarning, count: complaints.length },
  ];

  const logout = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };

  return (
    <SiteLayout>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--brand-light)/.35),_transparent_35%)] pb-24 pt-3 sm:pt-5">
        <div className="container mx-auto max-w-4xl px-2.5 sm:px-3">
          <section className="overflow-hidden rounded-[22px] border border-brand-light/70 bg-background shadow-[0_12px_40px_rgba(20,83,45,.10)] animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="relative h-[104px] overflow-hidden sm:h-[132px]">
              <img src={cover || DEFAULT_COVER} alt="Sheikh Seeds garden" className="h-full w-full object-cover transition-transform duration-1000 hover:scale-[1.02]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/5" />
              {editing && <button onClick={() => coverRef.current?.click()} className="absolute right-2.5 top-2.5 rounded-full border border-white/20 bg-black/55 px-2.5 py-1.5 text-[10px] font-bold text-white backdrop-blur-md"><ImagePlus className="mr-1 inline h-3.5 w-3.5" />কভার</button>}
              <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], "cover")} />
            </div>
            <div className="relative px-3.5 pb-3.5 sm:px-5 sm:pb-4">
              <div className="-mt-9 flex items-end justify-between gap-2 sm:-mt-11">
                <div className="relative">
                  <div className="h-[76px] w-[76px] overflow-hidden rounded-[24px] border-[4px] border-background bg-brand-light shadow-lg sm:h-24 sm:w-24"><img src={avatar || DEFAULT_AVATAR} alt={displayName} className="h-full w-full object-cover" /></div>
                  {editing && <button onClick={() => avatarRef.current?.click()} className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-brand text-white shadow-md"><Camera className="h-3.5 w-3.5" /></button>}
                  <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], "avatar")} />
                </div>
                <div className="flex gap-1.5">
                  {editing ? <><button onClick={() => setEditing(false)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold"><X className="mr-0.5 inline h-3.5 w-3.5" />বাতিল</button><button onClick={saveProfile} disabled={saving} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-md">{saving ? <Loader2 className="mr-0.5 inline h-3.5 w-3.5 animate-spin" /> : <Save className="mr-0.5 inline h-3.5 w-3.5" />}সেভ</button></> : <button onClick={() => setEditing(true)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold transition hover:-translate-y-0.5 hover:border-brand"><Pencil className="mr-0.5 inline h-3.5 w-3.5" />এডিট</button>}
                </div>
              </div>
              <div className="mt-2.5">
                {editing ? <div className="grid gap-2 sm:grid-cols-2"><input value={name} onChange={e => setName(e.target.value)} maxLength={80} className="rounded-lg border px-3 py-2.5 text-sm font-bold outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" placeholder="আপনার নাম" /><textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={300} rows={2} className="resize-none rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 sm:col-span-2" placeholder="নিজের সম্পর্কে ছোট করে লিখুন..." /></div> : <><div className="flex flex-wrap items-center gap-1.5"><h1 className="text-xl font-black tracking-tight sm:text-2xl">{displayName}</h1><span className="rounded-full bg-brand-light px-1.5 py-0.5 text-[9px] font-black text-brand-dark"><ShieldCheck className="mr-0.5 inline h-3 w-3" />CUSTOMER</span></div><p className="mt-0.5 max-w-2xl text-xs leading-5 text-muted-foreground">{profile?.bio || "বীজ, বাগান ও সুন্দর সবুজ জীবনের সাথে আপনার পথচলা 🌱"}</p>{profile?.phone && <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><Phone className="h-3 w-3 text-brand" />{profile.phone}</div>}</>}
              </div>
            </div>
          </section>

          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border bg-background p-1 shadow-sm">{tabs.map(t => { const Icon = t.icon; const active = tab === t.id; return <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-lg px-1 py-2 text-center text-[11px] font-black transition-all duration-300 sm:text-sm ${active ? "bg-gradient-to-br from-brand to-brand-dark text-white shadow-md" : "text-muted-foreground hover:bg-brand-light/50 hover:text-brand-dark"}`}><Icon className="mx-auto mb-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />{t.label}<span className={`ml-1 rounded-full px-1 py-0.5 text-[9px] ${active ? "bg-white/15" : "bg-muted"}`}>{t.count}</span></button>; })}</div>

          <section className="mt-2.5 overflow-hidden rounded-[18px] border bg-background shadow-sm animate-in fade-in duration-300">
            {tab === "orders" && (ordersQ.isLoading ? <div className="p-7"><BrandLoader /></div> : ordersQ.isError ? <div className="p-6 text-center"><p className="text-sm font-bold">অর্ডার লোড করা যায়নি</p><button onClick={() => ordersQ.refetch()} className="mt-2 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white">আবার চেষ্টা করুন</button></div> : orders.length ? <div className="divide-y">{orders.map((o: any) => <Link key={o.id} to="/order/$id" params={{ id: o.id }} className="group block p-3 transition hover:bg-brand-light/20 sm:p-4"><div className="flex items-center justify-between gap-2"><div><div className="text-sm font-black">অর্ডার #{String(o.invoice_no || o.id).slice(-8).toUpperCase()}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{format(new Date(o.created_at), "dd MMM yyyy, hh:mm a")}</div></div><div className="flex items-center gap-1.5"><span className="rounded-full bg-brand-light px-2 py-1 text-[10px] font-black text-brand-dark">{statusBn[o.status] || o.status}</span><ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" /></div></div><div className="mt-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">{o.customer_name || "আপনার অর্ডার"}</span><strong className="text-brand-dark">{taka(Number(o.total || 0))}</strong></div></Link>)}</div> : <div className="p-8 text-center text-sm text-muted-foreground">এই ফোন নম্বর দিয়ে এখনো কোনো অর্ডার পাওয়া যায়নি।</div>)}

            {tab === "reviews" && (reviewsQ.isLoading ? <div className="p-7"><BrandLoader /></div> : reviewsQ.isError ? <div className="p-6 text-center text-sm text-muted-foreground">রিভিউ লোড করা যায়নি।</div> : reviews.length ? <div className="divide-y">{reviews.map((r: any) => <div key={r.id} className="p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-1">{[1,2,3,4,5].map(n => <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"}`} />)}</div><span className="text-[10px] text-muted-foreground">{format(new Date(r.created_at), "dd MMM yyyy")}</span></div><p className="mt-2 text-sm leading-6">{r.body || "রিভিউ"}</p>{r.verified_purchase && <span className="mt-2 inline-block rounded-full bg-brand-light px-2 py-1 text-[9px] font-black text-brand-dark">✓ ভেরিফাইড পারচেজ</span>}</div>)}</div> : <div className="p-8 text-center text-sm text-muted-foreground">এই একাউন্ট থেকে এখনো কোনো রিভিউ পাওয়া যায়নি।</div>)}

            {tab === "complaints" && <div className="p-3 sm:p-4"><div className="rounded-2xl bg-brand-light/35 p-3"><div className="text-sm font-black">নতুন অভিযোগ</div><div className="mt-2 grid gap-2"><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="বিষয়" className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand" /><textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="আপনার সমস্যাটি বিস্তারিত লিখুন..." className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand" /><button onClick={submitComplaint} disabled={complaintSaving} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">{complaintSaving ? "পাঠানো হচ্ছে..." : "অভিযোগ পাঠান"}</button></div></div><div className="mt-3 divide-y">{complaints.map((c: any) => <div key={c.id} className="py-3"><div className="flex items-center justify-between gap-2"><div className="text-sm font-black">{c.subject}</div><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-bold">{complaintStatus[c.status] || c.status}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{c.message}</p>{c.admin_reply && <div className="mt-2 rounded-xl bg-brand-light/50 p-2.5 text-xs"><b>Sheikh Seeds:</b> {c.admin_reply}</div>}</div>)}{!complaints.length && <div className="py-6 text-center text-xs text-muted-foreground">এখনো কোনো অভিযোগ নেই।</div>}</div></div>}
          </section>

          <button onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border bg-background py-2.5 text-xs font-black text-muted-foreground transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" /> লগআউট</button>
        </div>
      </div>
    </SiteLayout>
  );
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--brand-light)/.35),_transparent_35%)] pb-24 pt-3 sm:pt-5">
      <div className="container mx-auto max-w-4xl px-2.5 sm:px-3">
        <section className="overflow-hidden rounded-[22px] border border-brand-light/70 bg-background shadow-[0_12px_40px_rgba(20,83,45,.10)]">
          <div className="h-[104px] w-full animate-pulse bg-brand-light/60 sm:h-[132px]" />
          <div className="px-3.5 pb-4 sm:px-5">
            <div className="-mt-9 h-[76px] w-[76px] animate-pulse rounded-[24px] border-[4px] border-background bg-muted sm:-mt-11 sm:h-24 sm:w-24" />
            <div className="mt-3 h-5 w-40 animate-pulse rounded-md bg-muted" />
            <div className="mt-2 h-3 w-64 animate-pulse rounded-md bg-muted/70" />
          </div>
        </section>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border bg-background p-1 shadow-sm">
          {[0, 1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/70" />)}
        </div>
        <section className="mt-2.5 space-y-2 rounded-[18px] border bg-background p-3 shadow-sm">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />)}
        </section>
      </div>
    </div>
  );
}
