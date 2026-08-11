import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import {
  Bot,
  BotOff,
  MessageSquare,
  Send,
  User,
  MessagesSquare,
  RefreshCw,
  LayoutDashboard,
  GraduationCap,
  ShoppingBag,
  LifeBuoy,
  Plug,
  Loader2,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Search,
  Mic,
  MicOff,
  ImagePlus,
  CheckSquare,
} from "lucide-react";
import {
  listFbConversations,
  listFbMessages,
  sendFbReply,
  updateFbConversation,
  enableAiEverywhere,
  deleteFbMessages,
  listFbComments,
  replyFbComment,
} from "@/lib/fb-inbox.functions";

import {
  getFbConnection,
  saveFbApp,
  getFbLoginUrl,
  listFbPagesForCode,

  connectFbPage,
  connectFbByToken,
  disconnectFbPage,
  saveFbAiTraining,
  listMessengerOrders,
  listFbTickets,
  resolveFbTicket,
  fbDashboardStats,
  checkFbSetup,
} from "@/lib/fb-connect.functions";
import { chatWithFbTrainer, listFbTrainerChat, clearFbTrainerChat } from "@/lib/fb-trainer.functions";
import { syncFacebookNow, autoSyncAndReply } from "@/lib/fb-sync.functions";
import { uploadToBucket, safeFileName } from "@/lib/storage-upload";

function Facebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
    </svg>
  );
}

export const Route = createFileRoute("/admin/messages")({ component: MessagesPage });

const timeFmt = (iso: string) =>
  new Date(iso).toLocaleString("bn-BD", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const TABS = [
  { key: "dashboard", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
  { key: "inbox", label: "ইনবক্স", icon: MessagesSquare },
  { key: "comments", label: "কমেন্ট", icon: MessageSquare },
  { key: "train", label: "AI ট্রেইন", icon: GraduationCap },
  { key: "orders", label: "অর্ডার", icon: ShoppingBag },
  { key: "tickets", label: "প্রবলেম টিকেট", icon: LifeBuoy },
  { key: "connect", label: "পেইজ কানেক্ট", icon: Plug },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type TrainerChatRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  learned_q: string | null;
  learned_a: string | null;
  created_at: string;
};

function MessagesPage() {
  const [tab, setTab] = useState<TabKey>("dashboard");

  return (
    <AdminLayout>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">মেসেজ</h1>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5 rounded-xl border bg-white p-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              tab === t.key ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>
      {tab === "dashboard" && <Dashboard onGo={setTab} />}
      {tab === "inbox" && <Inbox />}
      {tab === "comments" && <Comments />}
      {tab === "train" && <AiTrain />}
      {tab === "orders" && <MessengerOrders />}
      {tab === "tickets" && <Tickets />}
      {tab === "connect" && <ConnectPage />}
    </AdminLayout>
  );
}

function Dashboard({ onGo }: { onGo: (t: TabKey) => void }) {
  const statsFn = useServerFn(fbDashboardStats);
  const connFn = useServerFn(getFbConnection);
  const stats = useQuery({ queryKey: ["fb-stats"], queryFn: () => statsFn(), refetchInterval: 30_000 });
  const conn = useQuery({ queryKey: ["fb-conn"], queryFn: () => connFn() });

  const cards = [
    { label: "মোট কথাবার্তা", value: stats.data?.conversations ?? 0, tab: "inbox" as TabKey },
    { label: "অপঠিত", value: stats.data?.unread ?? 0, tab: "inbox" as TabKey },
    { label: "প্রবলেম টিকেট", value: stats.data?.tickets ?? 0, tab: "tickets" as TabKey },
    { label: "মেসেঞ্জার অর্ডার (৭ দিন)", value: stats.data?.orders_7d ?? 0, tab: "orders" as TabKey },
    { label: "AI রিপ্লাই (৭ দিন)", value: stats.data?.ai_replies_7d ?? 0, tab: "train" as TabKey },
    { label: "আসা মেসেজ (৭ দিন)", value: stats.data?.incoming_7d ?? 0, tab: "inbox" as TabKey },
    { label: "কমেন্ট (৭ দিন)", value: stats.data?.comments_7d ?? 0, tab: "comments" as TabKey },
    { label: "আয় (৭ দিন)", value: `৳ ${(stats.data?.revenue_7d ?? 0).toLocaleString()}`, tab: "orders" as TabKey },
  ];

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border p-4 flex items-center gap-3 ${conn.data?.connected ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}
      >
        <Facebook className={`w-5 h-5 ${conn.data?.connected ? "text-green-700" : "text-amber-700"}`} />
        <div className="text-sm">
          {conn.data?.connected ? (
            <>
              <span className="font-semibold">কানেক্টেড:</span> {conn.data.page_name || conn.data.page_id}
            </>
          ) : (
            "কোনো ফেসবুক পেইজ কানেক্ট করা নেই।"
          )}
        </div>
        <button onClick={() => onGo("connect")} className="ml-auto rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold">
          {conn.data?.connected ? "পরিবর্তন" : "কানেক্ট করুন"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => onGo(c.tab)}
            className="rounded-xl border bg-white p-4 text-left hover:shadow-sm transition"
          >
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-2xl font-bold text-brand-dark">{c.value}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AiTrain() {
  const trainerFn = useServerFn(chatWithFbTrainer);
  const trainerListFn = useServerFn(listFbTrainerChat);
  const trainerClearFn = useServerFn(clearFbTrainerChat);
  const [trainerDraft, setTrainerDraft] = useState("");
  const [trainerBusy, setTrainerBusy] = useState(false);
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const trainerBottom = useRef<HTMLDivElement>(null);

  const chat = useQuery({
    queryKey: ["fb-trainer-chat"],
    queryFn: () => trainerListFn(),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    requestAnimationFrame(() => trainerBottom.current?.scrollIntoView({ behavior: "smooth" }));
  }, [chat.data?.length, trainerBusy]);

  const pickImage = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadToBucket("site-assets", `fb-train/${safeFileName(file.name)}`, file, { upsert: true });
      setImage({ url, name: file.name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ছবি আপলোড হয়নি");
    } finally {
      setUploading(false);
    }
  };

  const toggleVoice = () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("এই ব্রাউজারে ভয়েস সাপোর্ট নেই — Chrome ব্যবহার করুন");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "bn-BD";
    rec.continuous = true;
    rec.interimResults = true;
    let base = trainerDraft;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let extra = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        extra += event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          base = `${base} ${event.results[i][0].transcript}`.trim();
          extra = "";
        }
      }
      setTrainerDraft(`${base} ${extra}`.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const train = async () => {
    const text = trainerDraft.trim();
    if ((!text && !image) || trainerBusy) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    }
    setTrainerDraft("");
    const sentImage = image;
    setImage(null);
    setTrainerBusy(true);
    try {
      const result = await trainerFn({ data: { message: text, image_url: sentImage?.url ?? null } });
      await chat.refetch();
      if (result.learned) toast.success("AI নতুন তথ্য শিখেছে");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI ডিরেক্টর উত্তর দিতে পারেনি");
    } finally {
      setTrainerBusy(false);
    }
  };

  const clearChat = async () => {
    if (!confirm("পুরো ট্রেইনিং চ্যাট মুছে ফেলবেন?")) return;
    try {
      await trainerClearFn();
      await chat.refetch();
      toast.success("চ্যাট মুছে ফেলা হয়েছে");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "মুছা যায়নি");
    }
  };

  const rows = chat.data ?? [];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-bold">AI ট্রেনিং ডিরেক্টর</h2>
            <p className="text-xs text-muted-foreground">ভয়েস, মেসেজ বা ছবি দিয়ে শেখান — চ্যাট সবসময় সেভ থাকে</p>
          </div>
          <button onClick={clearChat} className="ml-auto rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[55vh] min-h-64 overflow-y-auto p-4 space-y-3 bg-muted/20">
          {!rows.length && (
            <div className="rounded-xl border bg-white px-3.5 py-2 text-sm">
              আমি আপনার AI ট্রেনিং ডিরেক্টর। কাস্টমারকে কীভাবে উত্তর দিতে হবে, অফার, ডেলিভারি বা দোকানের নিয়ম — লিখে, বলে বা
              ছবি দিয়ে আমাকে বলুন। আমি বুঝে ট্রেনিংয়ে যোগ করব।
            </div>
          )}
          {rows.map((message: TrainerChatRow) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm whitespace-pre-wrap ${message.role === "user" ? "bg-brand text-white" : "border bg-white"}`}
              >
                {message.image_url && (
                  <img
                    src={message.image_url}
                    alt="ট্রেইনিং ছবি"
                    className="mb-2 max-h-48 w-auto rounded-lg object-contain"
                    loading="lazy"
                  />
                )}
                {message.content}
                {message.learned_q && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-green-700">
                    <CheckCircle2 className="h-3 w-3" /> শেখা হয়েছে: {message.learned_q}
                  </div>
                )}
              </div>
            </div>
          ))}
          {trainerBusy && <div className="text-xs text-muted-foreground">AI ডিরেক্টর ভাবছে…</div>}
          <div ref={trainerBottom} />
        </div>
        {image && (
          <div className="flex items-center gap-2 border-t bg-muted/30 px-3 py-2 text-xs">
            <img src={image.url} alt="" className="h-10 w-10 rounded object-cover" />
            <span className="truncate">{image.name}</span>
            <button onClick={() => setImage(null)} className="ml-auto text-destructive font-semibold">
              সরান
            </button>
          </div>
        )}
        <div className="border-t p-3 flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pickImage(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border p-3 text-muted-foreground disabled:opacity-50"
            aria-label="ছবি দিন"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </button>
          <button
            onClick={toggleVoice}
            className={`rounded-lg border p-3 ${listening ? "bg-destructive text-white animate-pulse" : "text-muted-foreground"}`}
            aria-label="ভয়েসে বলুন"
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <textarea
            rows={2}
            value={trainerDraft}
            onChange={(event) => setTrainerDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void train();
              }
            }}
            placeholder={listening ? "শুনছি… বলুন" : "যেমন: কাস্টমার ডেলিভারি চার্জ জিজ্ঞেস করলে বলবে…"}
            className="flex-1 resize-none rounded-lg border px-3 py-2 text-sm"
          />
          <button
            onClick={() => void train()}
            disabled={(!trainerDraft.trim() && !image) || trainerBusy}
            className="rounded-lg bg-brand p-3 text-white disabled:opacity-50"
            aria-label="AI ডিরেক্টরকে পাঠান"
          >
            {trainerBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessengerOrders() {
  const listFn = useServerFn(listMessengerOrders);
  const orders = useQuery({ queryKey: ["fb-orders"], queryFn: () => listFn(), refetchInterval: 30_000 });

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">ইনভয়েস</th>
              <th className="px-3 py-2 text-left">কাস্টমার</th>
              <th className="px-3 py-2 text-left">ফোন</th>
              <th className="px-3 py-2 text-left">মোট</th>
              <th className="px-3 py-2 text-left">স্টেটাস</th>
              <th className="px-3 py-2 text-left">সময়</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(orders.data ?? []).map((o) => (
              <tr key={o.id} className="hover:bg-muted/40">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link to="/admin/orders" className="text-brand font-semibold">
                    {o.invoice_no ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2">{o.customer_name}</td>
                <td className="px-3 py-2 font-mono text-xs">{o.customer_phone}</td>
                <td className="px-3 py-2 font-semibold">৳ {Number(o.total).toLocaleString()}</td>
                <td className="px-3 py-2"><span className="rounded bg-muted px-2 py-0.5 text-xs">{o.status}</span></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{timeFmt(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!orders.isLoading && !(orders.data ?? []).length && (
        <div className="p-10 text-center text-sm text-muted-foreground">মেসেঞ্জার থেকে এখনো কোনো অর্ডার আসেনি</div>
      )}
    </div>
  );
}

function Tickets() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFbTickets);
  const resolveFn = useServerFn(resolveFbTicket);
  const [resolved, setResolved] = useState(false);
  const tickets = useQuery({
    queryKey: ["fb-tickets", resolved],
    queryFn: () => listFn({ data: { resolved } }),
    refetchInterval: 20_000,
  });

  const act = async (id: string, reopen: boolean) => {
    try {
      await resolveFn({ data: { conversation_id: id, reopen } });
      toast.success(reopen ? "টিকেট আবার খোলা হলো" : "টিকেট সমাধান হয়েছে");
      qc.invalidateQueries({ queryKey: ["fb-tickets"] });
      qc.invalidateQueries({ queryKey: ["fb-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ব্যর্থ");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex rounded-lg border bg-white p-1 w-fit">
        {[
          [false, "খোলা টিকেট"],
          [true, "সমাধান হয়েছে"],
        ].map(([v, label]) => (
          <button
            key={String(v)}
            onClick={() => setResolved(v as boolean)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold ${resolved === v ? "bg-brand text-white" : "text-muted-foreground"}`}
          >
            {label as string}
          </button>
        ))}
      </div>
      {(tickets.data ?? []).map((t) => (
        <div key={t.id} className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 text-sm">
            <LifeBuoy className="w-4 h-4 text-destructive" />
            <span className="font-semibold">{t.customer_name ?? "কাস্টমার"}</span>
            {t.customer_phone && <span className="text-xs text-muted-foreground font-mono">{t.customer_phone}</span>}
            <span className="ml-auto text-xs text-muted-foreground">{timeFmt(t.last_message_at)}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t.last_message_text ?? "—"}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => act(t.id, resolved)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {resolved ? "আবার খুলুন" : "সমাধান হয়েছে"}
            </button>
          </div>
        </div>
      ))}
      {!tickets.isLoading && !(tickets.data ?? []).length && (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-muted-foreground">
          কোনো টিকেট নেই — সব ঠিক আছে ✓
        </div>
      )}
    </div>
  );
}

function ConnectPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getFbConnection);
  const loginUrlFn = useServerFn(getFbLoginUrl);
  const listPagesFn = useServerFn(listFbPagesForCode);
  const connectFn = useServerFn(connectFbPage);
  const disconnectFn = useServerFn(disconnectFbPage);
  const syncFn = useServerFn(syncFacebookNow);

  const conn = useQuery({ queryKey: ["fb-conn"], queryFn: () => getFn() });
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pages, setPages] = useState<{ id: string; name: string; category: string; picture: string }[] | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const tokenFn = useServerFn(connectFbByToken);

  const connectWithToken = async () => {
    setBusy(true);
    try {
      const res = await tokenFn({ data: { token: tokenInput.trim() } });
      if (res.mode === "connected") {
        setTokenInput("");
        setPages(null);
        await qc.invalidateQueries({ queryKey: ["fb-conn"] });
        toast.success(`কানেক্ট হয়েছে: ${res.page_name}`);
        if (res.warning) toast.warning(res.warning);
      } else {
        setPages(res.pages);
        toast.success("পেইজ পাওয়া গেছে — সিলেক্ট করুন");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "কানেক্ট হয়নি");
    } finally {
      setBusy(false);
    }
  };


  const finishWithCode = async (code: string, state: string) => {
    setBusy(true);
    try {
      const res = await listPagesFn({ data: { code, state } });
      setPages(res.pages);
      if (!res.pages.length) toast.error("এই আইডিতে পরিচালনা করার মতো কোনো পেইজ পাওয়া যায়নি");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "লগইন ব্যর্থ");
    } finally {
      setBusy(false);
    }
  };

  // Popup callback + same-tab fallback (?fb_code=...)
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const d = ev.data as { type?: string; code?: string; state?: string; error?: string };
      if (d?.type !== "fb-oauth") return;
      if (d.error) {
        toast.error(d.error);
        setBusy(false);
        return;
      }
      if (d.code && d.state) void finishWithCode(d.code, d.state);
    };
    window.addEventListener("message", onMsg);
    const q = new URLSearchParams(window.location.search);
    const code = q.get("fb_code");
    const state = q.get("fb_state");
    const err = q.get("fb_error");
    if (code || err) {
      window.history.replaceState({}, "", window.location.pathname);
      if (err) toast.error(err);
      else if (code && state) void finishWithCode(code, state);
    }
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithFacebook = async () => {
    setBusy(true);
    // Open the popup during the click gesture so it is never blocked.
    const popup = window.open("about:blank", "fb-login", "width=520,height=680");
    try {
      const { url } = await loginUrlFn();
      if (popup) popup.location.href = url;
      else window.location.href = url;
      if (popup) {
        const watcher = window.setInterval(() => {
          if (!popup.closed) return;
          window.clearInterval(watcher);
          setBusy(false);
        }, 500);
      }
    } catch (e) {
      popup?.close();
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "লগইন শুরু করা যায়নি");
    }
  };


  const choose = async (p: { id: string; name: string }) => {
    setBusy(true);
    try {
      const r = await connectFn({ data: { page_id: p.id, page_name: p.name } });
      toast.success(`${r.page_name} কানেক্ট হয়েছে — মেসেজ এখন এখানেই আসবে`);
      if (r.warning) toast.warning(r.warning);
      setPages(null);
      qc.invalidateQueries({ queryKey: ["fb-conn"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "কানেক্ট হয়নি");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectFn();
      toast.success("ডিসকানেক্ট হয়েছে");
      qc.invalidateQueries({ queryKey: ["fb-conn"] });
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const result = await syncFn();
      toast.success(`Sync হয়েছে: ${result.messages} মেসেজ, ${result.comments} কমেন্ট`);
      for (const w of result.warnings ?? []) toast.warning(w, { duration: 10000 });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["fb-convs"] }),
        qc.invalidateQueries({ queryKey: ["fb-comments"] }),
        qc.invalidateQueries({ queryKey: ["fb-stats"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync সম্পন্ন হয়নি");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-xl border bg-white p-5">
        {conn.data?.connected ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <div className="font-bold">{conn.data.page_name || conn.data.page_id}</div>
              <div className="text-xs text-muted-foreground">পেইজ কানেক্টেড — মেসেজ ও কমেন্ট অটো আসছে</div>
            </div>
            <div className="ml-auto flex gap-2">
              <button onClick={() => void syncNow()} disabled={syncing} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-brand disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> সব Sync
              </button>
              <button onClick={disconnect} disabled={busy} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-destructive">
                ডিসকানেক্ট
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <Facebook className="w-10 h-10 mx-auto text-[#1877F2]" />
            <h2 className="mt-3 font-bold text-lg">
              {conn.data?.reconnect_required ? "Facebook সংযোগের মেয়াদ শেষ" : "ফেসবুক দিয়ে লগইন করুন"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {conn.data?.reconnect_required
                ? "একবার আবার কানেক্ট করলেই মেসেজ, কমেন্ট ও Instant AI অটো চালু হয়ে যাবে।"
                : "লগইন করলেই আপনার আইডি ও বিজনেস ম্যানেজারের সব পেইজ দেখতে পাবেন — শুধু সিলেক্ট করলেই কাজ শেষ।"}
            </p>
            <button
              onClick={loginWithFacebook}
              disabled={busy}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Facebook className="w-4 h-4" />}
              {conn.data?.reconnect_required ? "এখনই পুনরায় কানেক্ট করুন" : "Facebook দিয়ে চালিয়ে যান"}
            </button>
          </div>
        )}
      </div>

      {!conn.data?.connected && (
        <div className="rounded-xl border-2 border-brand/30 bg-brand/5 p-5">
          <h3 className="font-bold text-base">সবচেয়ে সহজ উপায় — টোকেন পেস্ট করুন</h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            App ID / Secret / Redirect URI — কিছুই লাগবে না। শুধু{" "}
            <a
              href="https://developers.facebook.com/tools/explorer/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand underline"
            >
              Graph API Explorer
            </a>{" "}
            খুলে পেইজ সিলেক্ট করে <b>Page Access Token</b> কপি করে নিচে পেস্ট করুন। ইউজার টোকেন দিলেও চলবে — তখন পেইজ লিস্ট আসবে।
          </p>
          <textarea
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            rows={3}
            placeholder="EAAG... এখানে টোকেন পেস্ট করুন"
            className="mt-3 w-full rounded-lg border px-3 py-2 text-xs font-mono"
          />
          <button
            onClick={() => void connectWithToken()}
            disabled={busy || tokenInput.trim().length < 30}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            টোকেন দিয়ে কানেক্ট
          </button>
        </div>
      )}


      {pages && (
        <div className="rounded-xl border bg-white p-5">
          <h3 className="font-bold mb-3">পেইজ সিলেক্ট করুন</h3>
          <div className="space-y-2">
            {pages.map((p) => (
              <button
                key={p.id}
                onClick={() => choose(p)}
                disabled={busy}
                className="w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left hover:bg-muted disabled:opacity-60"
              >
                {p.picture ? (
                  <img src={p.picture} alt={p.name} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-muted" />
                )}
                <div>
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.category || p.id}</div>
                </div>
                <span className="ml-auto text-xs font-semibold text-brand">সিলেক্ট</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!conn.data?.connected && <SetupWizard conn={conn.data} onSaved={() => qc.invalidateQueries({ queryKey: ["fb-conn"] })} />}

    </div>
  );
}


function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-lg border bg-muted/50 p-2.5">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 font-mono text-xs break-all">{value}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setDone(true);
              window.setTimeout(() => setDone(false), 1500);
            } catch {
              toast.error("কপি হয়নি — হাতে সিলেক্ট করে কপি করুন");
            }
          }}
          className="shrink-0 rounded-md border bg-white px-2 py-1 text-[11px] font-semibold"
        >
          {done ? "কপি ✓" : "কপি"}
        </button>
      </div>
    </div>
  );
}

type ConnState = {
  app_id?: string | null;
  has_app_secret?: boolean;
  platform_app?: boolean;
  verify_token?: string | null;
  redirect_uri?: string;
  app_domain?: string;
  webhook_url?: string;
};

/** Guided one-time Meta setup: save credentials → copy values into Meta → login. */
function SetupWizard({ conn, onSaved }: { conn?: ConnState; onSaved: () => void }) {
  const saveAppFn = useServerFn(saveFbApp);
  const checkFn = useServerFn(checkFbSetup);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (conn?.app_id) setAppId(conn.app_id);
  }, [conn?.app_id]);

  const redirect = conn?.redirect_uri ?? "";
  const domain = conn?.app_domain ?? "";
  const webhook = conn?.webhook_url ?? "";
  const site = domain ? `https://${domain}/` : "";
  const ready = !!conn?.app_id && !!conn?.has_app_secret;

  const runCheck = async () => {
    setChecking(true);
    try {
      const r = await checkFn();
      setResult({ ok: r.ok, message: r.message });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch (e) {
      const m = e instanceof Error ? e.message : "যাচাই করা যায়নি";
      setResult({ ok: false, message: m });
      toast.error(m);
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveAppFn({ data: { app_id: appId.trim(), app_secret: appSecret.trim() } });
      setAppSecret("");
      toast.success("সেভ হয়েছে");
      onSaved();
      await runCheck();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "সেভ হয়নি");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white p-5 space-y-5">
      <div>
        <h3 className="font-bold">সেটআপ (একবারই লাগে · ~৫ মিনিট)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          নিচের ৩টি ধাপ শেষ করলে এরপর প্রতিটি পেইজ ১ ক্লিকে কানেক্ট হবে।
        </p>
      </div>

      {/* Step 1 */}
      <div className="space-y-2">
        <div className="text-sm font-semibold">
          ধাপ ১ — Meta App বানান
        </div>
        <p className="text-xs text-muted-foreground">
          <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-brand font-semibold underline">
            developers.facebook.com/apps
          </a>{" "}
          → Create App → টাইপ <b>Business</b> → Products-এ <b>Facebook Login</b> ও <b>Messenger</b> যোগ করুন।
        </p>
      </div>

      {/* Step 2 */}
      <div className="space-y-2">
        <div className="text-sm font-semibold">ধাপ ২ — এই মানগুলো Meta App-এ বসান</div>
        <div className="grid gap-2">
          <CopyRow label="Settings → Basic → App Domains" value={domain} />
          <CopyRow label="Settings → Basic → Website URL" value={site} />
          <CopyRow label="Facebook Login → Settings → Valid OAuth Redirect URIs" value={redirect} />
          <CopyRow label="Messenger → Webhooks → Callback URL" value={webhook} />
          <CopyRow label="Messenger → Webhooks → Verify Token" value={conn?.verify_token ?? ""} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Webhook Fields-এ টিক দিন: <b>messages</b>, <b>messaging_postbacks</b>, <b>feed</b>। শেষে <b>Save Changes</b>।
        </p>
      </div>

      {/* Step 3 */}
      {!conn?.platform_app && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">
            ধাপ ৩ — App ID ও App Secret এখানে দিন {ready ? "✓" : ""}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">App ID</label>
              <input
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="১৫-১৬ ডিজিটের নম্বর"
                className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">App Secret</label>
              <input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder={conn?.has_app_secret ? "সেভ করা আছে — বদলাতে চাইলে লিখুন" : "Show চেপে কপি করুন"}
                className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={save}
              disabled={saving || !appId.trim() || !appSecret.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} সেভ ও যাচাই
            </button>
            <button
              onClick={runCheck}
              disabled={checking || !ready}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} সেটআপ টেস্ট
            </button>
          </div>
          {result && (
            <div
              className={`rounded-lg border p-3 text-xs ${result.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}
            >
              {result.message}
              {result.ok && <div className="mt-1">এখন উপরে “Facebook দিয়ে চালিয়ে যান” চাপুন।</div>}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        App এখনো Development mode-এ থাকলে শুধু App-এর Admin/Developer লগইন করতে পারবেন — নিজের আইডি দিয়ে টেস্ট করা যাবে।
      </p>
    </div>
  );
}

function initials(name?: string | null) {
  const n = (name ?? "").trim();
  if (!n) return "?";
  return n.slice(0, 2).toUpperCase();
}

function Inbox() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFbConversations);
  const msgFn = useServerFn(listFbMessages);
  const sendFn = useServerFn(sendFbReply);
  const patchFn = useServerFn(updateFbConversation);
  const enableAllFn = useServerFn(enableAiEverywhere);
  const autoFn = useServerFn(autoSyncAndReply);
  const deleteFn = useServerFn(deleteFbMessages);

  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const convs = useQuery({
    queryKey: ["fb-convs"],
    queryFn: () => listFn({ data: { status: "all" } }),
    refetchInterval: 2_000,
  });

  const messages = useQuery({
    queryKey: ["fb-msgs", active],
    queryFn: () => msgFn({ data: { conversation_id: active! } }),
    enabled: !!active,
    refetchInterval: 1_500,
  });

  // AI auto-reply is on by default for every conversation
  useEffect(() => {
    let done = false;
    enableAllFn({ data: {} })
      .then((r: { updated: number }) => {
        if (!done && r.updated > 0) qc.invalidateQueries({ queryKey: ["fb-convs"] });
      })
      .catch(() => {});
    return () => {
      done = true;
    };
  }, [enableAllFn, qc]);

  // Webhook delivery is instant. This lightweight poll is a safety net while
  // the inbox is open, and never requires a manual refresh button.
  useEffect(() => {
    let stopped = false;
    let busy = false;
    const tick = async () => {
      if (stopped || busy || document.hidden) return;
      busy = true;
      try {
        await autoFn({ data: {} } as never);
        if (!stopped) {
          qc.invalidateQueries({ queryKey: ["fb-convs"] });
          qc.invalidateQueries({ queryKey: ["fb-msgs"] });
        }
      } catch {
        // The realtime channel and scheduled fallback remain active.
      } finally {
        busy = false;
      }
    };
    void tick();
    const timer = window.setInterval(tick, 8_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [autoFn, qc]);

  // Live updates
  useEffect(() => {
    const channel = supabase
      .channel("admin-fb-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "fb_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["fb-msgs"] });
        qc.invalidateQueries({ queryKey: ["fb-convs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "fb_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["fb-convs"] });
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);


  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  useEffect(() => {
    setPicked([]);
  }, [active]);

  const togglePick = (id: string) =>
    setPicked((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const removePicked = async () => {
    if (!picked.length || deleting) return;
    if (!confirm(`${picked.length}টি মেসেজ মুছে ফেলবেন? পেইজ থেকেও মুছে যাবে।`)) return;
    setDeleting(true);
    try {
      const result = await deleteFn({ data: { ids: picked } });
      setPicked([]);
      toast.success(`${result.deleted}টি মেসেজ মুছে ফেলা হয়েছে`);
      if (result.warning) toast.warning(result.warning);
      qc.invalidateQueries({ queryKey: ["fb-msgs"] });
      qc.invalidateQueries({ queryKey: ["fb-convs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "মুছা যায়নি");
    } finally {
      setDeleting(false);
    }
  };

  const all = convs.data ?? [];
  const list = all.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.customer_name ?? "").toLowerCase().includes(q) ||
      (c.customer_phone ?? "").includes(q) ||
      (c.psid ?? "").includes(q) ||
      (c.last_message_text ?? "").toLowerCase().includes(q)
    );
  });
  const current = all.find((c) => c.id === active) ?? null;
  const currentMsgs = messages.data ?? [];
  const aiCost = currentMsgs.filter((m) => m.sent_by === "ai").length * 0.2;

  const send = async () => {
    if (!active || !draft.trim()) return;
    setSending(true);
    try {
      await sendFn({ data: { conversation_id: active, text: draft.trim() } });
      setDraft("");
      qc.invalidateQueries({ queryKey: ["fb-msgs", active] });
      qc.invalidateQueries({ queryKey: ["fb-convs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "পাঠানো যায়নি");
    } finally {
      setSending(false);
    }
  };

  const toggleAi = async () => {
    if (!current) return;
    try {
      await patchFn({
        data: {
          conversation_id: current.id,
          ai_enabled: !current.ai_enabled,
          status: current.ai_enabled ? "human" : "open",
        },
      });
      toast.success(current.ai_enabled ? "AI বন্ধ — আপনি রিপ্লাই দিন" : "AI চালু হয়েছে");
      qc.invalidateQueries({ queryKey: ["fb-convs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "পরিবর্তন হয়নি");
    }
  };

  const enableAll = async () => {
    try {
      const r = await enableAllFn({ data: {} });
      toast.success(`${r.updated} টি চ্যাটে অটো AI রিপ্লাই চালু`);
      qc.invalidateQueries({ queryKey: ["fb-convs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "চালু করা যায়নি");
    }
  };

  const pending = all.filter((c) => c.unread_count > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border bg-white p-3 shadow-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">
          <span className={`h-2 w-2 rounded-full ${live ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />
          {live ? "লাইভ" : "কানেক্ট হচ্ছে…"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand">
          <Sparkles className="h-3.5 w-3.5" /> Instant AI চালু
        </span>
        <span className="text-xs text-muted-foreground">
          মোট {all.length} • অপঠিত {pending}
        </span>
        <button
          onClick={enableAll}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-muted"
        >
          <Bot className="w-4 h-4" /> সব চ্যাটে AI চালু
        </button>
        <button
          onClick={() => convs.refetch()}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-muted"
        >
          <RefreshCw className={`w-4 h-4 ${convs.isFetching ? "animate-spin" : ""}`} /> রিফ্রেশ
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[300px_1fr_260px]">
        {/* conversation list */}
        <div className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="p-2.5 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="নাম / ID / মেসেজ খুঁজুন"
                className="w-full rounded-xl border bg-muted/40 py-2 pl-8 pr-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>
          <div className="max-h-[34vh] overflow-y-auto divide-y lg:max-h-[68vh]">
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={`w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-muted transition ${active === c.id ? "bg-muted" : ""}`}
              >
                <span className="relative shrink-0">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
                    {initials(c.customer_name)}
                  </span>
                  <Facebook className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 text-[#1877F2] bg-white rounded-full" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm truncate">{c.customer_name ?? "কাস্টমার"}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                      {timeFmt(c.last_message_at)}
                    </span>
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">{c.last_message_text ?? "—"}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-[10px]">
                    {c.unread_count > 0 && (
                      <span className="rounded-full bg-brand px-1.5 font-bold text-white">{c.unread_count} নতুন</span>
                    )}
                    {c.needs_human && <span className="rounded bg-destructive/10 px-1.5 text-destructive">মানুষ দরকার</span>}
                    {!c.ai_enabled && <span className="rounded bg-muted px-1.5 text-muted-foreground">AI বন্ধ</span>}
                  </span>
                </span>
              </button>
            ))}
            {!convs.isLoading && !list.length && (
              <div className="p-6 text-center text-sm text-muted-foreground">কোনো কথাবার্তা নেই</div>
            )}
          </div>
        </div>

        {/* thread */}
        <div className="flex min-h-[62vh] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm lg:min-h-[70vh]">
          {!current ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              একটি কথাবার্তা নির্বাচন করুন
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 border-b bg-gradient-to-r from-muted/60 to-transparent px-4 py-3">
                <span className="relative shrink-0">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand ring-2 ring-white">
                    {initials(current.customer_name)}
                  </span>
                  <Facebook className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-white text-[#1877F2]" />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-bold">{current.customer_name ?? "কাস্টমার"}</div>
                  <div className="truncate text-[11px] text-muted-foreground">Facebook • ID {current.psid}</div>
                </div>
                <button
                  onClick={toggleAi}
                  className={`ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${current.ai_enabled ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}
                >
                  {current.ai_enabled ? <Bot className="w-4 h-4" /> : <BotOff className="w-4 h-4" />}
                  {current.ai_enabled ? "AI অটো রিপ্লাই" : "AI বন্ধ"}
                </button>
              </div>

              {picked.length > 0 && (
                <div className="flex items-center gap-2 border-b bg-destructive/5 px-4 py-2 text-xs">
                  <CheckSquare className="h-4 w-4 text-destructive" />
                  <span className="font-semibold">{picked.length}টি মেসেজ সিলেক্ট</span>
                  <button onClick={() => setPicked([])} className="ml-auto rounded-lg border bg-white px-2.5 py-1 font-semibold">
                    বাতিল
                  </button>
                  <button
                    onClick={removePicked}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1 font-bold text-white disabled:opacity-60"
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    ডিলিট (পেইজ থেকেও)
                  </button>
                </div>
              )}
              <div className="flex-1 space-y-2.5 overflow-y-auto bg-muted/20 p-4 max-h-[52vh]">
                {currentMsgs.map((m) => (
                  <div key={m.id} className={`flex items-center gap-2 ${m.direction === "in" ? "justify-start" : "justify-end"}`}>
                    {m.direction !== "in" && (
                      <input
                        type="checkbox"
                        checked={picked.includes(m.id)}
                        onChange={() => togglePick(m.id)}
                        className="h-4 w-4 shrink-0"
                        aria-label="মেসেজ সিলেক্ট"
                      />
                    )}
                    <div
                      className={`max-w-[75%] px-3.5 py-2 text-sm shadow-sm ${
                        m.direction === "in" ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-br-md"
                      } ${picked.includes(m.id) ? "ring-2 ring-destructive " : ""}${
                        m.direction === "in"
                          ? "bg-muted"
                          : m.sent_by === "ai"
                            ? "border border-brand/20 bg-brand/10 text-foreground"
                            : "bg-brand text-white"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{m.text ?? "[attachment]"}</div>
                      <div
                        className={`mt-1 text-[10px] ${m.direction === "in" || m.sent_by === "ai" ? "text-muted-foreground" : "text-white/70"}`}
                      >
                        {m.sent_by === "ai" ? "AI • " : m.sent_by === "staff" ? "কর্মী • " : ""}
                        {timeFmt(m.created_at)}
                      </div>
                    </div>
                    {m.direction === "in" && (
                      <input
                        type="checkbox"
                        checked={picked.includes(m.id)}
                        onChange={() => togglePick(m.id)}
                        className="h-4 w-4 shrink-0"
                        aria-label="মেসেজ সিলেক্ট"
                      />
                    )}
                  </div>
                ))}
                <div ref={bottom} />
              </div>

              <div className="flex items-end gap-2 border-t bg-muted/30 p-3">
                <textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="রিপ্লাই লিখুন... (Enter = পাঠান)"
                  className="flex-1 resize-none rounded-xl border bg-white px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
                <button
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  className="rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* details */}
        <div className="h-fit rounded-2xl border bg-white p-4 shadow-sm">
          {!current ? (
            <div className="text-sm text-muted-foreground text-center py-6">বিস্তারিত দেখতে সিলেক্ট করুন</div>
          ) : (
            <div className="space-y-3">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                  {initials(current.customer_name)}
                </div>
                <div className="mt-2 font-bold">{current.customer_name ?? "কাস্টমার"}</div>
                <div className="text-[11px] text-muted-foreground">শেষ মেসেজ {timeFmt(current.last_message_at)}</div>
              </div>
              <button
                onClick={toggleAi}
                className={`w-full rounded-lg px-3 py-2 text-xs font-bold ${current.ai_enabled ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}
              >
                {current.ai_enabled ? "AUTOMATION ON" : "AUTOMATION OFF"}
              </button>
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground pt-1">
                কথাবার্তার বিবরণ
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">রিপ্লাই মোড</dt>
                  <dd className={`font-semibold ${current.ai_enabled ? "text-green-600" : ""}`}>
                    {current.ai_enabled ? "AI রিপ্লাই" : "ম্যানুয়াল"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Facebook ID</dt>
                  <dd className="font-mono text-[11px] truncate max-w-[120px]">{current.psid}</dd>
                </div>
                {current.customer_phone && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">মোবাইল</dt>
                    <dd className="font-semibold">{current.customer_phone}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">মোট মেসেজ</dt>
                  <dd className="font-semibold">{currentMsgs.length}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">AI খরচ</dt>
                  <dd className="font-semibold">৳{aiCost.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">স্ট্যাটাস</dt>
                  <dd className="font-semibold">{current.status}</dd>
                </div>
              </dl>
              {current.last_order_id && (
                <Link
                  to="/admin/orders"
                  className="block rounded-lg border px-3 py-2 text-center text-xs font-semibold"
                >
                  শেষ অর্ডার দেখুন
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function Comments() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFbComments);
  const replyFn = useServerFn(replyFbComment);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "replied">("all");

  const comments = useQuery({
    queryKey: ["fb-comments"],
    queryFn: () => listFn({ data: {} }),
    refetchInterval: 8_000,
  });

  const rows = (comments.data ?? []).filter((c) =>
    filter === "all" ? true : filter === "pending" ? !c.replied : c.replied,
  );
  const pendingCount = (comments.data ?? []).filter((c) => !c.replied).length;

  const reply = async (id: string) => {
    const text = (drafts[id] ?? "").trim();
    if (!text) return;
    try {
      await replyFn({ data: { id, text } });
      setDrafts((d) => ({ ...d, [id]: "" }));
      toast.success("রিপ্লাই দেওয়া হয়েছে");
      qc.invalidateQueries({ queryKey: ["fb-comments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ব্যর্থ");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2">
        {([
          { key: "all", label: "সব" },
          { key: "pending", label: `অপেক্ষায় (${pendingCount})` },
          { key: "replied", label: "রিপ্লাই হয়েছে" },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.key ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          AI কমেন্টে অটো রিপ্লাই দিচ্ছে
        </span>
      </div>

      {rows.map((c) => (
        <div key={c.id} className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-muted">
              <User className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="font-semibold">{c.from_name ?? "ফেসবুক ইউজার"}</span>
            <span className="text-xs text-muted-foreground">{timeFmt(c.created_at)}</span>
            <span className="ml-auto flex items-center gap-1.5">
              {c.replied ? (
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  রিপ্লাই হয়েছে
                </span>
              ) : (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  অপেক্ষায়
                </span>
              )}
              {c.private_replied && (
                <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                  ইনবক্সেও গেছে
                </span>
              )}
              {c.permalink && (
                <a
                  href={c.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  ফেসবুকে দেখুন
                </a>
              )}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed">{c.text}</p>
          {c.ai_reply && (
            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed">
              <Bot className="mr-1 inline h-3.5 w-3.5" />
              {c.ai_reply}
            </p>
          )}
          {c.reply_error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">
              রিপ্লাই যায়নি: {c.reply_error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <input
              value={drafts[c.id] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") reply(c.id);
              }}
              placeholder="নিজে রিপ্লাই দিন..."
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
            />
            <button
              onClick={() => reply(c.id)}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!(drafts[c.id] ?? "").trim()}
            >
              পাঠান
            </button>
          </div>
        </div>
      ))}
      {!comments.isLoading && !rows.length && (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-muted-foreground">
          <MessageSquare className="mx-auto mb-2 h-6 w-6" />
          এখনো কোনো কমেন্ট নেই
        </div>
      )}
    </div>
  );
}

