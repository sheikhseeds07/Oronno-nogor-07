import { SafeImage } from "@/components/SafeImage";
import { logger } from "@/lib/logger";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, BadgeCheck, Headset, Home, Image as ImageIcon, Mic, PackageSearch, Phone, RotateCcw, Send, Square, Tag, UserRound, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Attachment, AttachmentPreview, AttachmentRemove, Attachments } from "@/components/ai-elements/attachments";
import { PromptInput, PromptInputButton, PromptInputFooter, PromptInputHeader, PromptInputSubmit, PromptInputTextarea, PromptInputTools, usePromptInputAttachments, type PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { trackContact } from "@/lib/fbq";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";
import { websiteAiChat } from "@/lib/website-ai-chat.functions";

type ProductCard = { id: string; name: string; price: number; sale_price: number | null; stock: number; slug: string; short_description: string | null; images: string[] | null };
type ChatAttachment = { type: "file"; url: string; mediaType: string; filename?: string };
type ChatMessage = { role: "user" | "assistant"; text: string; attachments?: ChatAttachment[]; products?: ProductCard[]; orderId?: string | null; invoiceNo?: string | null };

const INTRO = "আসসালামু আলাইকুম। পণ্য, অর্ডার বা গাছের সমস্যা—যা জানতে চান সরাসরি বলুন।";
const QUICK_PROMPTS = ["পণ্যের দাম জানতে চাই", "গাছের সমস্যার সমাধান", "অর্ডার করতে চাই"];
const CHAT_STORAGE_KEY = "sheikhseeds_live_chat_v1";
const CHAT_STORAGE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const cleanMediaType = (value: string) => (value.split(";")[0] || "").trim().toLowerCase();

const filePayload = (file: ChatAttachment) => {
  const commaIndex = file.url.indexOf(",");
  if (!file.url.startsWith("data:") || commaIndex < 0) return null;
  const meta = file.url.slice(5, commaIndex);
  const data = file.url.slice(commaIndex + 1);
  if (!meta.includes("base64") || !data) return null;
  const mediaType = cleanMediaType(meta) || cleanMediaType(file.mediaType);
  if (!/^(image|audio)\//.test(mediaType)) return null;
  return { mediaType, data, name: file.filename };
};

const persistableMessage = (message: ChatMessage): ChatMessage => ({
  ...message,
  attachments: message.attachments?.filter((file) => file.mediaType.startsWith("image/") && file.url.length < 200_000),
});

const loadStoredMessages = (): ChatMessage[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; messages?: ChatMessage[] };
    if (!parsed?.messages?.length) return null;
    if (typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt > CHAT_STORAGE_MAX_AGE) {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
      return null;
    }
    return parsed.messages.filter((item) => item && (item.role === "user" || item.role === "assistant"));
  } catch {
    return null;
  }
};

function AttachmentStrip() {
  const attachments = usePromptInputAttachments();
  if (!attachments.files.length) return null;
  return <PromptInputHeader><Attachments variant="inline">{attachments.files.map((file) => <Attachment key={file.id} data={file} onRemove={() => attachments.remove(file.id)}><AttachmentPreview/><AttachmentRemove label="সরান"/></Attachment>)}</Attachments></PromptInputHeader>;
}

export function CustomerBottomNav({ hidden = false }: { hidden?: boolean }) {
  const { initialized } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ role: "assistant", text: INTRO }]);
  const [chatRestored, setChatRestored] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [voiceAttachment, setVoiceAttachment] = useState<ChatAttachment | null>(null);
  const { data: settingsRow } = useQuery(publicSiteSettingsQuery);
  const settings = settingsRow?.settings ?? {};
  const contactPhone = typeof settings.contact_phone === "string" ? settings.contact_phone.trim() : "";
  const messengerUrl = typeof settings.contact_page_message_url === "string" ? settings.contact_page_message_url.trim() : "";
  const logoUrl = typeof settings.logo_url === "string" && settings.logo_url ? settings.logo_url : "/logo.jpg";
  const sendWebsiteAiChat = useServerFn(websiteAiChat);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      setMinimized(window.scrollY > 40);
      timer = setTimeout(() => setMinimized(false), 180);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (timer) clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const stored = loadStoredMessages();
    if (stored?.length) setChatMessages(stored);
    setChatRestored(true);
  }, []);

  useEffect(() => {
    if (!chatRestored || typeof window === "undefined") return;
    try {
      if (chatMessages.length <= 1) window.localStorage.removeItem(CHAT_STORAGE_KEY);
      else window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), messages: chatMessages.slice(-40).map(persistableMessage) }));
    } catch { /* storage full or blocked */ }
  }, [chatMessages, chatRestored]);

  const resetChat = () => {
    setChatMessages([{ role: "assistant", text: INTRO }]);
    setVoiceAttachment(null);
    try { window.localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!contactOpen && !chatOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setContactOpen(false); setChatOpen(false); } };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [contactOpen, chatOpen]);

  const toggleRecording = async () => {
    if (recording) { try { recorderRef.current?.stop(); } catch { setRecording(false); } return; }
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return toast.error("এই ব্রাউজারে ভয়েস রেকর্ডিং সাপোর্ট করে না");
    if (!window.isSecureContext) return toast.error("ভয়েস রেকর্ড করতে সাইটটি https-এ খুলুন");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
      const supported = preferred.find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = supported ? new MediaRecorder(stream, { mimeType: supported }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => { setRecording(false); stream.getTracks().forEach((track) => track.stop()); toast.error("রেকর্ডিং করা যায়নি, আবার চেষ্টা করুন"); };
      recorder.onstop = () => {
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        const rawType = recorder.mimeType || supported || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: rawType });
        chunksRef.current = [];
        if (blob.size < 800) { toast.error("রেকর্ডিং খুব ছোট হয়েছে, আরেকবার বলুন"); return; }
        const extension = rawType.includes("mp4") || rawType.includes("aac") ? "m4a" : rawType.includes("ogg") ? "ogg" : "webm";
        const reader = new FileReader();
        reader.onerror = () => toast.error("ভয়েসটি পড়া যায়নি, আবার চেষ্টা করুন");
        reader.onloadend = () => {
          if (typeof reader.result !== "string") { toast.error("ভয়েসটি পড়া যায়নি, আবার চেষ্টা করুন"); return; }
          setVoiceAttachment({ type: "file", url: reader.result, mediaType: cleanMediaType(rawType), filename: `voice-message.${extension}` });
        };
        reader.readAsDataURL(blob);
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
    } catch { toast.error("মাইক্রোফোন ব্যবহারের অনুমতি দিন"); }
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    const supplied = message.files.map((file) => ({ type: "file" as const, url: file.url, mediaType: file.mediaType, filename: file.filename }));
    const visibleAttachments = [...supplied, ...(voiceAttachment ? [voiceAttachment] : [])];
    if (!text && !visibleAttachments.length) return undefined;
    const payload = visibleAttachments.map(filePayload).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (!text && !payload.length) {
      toast.error("ছবি বা ভয়েসটি পড়া যায়নি");
      return undefined;
    }
    const history = chatMessages.slice(-10).map((item) => ({ direction: item.role === "user" ? "in" as const : "out" as const, text: item.text }));
    setVoiceAttachment(null);
    setChatMessages((previous) => [...previous, { role: "user", text, attachments: visibleAttachments }]);
    setChatSending(true);
    try {
      const result = await sendWebsiteAiChat({ data: { incoming: text, history, attachments: payload } });
      setChatMessages((previous) => [...previous, { role: "assistant", text: result.text, products: result.products, orderId: result.orderId, invoiceNo: result.invoiceNo }]);
    } catch (error) {
      logger.error("Website AI chat failed", error);
      setChatMessages((previous) => [...previous, { role: "assistant", text: error instanceof Error ? error.message : "দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করুন।" }]);
    } finally { setChatSending(false); }
  };

  if (!initialized) return null;
  const itemClass = `group relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg text-muted-foreground transition-all duration-300 hover:bg-accent hover:text-primary active:scale-95 ${minimized ? "h-8" : "h-12 sm:h-13"}`;
  const iconClass = `transition-all duration-300 ${minimized ? "h-0 w-0 -translate-y-2 scale-75 opacity-0" : "h-5 w-5 translate-y-0 scale-100 opacity-100"}`;
  const phoneHref = contactPhone ? `tel:${contactPhone.replace(/[^+\d]/g, "")}` : "";

  return <>
    <nav aria-label="কাস্টমার নেভিগেশন" aria-hidden={hidden} className={`fixed inset-x-2 bottom-[max(7px,env(safe-area-inset-bottom))] z-30 mx-auto max-w-[500px] rounded-xl border bg-background/95 shadow-xl backdrop-blur-xl transition-all duration-300 ${minimized ? "translate-y-1 p-1" : "p-1.5"} ${hidden ? "translate-y-[150%] opacity-0 pointer-events-none" : ""}`}>
      <div className="flex items-center gap-0.5">
        <Link to="/shop" className={itemClass}><PackageSearch className={iconClass}/><span className="mt-1 text-[9px] font-extrabold">সকল পণ্য</span></Link>
        <Link to="/offers" className={itemClass}><Tag className={iconClass}/><span className="mt-1 text-[9px] font-extrabold">অফার</span></Link>
        <Link to="/" activeOptions={{ exact: true }} className={`flex w-16 shrink-0 flex-col items-center justify-center text-primary transition-all duration-300 active:scale-95 ${minimized ? "h-8" : "h-13"}`}><span className={`flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 ${minimized ? "h-0 w-0 -translate-y-2 scale-75 opacity-0" : "h-10 w-10 translate-y-0 scale-100 opacity-100"}`}><Home className="h-5 w-5"/></span><span className={`text-[9px] font-extrabold transition-all duration-300 ${minimized ? "mt-0" : "mt-0.5"}`}>হোম</span></Link>
        <button type="button" onClick={() => setContactOpen(true)} className={itemClass}><Headset className={iconClass}/><span className="mt-1 text-[9px] font-extrabold">যোগাযোগ</span></button>
        <Link to="/profile" className={itemClass}><UserRound className={iconClass}/><span className="mt-1 text-[9px] font-extrabold">অ্যাকাউন্ট</span></Link>
      </div>
    </nav>

    {contactOpen && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/55 p-4 backdrop-blur-sm" onClick={() => setContactOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="যোগাযোগ করুন" onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] overflow-hidden rounded-xl border bg-background shadow-2xl">
        <header className="relative bg-primary p-5 text-primary-foreground"><Button type="button" variant="ghost" size="icon" aria-label="বন্ধ করুন" onClick={() => setContactOpen(false)} className="absolute right-3 top-3 text-primary-foreground hover:bg-primary-foreground/15"><X/></Button><div className="flex items-center gap-3"><SafeImage src={logoUrl} alt="Sheikh Seeds logo" className="h-12 w-12 rounded-lg bg-background object-contain p-1"/><div><h2 className="text-lg font-extrabold">Sheikh Seeds</h2><p className="text-xs opacity-80">কীভাবে সাহায্য করতে পারি?</p></div></div></header>
        <div className="space-y-3 p-4">
          <button type="button" onClick={() => { setContactOpen(false); setChatOpen(true); }} className="flex w-full items-center gap-3 rounded-lg border bg-accent p-3 text-left transition hover:border-primary"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Headset/></span><span className="flex-1"><b className="block">লাইভ চ্যাট</b><small className="text-muted-foreground">লিখে, ছবি বা ভয়েসে সাহায্য নিন</small></span><ArrowUpRight className="text-primary"/></button>
          {contactPhone && <a href={phoneHref} onClick={() => trackContact({ method: "phone" })} className="flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary"><Phone/></span><span className="flex-1"><b className="block">কল করুন</b><small className="text-muted-foreground">{contactPhone}</small></span><ArrowUpRight/></a>}
          {messengerUrl && <a href={messengerUrl} target="_blank" rel="noreferrer" onClick={() => trackContact({ method: "messenger" })} className="flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary"><MessageCircle/></span><span className="flex-1"><b className="block">Messenger</b><small className="text-muted-foreground">Facebook Messenger-এ মেসেজ করুন</small></span><ArrowUpRight/></a>}
        </div>
      </div>
    </div>}

    {chatOpen && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-foreground/55 p-3 backdrop-blur-sm sm:p-5" onClick={() => setChatOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Sheikh Seeds লাইভ চ্যাট" onClick={(e) => e.stopPropagation()} className="flex h-[min(680px,82dvh)] min-h-[480px] w-full max-w-[440px] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl ring-1 ring-primary/10">
        <header className="relative flex shrink-0 items-center gap-3 border-b bg-primary px-4 py-3.5 text-primary-foreground">
          <div className="relative"><SafeImage src={logoUrl} alt="Sheikh Seeds logo" className="h-11 w-11 rounded-lg bg-background object-contain p-1 shadow-sm"/><span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-primary bg-chart-2"/></div>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><h2 className="truncate text-base font-extrabold">Sheikh Seeds</h2><BadgeCheck className="h-4 w-4 text-chart-4" aria-label="Verified"/></div><p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium opacity-90"><span className="h-1.5 w-1.5 rounded-full bg-chart-2"/>অনলাইন • দ্রুত উত্তর</p></div>
          {chatMessages.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={resetChat} className="h-8 gap-1 px-2 text-[11px] font-bold text-primary-foreground hover:bg-primary-foreground/15"><RotateCcw className="h-3.5 w-3.5"/>নতুন চ্যাট</Button>}
          <Button type="button" variant="ghost" size="icon" aria-label="বন্ধ করুন" onClick={() => setChatOpen(false)} className="text-primary-foreground hover:bg-primary-foreground/15"><X/></Button>
        </header>

        <Conversation className="min-h-0 bg-muted/30"><ConversationContent className="gap-4 p-4">
          {chatMessages.map((message, index) => <Message from={message.role} key={`${message.role}-${index}`}>
            {message.role === "assistant" && <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground"><SafeImage src={logoUrl} alt="" className="h-5 w-5 rounded object-contain"/>Sheikh Seeds <BadgeCheck className="h-3.5 w-3.5 text-primary"/></div>}
            <MessageContent className={message.role === "user" ? "rounded-lg bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sm" : "max-w-[92%] rounded-lg border bg-background px-3.5 py-3 shadow-sm"}>
              {message.attachments?.length ? <Attachments variant="grid">{message.attachments.map((file, fileIndex) => <Attachment key={`${file.filename}-${fileIndex}`} data={{ ...file, id: `${index}-${fileIndex}` }}><AttachmentPreview/></Attachment>)}</Attachments> : null}
              {message.text && (message.role === "assistant" ? <MessageResponse>{message.text}</MessageResponse> : <p className="whitespace-pre-wrap text-sm">{message.text}</p>)}
            </MessageContent>
            {message.products?.length ? <div className="flex max-w-full gap-2 overflow-x-auto pb-1">{message.products.map((product) => { const price = product.sale_price ?? product.price; return <Link key={product.id} to="/product/$slug" params={{ slug: product.slug }} className="w-36 shrink-0 overflow-hidden rounded-lg border bg-card shadow-sm transition hover:border-primary"><div className="aspect-square bg-muted">{product.images?.[0] ? <SafeImage src={product.images[0]} alt={product.name} loading="lazy" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center"><ImageIcon className="text-muted-foreground"/></div>}</div><div className="p-2"><p className="line-clamp-2 text-xs font-bold">{product.name}</p><p className="mt-1 text-sm font-black text-primary">৳{price}</p><span className="text-[10px] text-muted-foreground">{product.stock > 0 ? "স্টকে আছে" : "স্টক শেষ"}</span></div></Link>; })}</div> : null}
            {message.orderId && <Link to="/order/$id" params={{ id: message.orderId }} className="inline-flex w-fit items-center gap-1 rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs font-bold text-primary">অর্ডার {message.invoiceNo ? `#${message.invoiceNo}` : ""} দেখুন <ArrowUpRight className="h-3.5 w-3.5"/></Link>}
          </Message>)}
          {chatMessages.length === 1 && <div className="flex flex-wrap gap-2">{QUICK_PROMPTS.map((prompt) => <Button key={prompt} type="button" variant="outline" size="sm" className="h-8 rounded-full bg-background px-3 text-[11px] font-semibold shadow-sm" onClick={() => void handleSubmit({ text: prompt, files: [] })}>{prompt}</Button>)}</div>}
          {chatSending && <Message from="assistant"><MessageContent className="rounded-lg border bg-background px-3.5 py-3 shadow-sm"><Shimmer>উত্তর দিচ্ছে...</Shimmer></MessageContent></Message>}
        </ConversationContent><ConversationScrollButton className="bottom-2"/></Conversation>

        <div className="shrink-0 border-t bg-background p-3 shadow-[0_-8px_24px_-20px_var(--foreground)]">
          {voiceAttachment && !recording && <div className="mb-2 flex items-center justify-between rounded-lg border bg-accent px-3 py-2 text-xs"><span className="flex items-center gap-2"><Mic className="h-4 w-4 text-primary"/>ভয়েস মেসেজ প্রস্তুত</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setVoiceAttachment(null); setRecording(false); }}><X/></Button></div>}
          <PromptInput accept="image/jpeg,image/png,image/webp" maxFiles={2} maxFileSize={5_000_000} onError={(error) => toast.error(error.code === "max_file_size" ? "ছবিটি ৫ MB-এর মধ্যে দিন" : "সর্বোচ্চ ২টি JPG, PNG বা WebP ছবি দিন")} onSubmit={handleSubmit}>
            <AttachmentStrip/>
            <PromptInputTextarea autoFocus disabled={chatSending} placeholder="আপনার প্রশ্ন লিখুন..." className="min-h-14 text-sm"/>
            <PromptInputFooter><PromptInputTools><PromptInputButton tooltip="ছবি দিন" onClick={() => document.querySelector<HTMLInputElement>('input[aria-label="Upload files"]')?.click()}><ImageIcon/></PromptInputButton><PromptInputButton tooltip={recording ? "রেকর্ডিং বন্ধ করুন" : "ভয়েস রেকর্ড করুন"} onClick={() => void toggleRecording()} className={recording ? "text-destructive" : ""}>{recording ? <Square/> : <Mic/>}</PromptInputButton>{recording && <span className="text-xs font-bold text-destructive">রেকর্ডিং...</span>}</PromptInputTools><PromptInputSubmit status={chatSending ? "submitted" : "ready"} disabled={chatSending} className="bg-primary text-primary-foreground"><Send/></PromptInputSubmit></PromptInputFooter>
          </PromptInput>
          <p className="mt-1.5 text-center text-[9px] text-muted-foreground">গুরুত্বপূর্ণ কৃষি প্রয়োগের আগে পণ্যের লেবেল যাচাই করুন</p>
        </div>
      </section>
    </div>}
  </>;
}
