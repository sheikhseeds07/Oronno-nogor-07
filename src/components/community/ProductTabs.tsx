import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCustomer, db } from "@/lib/customer-account";
import { Star, MessageCircle, FileText, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

type Review = {
  id: string;
  author_name: string;
  rating: number;
  body: string | null;
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

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}
        />
      ))}
    </span>
  );
}

function timeBn(iso: string) {
  return new Date(iso).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
}

export function ProductTabs({ productId, description }: { productId: string; description?: string | null }) {
  const [tab, setTab] = useState<"desc" | "reviews" | "qa">("desc");
  const { isLoggedIn, displayName, user } = useCustomer();
  const qc = useQueryClient();

  const reviewsQ = useQuery({
    queryKey: ["product-reviews", productId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await db
        .from("product_reviews")
        .select("id, author_name, rating, body, verified_purchase, created_at")
        .eq("product_id", productId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Review[];
    },
  });

  const questionsQ = useQuery({
    queryKey: ["product-questions", productId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await db
        .from("product_questions")
        .select("id, author_name, question, answer, created_at")
        .eq("product_id", productId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Question[];
    },
  });

  const reviews = reviewsQ.data ?? [];
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  const submitReview = async () => {
    if (!user) return;
    if (!body.trim()) return toast.error("আপনার মতামত লিখুন");
    setBusy(true);
    const { error } = await db.from("product_reviews").insert({
      product_id: productId,
      user_id: user.id,
      author_name: displayName,
      rating,
      body: body.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody("");
    setRating(5);
    toast.success("রিভিউ যুক্ত হয়েছে, ধন্যবাদ!");
    qc.invalidateQueries({ queryKey: ["product-reviews", productId] });
  };

  const submitQuestion = async () => {
    if (!user) return;
    if (!question.trim()) return toast.error("প্রশ্ন লিখুন");
    setBusy(true);
    const { error } = await db.from("product_questions").insert({
      product_id: productId,
      user_id: user.id,
      author_name: displayName,
      question: question.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setQuestion("");
    toast.success("প্রশ্ন পাঠানো হয়েছে");
    qc.invalidateQueries({ queryKey: ["product-questions", productId] });
  };

  const loginCta = (
    <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
      লিখতে হলে{" "}
      <Link to="/customer-login" className="text-brand-dark font-semibold underline">
        লগইন করুন
      </Link>
    </div>
  );

  const tabs = [
    { id: "desc" as const, label: "বিবরণ", icon: FileText },
    { id: "reviews" as const, label: `রিভিউ (${reviews.length})`, icon: Star },
    { id: "qa" as const, label: `প্রশ্ন (${questionsQ.data?.length ?? 0})`, icon: MessageCircle },
  ];

  return (
    <div className="mt-10">
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
              tab === t.id ? "text-brand-dark" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            <span
              className={`absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-brand transition-transform duration-300 origin-left ${
                tab === t.id ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="pt-5 animate-in fade-in duration-300" key={tab}>
        {tab === "desc" && (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-muted-foreground">
            {description || "এই পণ্যের বিস্তারিত বিবরণ শীঘ্রই যুক্ত করা হবে।"}
          </div>
        )}

        {tab === "reviews" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-2xl bg-brand-light/60 p-4">
              <div className="text-center">
                <div className="text-3xl font-extrabold text-brand-dark">{avg ? avg.toFixed(1) : "—"}</div>
                <Stars value={Math.round(avg)} />
              </div>
              <div className="text-sm text-muted-foreground">
                মোট {reviews.length} টি রিভিউ
                <div className="text-xs">ক্রেতাদের সরাসরি মতামত</div>
              </div>
            </div>

            {isLoggedIn ? (
              <div className="rounded-2xl border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">আপনার রেটিং:</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRating(n)} className="transition hover:scale-110">
                      <Star className={`w-6 h-6 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="পণ্যটি কেমন লেগেছে লিখুন..."
                  className="w-full border rounded-xl p-3 outline-none focus:border-brand transition"
                />
                <button
                  onClick={submitReview}
                  disabled={busy}
                  className="bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition active:scale-95 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} রিভিউ দিন
                </button>
              </div>
            ) : (
              loginCta
            )}

            {reviewsQ.isLoading ? (
              <div className="py-6 text-center text-muted-foreground">লোড হচ্ছে...</div>
            ) : reviews.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">এখনো কোনো রিভিউ নেই — আপনিই প্রথম হন!</div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r, i) => (
                  <div
                    key={r.id}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    className="rounded-2xl border p-4 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{r.author_name}</div>
                      <span className="text-xs text-muted-foreground">{timeBn(r.created_at)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Stars value={r.rating} />
                      {r.verified_purchase && (
                        <span className="text-[10px] bg-brand-light text-brand-dark font-bold px-2 py-0.5 rounded-full">
                          ভেরিফাইড ক্রেতা
                        </span>
                      )}
                    </div>
                    {r.body && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{r.body}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "qa" && (
          <div className="space-y-4">
            {isLoggedIn ? (
              <div className="rounded-2xl border p-4 space-y-3">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={2}
                  placeholder="পণ্য সম্পর্কে প্রশ্ন করুন..."
                  className="w-full border rounded-xl p-3 outline-none focus:border-brand transition"
                />
                <button
                  onClick={submitQuestion}
                  disabled={busy}
                  className="bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition active:scale-95 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} প্রশ্ন পাঠান
                </button>
              </div>
            ) : (
              loginCta
            )}

            {(questionsQ.data ?? []).length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">এখনো কোনো প্রশ্ন নেই।</div>
            ) : (
              <div className="space-y-3">
                {(questionsQ.data ?? []).map((q, i) => (
                  <div
                    key={q.id}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    className="rounded-2xl border p-4 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{q.author_name}</div>
                      <span className="text-xs text-muted-foreground">{timeBn(q.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm">{q.question}</p>
                    {q.answer && (
                      <div className="mt-2 rounded-xl bg-brand-light/60 p-3 text-sm">
                        <span className="font-bold text-brand-dark">উত্তর: </span>
                        {q.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
