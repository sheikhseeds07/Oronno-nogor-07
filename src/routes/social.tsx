import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { useCustomer, db } from "@/lib/customer-account";
import { Heart, MessageCircle, Send, Loader2, Sprout, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/social")({
  component: SocialPage,
  head: () => ({
    meta: [
      { title: "কমিউনিটি — বাগানিদের সোশ্যাল ফিড | Sheikh Seeds" },
      {
        name: "description",
        content: "ছাদ বাগানিদের কমিউনিটি — নিজের বাগানের গল্প শেয়ার করুন, অন্যদের পোস্টে লাইক ও কমেন্ট করুন।",
      },
      { property: "og:title", content: "কমিউনিটি — বাগানিদের সোশ্যাল ফিড | Sheikh Seeds" },
      {
        property: "og:description",
        content: "ছাদ বাগানিদের কমিউনিটি — নিজের বাগানের গল্প শেয়ার করুন, অন্যদের পোস্টে লাইক ও কমেন্ট করুন।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Post = {
  id: string;
  user_id: string | null;
  author_name: string;
  body: string;
  like_count: number;
  comment_count: number;
  created_at: string;
};

type Comment = { id: string; author_name: string; body: string; created_at: string };

function timeAgoBn(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "এইমাত্র";
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
  return new Date(iso).toLocaleDateString("bn-BD", { day: "numeric", month: "long" });
}

function SocialPage() {
  const { user, isLoggedIn, displayName } = useCustomer();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const postsQ = useQuery({
    queryKey: ["social-posts"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await db
        .from("social_posts")
        .select("id, user_id, author_name, body, like_count, comment_count, created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(40);
      return (data ?? []) as Post[];
    },
  });

  const likesQ = useQuery({
    queryKey: ["social-my-likes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await db.from("social_post_likes").select("post_id").eq("user_id", user!.id);
      return new Set((data ?? []).map((l) => l.post_id as string));
    },
  });

  const createPost = async () => {
    if (!user) return;
    if (!body.trim()) return toast.error("কিছু লিখুন");
    setBusy(true);
    const { error } = await db
      .from("social_posts")
      .insert({ user_id: user.id, author_name: displayName, body: body.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody("");
    toast.success("পোস্ট প্রকাশিত হয়েছে");
    qc.invalidateQueries({ queryKey: ["social-posts"] });
  };

  const toggleLike = async (post: Post) => {
    if (!user) return toast.error("লাইক করতে লগইন করুন");
    const liked = likesQ.data?.has(post.id);
    if (liked) {
      await db.from("social_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await db.from("social_post_likes").insert({ post_id: post.id, user_id: user.id });
    }
    qc.invalidateQueries({ queryKey: ["social-my-likes", user.id] });
    qc.invalidateQueries({ queryKey: ["social-posts"] });
  };

  const removePost = async (post: Post) => {
    if (!user || post.user_id !== user.id) return;
    await db.from("social_posts").delete().eq("id", post.id);
    qc.invalidateQueries({ queryKey: ["social-posts"] });
  };

  return (
    <SiteLayout>
      <div className="container mx-auto px-3 py-6 max-w-2xl">
        <div className="rounded-3xl bg-gradient-to-br from-brand to-brand-dark text-white p-6 mb-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center gap-2 text-white/85 text-sm">
            <Sprout className="w-4 h-4" /> বাগানিদের কমিউনিটি
          </div>
          <h1 className="text-2xl font-extrabold mt-1">আপনার বাগানের গল্প শেয়ার করুন</h1>
          <p className="text-white/80 text-sm mt-1">ছবি-বর্ণনা দিয়ে অভিজ্ঞতা জানান, অন্যদের থেকে শিখুন।</p>
        </div>

        {isLoggedIn ? (
          <div className="rounded-2xl border bg-white p-4 mb-5">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder={`${displayName}, আজ বাগানে কী হলো?`}
              className="w-full border rounded-xl p-3 outline-none focus:border-brand transition"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={createPost}
                disabled={busy}
                className="bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition active:scale-95 disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} পোস্ট করুন
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground mb-5">
            পোস্ট করতে{" "}
            <Link to="/customer-login" className="text-brand-dark font-semibold underline">
              লগইন করুন
            </Link>
          </div>
        )}

        {postsQ.isLoading ? (
          <div className="py-10 text-center text-muted-foreground">লোড হচ্ছে...</div>
        ) : (postsQ.data ?? []).length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">এখনো কোনো পোস্ট নেই — প্রথম পোস্টটি আপনার হোক!</div>
        ) : (
          <div className="space-y-4">
            {(postsQ.data ?? []).map((p, i) => (
              <PostCard
                key={p.id}
                post={p}
                index={i}
                liked={!!likesQ.data?.has(p.id)}
                mine={!!user && p.user_id === user.id}
                onLike={() => toggleLike(p)}
                onDelete={() => removePost(p)}
              />
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

function PostCard({
  post,
  index,
  liked,
  mine,
  onLike,
  onDelete,
}: {
  post: Post;
  index: number;
  liked: boolean;
  mine: boolean;
  onLike: () => void;
  onDelete: () => void;
}) {
  const { user, isLoggedIn, displayName } = useCustomer();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const commentsQ = useQuery({
    queryKey: ["social-comments", post.id],
    enabled: open,
    queryFn: async () => {
      const { data } = await db
        .from("social_post_comments")
        .select("id, author_name, body, created_at")
        .eq("post_id", post.id)
        .eq("status", "approved")
        .order("created_at", { ascending: true });
      return (data ?? []) as Comment[];
    },
  });

  const addComment = async () => {
    if (!user || !text.trim()) return;
    const { error } = await db
      .from("social_post_comments")
      .insert({ post_id: post.id, user_id: user.id, author_name: displayName, body: text.trim() });
    if (error) return toast.error(error.message);
    setText("");
    qc.invalidateQueries({ queryKey: ["social-comments", post.id] });
    qc.invalidateQueries({ queryKey: ["social-posts"] });
  };

  return (
    <article
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      className="rounded-2xl border bg-white p-4 animate-in fade-in slide-in-from-bottom-3 duration-400 fill-mode-both"
    >
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-light text-brand-dark font-bold flex items-center justify-center">
          {post.author_name.slice(0, 1)}
        </div>
        <div className="flex-1">
          <div className="font-semibold leading-tight">{post.author_name}</div>
          <div className="text-xs text-muted-foreground">{timeAgoBn(post.created_at)}</div>
        </div>
        {mine && (
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition" aria-label="মুছুন">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </header>

      <p className="mt-3 whitespace-pre-wrap text-[15px]">{post.body}</p>

      <div className="mt-3 flex items-center gap-5 border-t pt-2.5 text-sm">
        <button
          onClick={onLike}
          className={`flex items-center gap-1.5 font-semibold transition active:scale-90 ${
            liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"
          }`}
        >
          <Heart className={`w-4.5 h-4.5 ${liked ? "fill-rose-500" : ""}`} style={{ width: 18, height: 18 }} />
          {post.like_count}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 font-semibold text-muted-foreground hover:text-brand-dark transition"
        >
          <MessageCircle style={{ width: 18, height: 18 }} /> {post.comment_count}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
          {(commentsQ.data ?? []).map((c) => (
            <div key={c.id} className="rounded-xl bg-muted/50 px-3 py-2">
              <span className="font-semibold text-sm">{c.author_name}</span>
              <span className="text-xs text-muted-foreground ml-2">{timeAgoBn(c.created_at)}</span>
              <p className="text-sm mt-0.5">{c.body}</p>
            </div>
          ))}
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addComment()}
                placeholder="কমেন্ট লিখুন..."
                className="flex-1 border rounded-full px-4 py-2 text-sm outline-none focus:border-brand transition"
              />
              <button onClick={addComment} className="bg-brand text-white p-2.5 rounded-full transition active:scale-90">
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              কমেন্ট করতে{" "}
              <Link to="/customer-login" className="text-brand-dark font-semibold underline">
                লগইন করুন
              </Link>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
