import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCustomer, db } from "@/lib/customer-account";
import { supabase } from "@/lib/personal-supabase/client";
import { Star, MessageCircle, FileText, Loader2, Send, ImagePlus, X, Camera, CheckCircle2, ZoomIn } from "lucide-react";
import { toast } from "sonner";

type Review = {
  id: string;
  author_name: string;
  rating: number;
  body: string | null;
  image_urls: string[] | null;
  verified_purchase: boolean;
  created_at: string;
};

type Question = {
  id: string;
  author_name: string;
  question: string;
  answer: string | null;
  created_at: string;
};

function Stars({ value, size = 14, interactive = false, onPick }: { value: number; size?: number; interactive?: boolean; onPick?: (n: number) => void }) {
  return <span className="inline-flex items-center gap-0.5">{[1, 2, 3, 4, 5].map((n) => interactive ? (
    <button key={n} type="button" onClick={() => onPick?.(n)} className="transition-transform hover:scale-125 active:scale-95" aria-label={`${n} star`}>
      <Star style={{ width: size, height: size }} className={n <= value ? "fill-amber-400 text-amber-400 drop-shadow-sm" : "text-muted-foreground/30"} />
    </button>
  ) : <Star key={n} style={{ width: size, height: size }} className={n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"} />)}</span>;
}

function timeBn(iso: string) {
  return new Date(iso).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
}

export function ProductTabs({ productId, description }: { productId: string; description?: string | null }) {
  const [tab, setTab] = useState<"desc" | "reviews" | "qa">("desc");
  const { isLoggedIn, displayName, user } = useCustomer();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  const reviewsQ = useQuery({
    queryKey: ["product-reviews", productId], staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("product_reviews")
        .select("id, author_name, rating, body, image_urls, verified_purchase, created_at")
        .eq("product_id", productId).eq("status", "approved").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });

  const questionsQ = useQuery({
    queryKey: ["product-questions", productId], staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("product_questions")
        .select("id, author_name, question, answer, created_at")
        .eq("product_id", productId).eq("status", "approved").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as Question[];
    },
  });

  const reviews = reviewsQ.data ?? [];
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const chooseImages = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const oversized = incoming.find((f) => f.size > 5 * 1024 * 1024);
    if (oversized) return toast.error("প্রতিটি ছবি সর্বোচ্চ ৫MB হতে হবে");
    setReviewFiles((prev) => [...prev, ...incoming].slice(0, 6));
    if (incoming.length + reviewFiles.length > 6) toast.info("সর্বোচ্চ ৬টি ছবি যোগ করা যাবে");
  };

  const removeImage = (index: number) => setReviewFiles((prev) => prev.filter((_, i) => i !== index));

  const submitReview = async () => {
    if (!user) return;
    if (!body.trim() && reviewFiles.length === 0) return toast.error("রিভিউ লিখুন অথবা ছবি যোগ করুন");
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const [index, file] of reviewFiles.entries()) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${productId}/${crypto.randomUUID()}-${index}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("review-images").upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("review-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      const { error } = await db.from("product_reviews").insert({ product_id: productId, user_id: user.id, author_name: displayName, rating, body: body.trim() || null, image_urls: urls });
      if (error) throw error;
      setBody(""); setRating(5); setReviewFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("রিভিউ পাঠানো হয়েছে — ধন্যবাদ! 🌱");
      qc.invalidateQueries({ queryKey: ["product-reviews", productId] });
    } catch (error: any) {
      toast.error(error?.message || "রিভিউ পাঠানো যায়নি");
    } finally { setBusy(false); }
  };

  const submitQuestion = async () => {
    if (!user) return;
    if (!question.trim()) return toast.error("প্রশ্ন লিখুন");
    setBusy(true);
    const { error } = await db.from("product_questions").insert({ product_id: productId, user_id: user.id, author_name: displayName, question: question.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setQuestion(""); toast.success("প্রশ্ন পাঠানো হয়েছে"); qc.invalidateQueries({ queryKey: ["product-questions", productId] });
  };

  const loginCta = <div className="rounded-2xl border border-dashed bg-muted/20 p-5 text-center text-sm text-muted-foreground shadow-sm">রিভিউ দিতে <Link to="/customer-login" className="font-bold text-brand-dark underline underline-offset-4">লগইন করুন</Link></div>;
  const tabs = [
    { id: "desc" as const, label: "বিবরণ", icon: FileText },
    { id: "reviews" as const, label: `রিভিউ (${reviews.length})`, icon: Star },
    { id: "qa" as const, label: `প্রশ্ন (${questionsQ.data?.length ?? 0})`, icon: MessageCircle },
  ];

  return <div className="mt-10">
    <div className="flex gap-1 overflow-x-auto border-b border-border/70 scrollbar-none">
      {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-bold transition-all ${tab === t.id ? "text-brand-dark" : "text-muted-foreground hover:text-foreground"}`}>
        <t.icon className="h-4 w-4" />{t.label}<span className={`absolute inset-x-2 -bottom-px h-0.5 origin-left rounded-full bg-brand transition-transform duration-300 ${tab === t.id ? "scale-x-100" : "scale-x-0"}`} />
      </button>)}
    </div>

    <div className="pt-5 animate-in fade-in duration-300" key={tab}>
      {tab === "desc" && <div className="prose prose-sm max-w-none whitespace-pre-wrap text-muted-foreground">{description || "এই পণ্যের বিস্তারিত বিবরণ শীঘ্রই যুক্ত করা হবে।"}</div>}

      {tab === "reviews" && <div className="space-y-5">
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-brand-light/80 via-background to-amber-50/60 p-5 shadow-sm">
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand/10 blur-2xl" />
          <div className="relative flex items-center gap-5">
            <div className="text-center"><div className="text-4xl font-black tracking-tight text-brand-dark">{avg ? avg.toFixed(1) : "—"}</div><Stars value={Math.round(avg)} size={17} /></div>
            <div><div className="font-extrabold">ক্রেতাদের রিভিউ</div><div className="mt-1 text-sm text-muted-foreground">{reviews.length}টি মতামত · বাস্তব ক্রেতাদের অভিজ্ঞতা</div></div>
          </div>
        </div>

        {isLoggedIn ? <div className="overflow-hidden rounded-3xl border bg-background p-5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex items-center justify-between"><div><div className="font-extrabold">আপনার অভিজ্ঞতা শেয়ার করুন</div><div className="text-xs text-muted-foreground">ছবি দিলে রিভিউ আরও বিশ্বাসযোগ্য হবে</div></div><div className="rounded-full bg-brand-light px-3 py-1 text-xs font-bold text-brand-dark">আপনার রিভিউ</div></div>
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-muted/30 p-3"><span className="text-sm font-bold">রেটিং</span><Stars value={rating} size={24} interactive onPick={setRating} /><span className="ml-auto text-sm font-extrabold text-amber-500">{rating}/5</span></div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="পণ্যটি কেমন লেগেছে? আপনার অভিজ্ঞতা লিখুন..." className="w-full resize-none rounded-2xl border bg-background p-4 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10" />
          <div className="mt-3 rounded-2xl border border-dashed bg-muted/10 p-3">
            <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-bold"><Camera className="h-4 w-4 text-brand" /> ছবি যোগ করুন <span className="text-xs font-normal text-muted-foreground">(সর্বোচ্চ ৬টি)</span></div><button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl bg-brand-light px-3 py-2 text-xs font-extrabold text-brand-dark transition hover:scale-105 active:scale-95"><ImagePlus className="mr-1 inline h-4 w-4" /> ছবি বাছাই</button></div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => chooseImages(e.target.files)} />
            {reviewFiles.length > 0 ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{reviewFiles.map((file, i) => <div key={`${file.name}-${i}`} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted animate-in zoom-in-75 duration-200"><img src={URL.createObjectURL(file)} alt="preview" className="h-full w-full object-cover" /><button type="button" onClick={() => removeImage(i)} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-100 transition hover:bg-red-500"><X className="h-3.5 w-3.5" /></button></div>)}</div> : <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 py-5 text-xs text-muted-foreground transition hover:text-brand-dark"><ImagePlus className="h-5 w-5" /> আপনার বাগান/পণ্যের ছবি যোগ করুন</button>}
          </div>
          <button onClick={submitReview} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3.5 font-extrabold text-white shadow-lg shadow-brand/20 transition-all hover:-translate-y-0.5 hover:bg-brand-dark active:translate-y-0 disabled:opacity-60">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} রিভিউ প্রকাশের জন্য পাঠান</button>
        </div> : loginCta}

        {reviewsQ.isLoading ? <div className="py-8 text-center text-muted-foreground">রিভিউ লোড হচ্ছে...</div> : reviews.length === 0 ? <div className="rounded-3xl border border-dashed py-10 text-center text-muted-foreground">এখনো কোনো রিভিউ নেই — আপনিই প্রথম হন! 🌱</div> : <div className="space-y-3">
          {reviews.map((r, i) => <article key={r.id} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }} className="rounded-3xl border bg-background p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 font-extrabold"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-light text-sm font-black text-brand-dark">{r.author_name?.trim()?.charAt(0) || "ক"}</div><span className="truncate">{r.author_name}</span></div><div className="mt-2 flex flex-wrap items-center gap-2"><Stars value={r.rating} />{r.verified_purchase && <span className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-extrabold text-brand-dark"><CheckCircle2 className="h-3 w-3" /> ভেরিফাইড ক্রেতা</span>}</div></div><span className="shrink-0 text-[11px] text-muted-foreground">{timeBn(r.created_at)}</span></div>
            {r.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{r.body}</p>}
            {(r.image_urls ?? []).length > 0 && <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">{(r.image_urls ?? []).map((url, idx) => <button key={`${url}-${idx}`} type="button" onClick={() => setLightbox(url)} className="group relative aspect-square overflow-hidden rounded-2xl border bg-muted"><img src={url} alt="রিভিউ ছবি" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute inset-0 grid place-items-center bg-black/0 text-white transition group-hover:bg-black/20"><ZoomIn className="h-5 w-5 opacity-0 drop-shadow-lg transition group-hover:opacity-100" /></span></button>)}</div>}
          </article>)}
        </div>}
      </div>}

      {tab === "qa" && <div className="space-y-4">{isLoggedIn ? <div className="rounded-3xl border p-5 shadow-sm"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} placeholder="পণ্য সম্পর্কে প্রশ্ন করুন..." className="w-full rounded-2xl border p-3 outline-none focus:border-brand" /><button onClick={submitQuestion} disabled={busy} className="mt-3 flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 font-bold text-white transition hover:bg-brand-dark disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} প্রশ্ন পাঠান</button></div> : loginCta}{(questionsQ.data ?? []).length === 0 ? <div className="py-8 text-center text-muted-foreground">এখনো কোনো প্রশ্ন নেই।</div> : <div className="space-y-3">{(questionsQ.data ?? []).map((q, i) => <div key={q.id} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }} className="rounded-3xl border p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"><div className="flex items-center justify-between"><div className="font-bold">{q.author_name}</div><span className="text-xs text-muted-foreground">{timeBn(q.created_at)}</span></div><p className="mt-2 text-sm">{q.question}</p>{q.answer && <div className="mt-3 rounded-2xl bg-brand-light/60 p-3 text-sm"><span className="font-bold text-brand-dark">উত্তর: </span>{q.answer}</div>}</div>)}</div>}</div>}
    </div>

    {lightbox && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setLightbox(null)}><button type="button" aria-label="close" onClick={() => setLightbox(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"><X className="h-6 w-6" /></button><img src={lightbox} alt="রিভিউ" className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-2xl animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()} /></div>}
  </div>;
}
