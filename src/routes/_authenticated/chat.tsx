import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, MessageCircleHeart, Search, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Your chats — Alhamdulillah" },
      { name: "description", content: "Your private real-time conversations on Alhamdulillah." },
      { property: "og:title", content: "Your chats — Alhamdulillah" },
      { property: "og:description", content: "Private real-time conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatPage,
});

type Profile = {
  id: string;
  username: string;
  display_name: string;
  about: string;
};

type Thread = {
  id: string;
  last_message_at: string;
  peer: Profile;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => threads.find((t) => t.id === activeId) ?? null, [threads, activeId]);

  const loadThreads = useCallback(async () => {
    if (!user) return;
    const { data: mine, error } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);
    if (error || !mine?.length) {
      setThreads([]);
      return;
    }
    const ids = mine.map((m) => m.conversation_id);

    const [{ data: convos }, { data: parts }] = await Promise.all([
      supabase.from("conversations").select("id, last_message_at").in("id", ids),
      supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", ids),
    ]);

    const peerIds = [
      ...new Set((parts ?? []).filter((p) => p.user_id !== user.id).map((p) => p.user_id)),
    ];
    if (!peerIds.length) {
      setThreads([]);
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, about")
      .in("id", peerIds);

    const byId = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
    const list: Thread[] = (convos ?? [])
      .map((c) => {
        const peerId = (parts ?? []).find(
          (p) => p.conversation_id === c.id && p.user_id !== user.id,
        )?.user_id;
        const peer = peerId ? byId.get(peerId) : undefined;
        return peer ? { id: c.id, last_message_at: c.last_message_at, peer } : null;
      })
      .filter((t): t is Thread => t !== null)
      .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));

    setThreads(list);
  }, [user]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  // Load messages for the active conversation.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setMessages((data ?? []) as Message[]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Realtime updates.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("alhamdulillah-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) =>
            msg.conversation_id === activeId && !prev.some((m) => m.id === msg.id)
              ? [...prev, msg]
              : prev,
          );
          void loadThreads();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, activeId, loadThreads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // People search.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || !user) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      void supabase
        .from("profiles")
        .select("id, username, display_name, about")
        .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
        .neq("id", user.id)
        .limit(8)
        .then(({ data }) => setResults((data ?? []) as Profile[]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, user]);

  async function openChatWith(peer: Profile) {
    if (!user) return;
    const existing = threads.find((t) => t.peer.id === peer.id);
    setQuery("");
    setResults([]);
    if (existing) {
      setActiveId(existing.id);
      return;
    }

    const { data: convo, error } = await supabase
      .from("conversations")
      .insert({ created_by: user.id })
      .select("id, last_message_at")
      .single();
    if (error || !convo) {
      toast.error("Could not start this chat.");
      return;
    }
    const { error: partError } = await supabase.from("conversation_participants").insert([
      { conversation_id: convo.id, user_id: user.id },
      { conversation_id: convo.id, user_id: peer.id },
    ]);
    if (partError) {
      toast.error("Could not start this chat.");
      return;
    }
    setThreads((prev) => [{ id: convo.id, last_message_at: convo.last_message_at, peer }, ...prev]);
    setActiveId(convo.id);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !activeId || !user) return;
    if (content.length > 2000) {
      toast.error("Message is too long.");
      return;
    }
    setDraft("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: activeId, sender_id: user.id, content })
      .select("id, conversation_id, sender_id, content, created_at")
      .single();
    if (error) {
      toast.error("Message not sent.");
      setDraft(content);
      return;
    }
    setMessages((prev) =>
      prev.some((m) => m.id === data.id) ? prev : [...prev, data as Message],
    );
    void loadThreads();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-screen bg-background">
      <aside
        className={cn(
          "flex w-full flex-col border-r bg-sidebar md:w-[340px]",
          activeId && "hidden md:flex",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircleHeart className="size-4" />
            </span>
            <span className="font-display text-lg font-semibold">Alhamdulillah</span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>

        <div className="relative px-4 py-3">
          <Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people by username"
            className="pl-9"
            maxLength={60}
          />
        </div>

        <ScrollArea className="flex-1">
          {results.length > 0 && (
            <div className="px-2 pb-2">
              <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                People
              </p>
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => void openChatWith(p)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-sidebar-accent"
                >
                  <Avatar className="size-9">
                    <AvatarFallback>{initials(p.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="px-2 pb-4">
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Chats
            </p>
            {threads.length === 0 && (
              <p className="px-3 py-6 text-sm text-muted-foreground">
                No conversations yet. Search a username above to say salam.
              </p>
            )}
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-sidebar-accent",
                  t.id === activeId && "bg-sidebar-accent",
                )}
              >
                <Avatar className="size-10">
                  <AvatarFallback>{initials(t.peer.display_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.peer.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{t.peer.username}</p>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {timeLabel(t.last_message_at)}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <section className={cn("flex flex-1 flex-col", !activeId && "hidden md:flex")}>
        {active ? (
          <>
            <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setActiveId(null)}
                aria-label="Back to chats"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <Avatar className="size-9">
                <AvatarFallback>{initials(active.peer.display_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{active.peer.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">{active.peer.about}</p>
              </div>
            </header>

            <ScrollArea className="chat-canvas flex-1">
              <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-6">
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[78%] rounded-2xl px-3.5 py-2 shadow-soft",
                        mine
                          ? "self-end rounded-br-md bg-bubble-out text-bubble-out-foreground"
                          : "self-start rounded-bl-md bg-bubble-in text-bubble-in-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                      <p className="mt-1 text-right text-[10px] opacity-60">
                        {timeLabel(m.created_at)}
                      </p>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <form onSubmit={send} className="flex items-center gap-2 border-t bg-card px-4 py-3">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message"
                maxLength={2000}
                className="rounded-full"
              />
              <Button type="submit" size="icon" className="rounded-full" aria-label="Send message">
                <Send className="size-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="chat-canvas flex flex-1 items-center justify-center p-8 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <MessageCircleHeart className="size-7" />
              </span>
              <h2 className="mt-4 text-xl font-semibold">Pick a conversation</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Search for someone by username to start a new chat.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
