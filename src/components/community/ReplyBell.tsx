import { useEffect, useMemo, useState } from "react";
import { Bell, X } from "lucide-react";
import { supabase } from "@/lib/personal-supabase/client";
import { useCustomer } from "@/lib/customer-account";
import { BrandBadge } from "./OfficialReply";

type Item = { id: string; kind: string; label: string; reply: string; at: string };
const SEEN_KEY = "sheikh-seeds-reply-seen-at";

const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) || "1970-01-01T00:00:00.000Z";
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
};

const ago = (s: string) => {
  const d = (Date.now() - new Date(s).getTime()) / 1000;
  return d < 60
    ? "এইমাত্র"
    : d < 3600
      ? `${Math.floor(d / 60)} মিনিট আগে`
      : d < 86400
        ? `${Math.floor(d / 3600)} ঘণ্টা আগে`
        : new Date(s).toLocaleDateString("bn-BD", { day: "numeric", month: "short" });
};

/** Header bell: red badge with the number of unseen official replies for this customer. */
export function ReplyBell() {
  const { user } = useCustomer();
  const [items, setItems] = useState<Item[]>([]);
  const [seenAt, setSeenAt] = useState(readSeen);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      return;
    }
    let alive = true;
    const load = async () => {
      const client = supabase as any;
      const [reviews, questions, comments] = await Promise.all([
        client
          .from("product_reviews")
          .select("id, admin_reply, replied_at")
          .eq("user_id", user.id)
          .not("admin_reply", "is", null)
          .order("replied_at", { ascending: false })
          .limit(20),
        client
          .from("product_questions")
          .select("id, answer, answered_at")
          .eq("user_id", user.id)
          .not("answer", "is", null)
          .order("answered_at", { ascending: false })
          .limit(20),
        client
          .from("social_post_comments")
          .select("id, admin_reply, replied_at")
          .eq("user_id", user.id)
          .not("admin_reply", "is", null)
          .order("replied_at", { ascending: false })
          .limit(20),
      ]);
      if (!alive) return;
      const merged: Item[] = [
        ...((reviews.data ?? []) as any[]).map((r) => ({
          id: `review-${r.id}`,
          kind: "review",
          label: "আপনার রিভিউতে উত্তর",
          reply: r.admin_reply as string,
          at: (r.replied_at as string) || "",
        })),
        ...((questions.data ?? []) as any[]).map((q) => ({
          id: `question-${q.id}`,
          kind: "question",
          label: "আপনার জিজ্ঞাসার উত্তর",
          reply: q.answer as string,
          at: (q.answered_at as string) || "",
        })),
        ...((comments.data ?? []) as any[]).map((c) => ({
          id: `comment-${c.id}`,
          kind: "comment",
          label: "আপনার কমেন্টে উত্তর",
          reply: c.admin_reply as string,
          at: (c.replied_at as string) || "",
        })),
      ]
        .filter((x) => x.reply?.trim())
        .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
        .slice(0, 30);
      setItems(merged);
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    const channel = (supabase as any)
      .channel(`reply-bell-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "product_reviews" }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "product_questions" }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "social_post_comments" }, () => void load())
      .subscribe();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      (supabase as any).removeChannel(channel);
    };
  }, [user?.id]);

  const unseen = useMemo(
    () => items.filter((x) => x.at && new Date(x.at).getTime() > new Date(seenAt).getTime()).length,
    [items, seenAt],
  );

  const openPanel = () => {
    setOpen(true);
    const now = new Date().toISOString();
    try {
      localStorage.setItem(SEEN_KEY, now);
    } catch {
      /* ignore */
    }
    setSeenAt(now);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label="নোটিফিকেশন"
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
      >
        <Bell className="h-5 w-5" />
        {unseen > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[16px] place-items-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white shadow ring-2 ring-background animate-in zoom-in duration-200">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/50 p-3 pt-14 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl border bg-background shadow-2xl animate-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="min-w-0">
                <b className="text-sm">নোটিফিকেশন</b>
                <p className="text-[9px] text-muted-foreground">আপনার রিভিউ, জিজ্ঞাসা ও কমেন্টের উত্তর</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-muted" aria-label="বন্ধ">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed py-8 text-center text-xs text-muted-foreground">
                  এখনো কোনো উত্তর আসেনি।
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-2xl border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <BrandBadge size={20} />
                      <span className="shrink-0 text-[9px] text-muted-foreground">{item.at ? ago(item.at) : ""}</span>
                    </div>
                    <div className="mt-1 text-[10px] font-extrabold text-brand-dark">{item.label}</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-5">{item.reply}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
