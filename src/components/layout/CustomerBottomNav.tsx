import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, BadgeCheck, Headset, Home, Image as ImageIcon, Mic, PackageSearch, Phone, Send, Square, Tag, UserRound, MessageCircle, X } from "lucide-react";
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

const INTRO = "আসসালামু আলাইকুম! আমি Sheikh Seeds-এর লাইভ সহকারী। বীজ, গাছের সমস্যা বা অর্ডার—লিখে, ছবি তুলে কিংবা ভয়েসে বলুন।";
const filePayload = (file: ChatAttachment) => {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(file.url);
  return match ? { mediaType: match[1], data: match[2], name: file.filename } : null;
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
    let lastY = window.scrollY;
    let ticking = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setMinimized(false), 180);
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { const y = window.scrollY; setMinimized(y > 40 && y > lastY + 5); if (y < lastY - 7) setMinimized(false); lastY = y; ticking = false; });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (timer) clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!contactOpen && !chatOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setContactOpen(false); setChatOpen(false); } };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [contactOpen, chatOpen]);

  const toggleRecording = async () => {
    if (recording) { recorderRef.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return toast.error("এই ব্রাউজারে ভয়েস রেকর্ডিং নেই");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => { if (typeof reader.result === "string") setVoiceAttachment({ type: "file", url: reader.result, mediaType: blob.type, filename: "voice-message.webm" }); setRecording(false); };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorderRef.current = recorder; recorder.start(); setRecording(true);
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
    const history = chatMessages.slice(-14).map((item) => ({ direction: item.role === "user" ? "in" as const : "out" as const, text: item.text }));
    setVoiceAttachment(null);
    setChatMessages((previous) => [...previous, { role: "user", text, attachments: visibleAttachments }]);
    setChatSending(true);
    try {
      const result = await sendWebsiteAiChat({ data: { incoming: text, history, attachments: payload } });
      setChatMessages((previous) => [...previous, { role: "assistant", text: result.text, products: result.products, orderId: result.orderId, invoiceNo: result.invoiceNo }]);
    } catch (error) {
      console.error("Website AI chat failed", error);
      setChatMessages((previous) => [...previous, { role: "assistant", text: error instanceof Error ? error.message : "দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করুন।" }]);
    } finally { setChatSending(false); }
  };

  if (!initialized) return null;
  const itemClass = "group relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary active:scale-95 sm:h-13";
  const phoneHref = contactPhone ? `tel:${contactPhone.replace(/[^+\d]/g, "")}` : "";

  return <>
    <nav aria-label="কাস্টমার নেভিগেশন" aria-hidden={hidden} className={`fixed inset-x-2 bottom-[max(7px,env(safe-area-inset-bottom))] z-30 mx-auto max-w-[500px] rounded-xl border bg-background/95 p-1.5 shadow-xl backdrop-blur-xl transition duration-300 ${minimized ? "translate-y-1 scale-[.99]" : ""} ${hidden ? "translate-y-[150%] opacity-0 pointer-events-none" : ""}`}>
      <div className="flex items-center gap-0.5">
        <Link to="/shop" className={itemClass}><PackageSearch className="h-5 w-5"/><span className="mt-1 text-[9px] font-extrabold">সকল পণ্য</span></Link>
        <Link to="/offers" className={itemClass}><Tag className="h-5 w-5"/><span className="mt-1 text-[9px] font-extrabold">অফার</span></Link>
        <Link to="/" activeOptions={{ exact: true }} className="flex h-13 w-16 shrink-0 flex-col items-center justify-center text-primary active:scale-95"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"><Home className="h-5 w-5"/></span><span className="mt-0.5 text-[9px] font-extrabold">হোম</span></Link>
        <button type="button" onClick={() => setContactOpen(true)} className={itemClass}><Headset className="h-5 w-5"/><span className="mt-1 text-[9px] font-extrabold">যোগাযোগ</span></button>
        <Link to="/profile" className={itemClass}><UserRound className="h-5 w-5"/><span className="mt-1 text-[9px] font-extrabold">অ্যাকাউন্ট</span></Link>
      </div>
    </nav>

    {contactOpen && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/55 p-4 backdrop-blur-sm" onClick={() => setContactOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="যোগাযোগ করুন" onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] overflow-hidden rounded-xl border bg-background shadow-2xl">
        <header className="relative bg-primary p-5 text-primary-foreground"><Button type="button" variant="ghost" size="icon" aria-label="বন্ধ করুন" onClick={() => setContactOpen(false)} className="absolute right-3 top-3 text-primary-foreground hover:bg-primary-foreground/15"><X/></Button><div className="flex items-center gap-3"><img src={logoUrl} alt="Sheikh Seeds logo" className="h-12 w-12 rounded-lg bg-background object-contain p-1"/><div><h2 className="text-lg font-extrabold">Sheikh Seeds</h2><p className="text-xs opacity-80">কীভাবে সাহায্য করতে পারি?</p></div></div></header>
        <div className="space-y-3 p-4">
          <button type="button" onClick={() => { setContactOpen(false); setChatOpen(true); }} className="flex w-full items-center gap-3 rounded-lg border bg-accent p-3 text-left transition hover:border-primary"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Headset/></span><span className="flex-1"><b className="block">লাইভ চ্যাট</b><small className="text-muted-foreground">লিখে, ছবি বা ভয়েসে সাহায্য নিন</small></span><ArrowUpRight className="text-primary"/></button>
          {contactPhone && <a href={phoneHref} onClick={() => trackContact({ method: "phone" })} className="flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary"><Phone/></span><span className="flex-1"><b className="block">কল করুন</b><small className="text-muted-foreground">{contactPhone}</small></span><ArrowUpRight/></a>}
          {messengerUrl && <a href={messengerUrl} target="_blank" rel="noreferrer" onClick={() => trackContact({ method: "messenger" })} className="flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary"><MessageCircle/></span><span className="flex-1"><b className="block">Messenger</b><small className="text-muted-foreground">Facebook Messenger-এ মেসেজ করুন</small></span><ArrowUpRight/></a>}
        </div>
      </div>
    </div>}

    {chatOpen && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-foreground/55 p-3 backdrop-blur-sm sm:p-5" onClick={() => setChatOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Sheikh Seeds লাইভ চ্যাট" onClick={(e) => e.stopPropagation()} className="flex h-[min(680px,82dvh)] min-h-[480px] w-full max-w-[440px] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
        <header className="relative flex shrink-0 items-center gap-3 border-b bg-primary px-4 py-3 text-primary-foreground">
          <div className="relative"><img src={logoUrl} alt="Sheikh Seeds logo" className="h-11 w-11 rounded-lg bg-background object-contain p-1"/><span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-primary bg-chart-2"/></div>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-1"><h2 className="truncate text-base font-extrabold">Sheikh Seeds</h2><BadgeCheck className="h-4 w-4 text-chart-4" aria-label="Verified"/></div><p className="text-[11px] opacity-80">অনলাইন • সাধারণত কয়েক সেকেন্ডে উত্তর দেয়</p></div>
          <Button type="button" variant="ghost" size="icon" aria-label="বন্ধ করুন" onClick={() => setChatOpen(false)} className="text-primary-foreground hover:bg-primary-foreground/15"><X/></Button>
        </header>

        <Conversation className="min-h-0 bg-muted/40"><ConversationContent className="gap-4 p-4">
          {chatMessages.map((message, index) => <Message from={message.role} key={`${message.role}-${index}`}>
            {message.role === "assistant" && <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground"><img src={logoUrl} alt="" className="h-5 w-5 rounded object-contain"/>Sheikh Seeds <BadgeCheck className="h-3.5 w-3.5 text-primary"/></div>}
            <MessageContent className={message.role === "user" ? "rounded-lg bg-primary px-3 py-2.5 text-primary-foreground" : "max-w-[92%]"}>
              {message.attachments?.length ? <Attachments variant="grid">{message.attachments.map((file, fileIndex) => <Attachment key={`${file.filename}-${fileIndex}`} data={{ ...file, id: `${index}-${fileIndex}` }}><AttachmentPreview/></Attachment>)}</Attachments> : null}
              {message.text && (message.role === "assistant" ? <MessageResponse>{message.text}</MessageResponse> : <p className="whitespace-pre-wrap text-sm">{message.text}</p>)}
            </MessageContent>
            {message.products?.length ? <div className="flex max-w-full gap-2 overflow-x-auto pb-1">{message.products.map((product) => { const price = product.sale_price ?? product.price; return <Link key={product.id} to="/product/$slug" params={{ slug: product.slug }} className="w-36 shrink-0 overflow-hidden rounded-lg border bg-card shadow-sm transition hover:border-primary"><div className="aspect-square bg-muted">{product.images?.[0] ? <img src={product.images[0]} alt={product.name} loading="lazy" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center"><ImageIcon className="text-muted-foreground"/></div>}</div><div className="p-2"><p className="line-clamp-2 text-xs font-bold">{product.name}</p><p className="mt-1 text-sm font-black text-primary">৳{price}</p><span className="text-[10px] text-muted-foreground">{product.stock > 0 ? "স্টকে আছে" : "স্টক শেষ"}</span></div></Link>; })}</div> : null}
            {message.orderId && <Link to="/order/$id" params={{ id: message.orderId }} className="inline-flex w-fit items-center gap-1 rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs font-bold text-primary">অর্ডার {message.invoiceNo ? `#${message.invoiceNo}` : ""} দেখুন <ArrowUpRight className="h-3.5 w-3.5"/></Link>}
          </Message>)}
          {chatSending && <Message from="assistant"><MessageContent><Shimmer>Sheikh Seeds উত্তর তৈরি করছে...</Shimmer></MessageContent></Message>}
        </ConversationContent><ConversationScrollButton className="bottom-2"/></Conversation>

        <div className="shrink-0 border-t bg-background p-3">
          {voiceAttachment && !recording && <div className="mb-2 flex items-center justify-between rounded-lg border bg-accent px-3 py-2 text-xs"><span className="flex items-center gap-2"><Mic className="h-4 w-4 text-primary"/>ভয়েস মেসেজ প্রস্তুত</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setVoiceAttachment(null); setRecording(false); }}><X/></Button></div>}
          <PromptInput accept="image/jpeg,image/png,image/webp" maxFiles={2} maxFileSize={5_000_000} onError={(error) => toast.error(error.code === "max_file_size" ? "ছবিটি ৫ MB-এর মধ্যে দিন" : "সর্বোচ্চ ২টি JPG, PNG বা WebP ছবি দিন")} onSubmit={handleSubmit}>
            <AttachmentStrip/>
            <PromptInputTextarea autoFocus disabled={chatSending} placeholder="মেসেজ লিখুন বা ছবি/ভয়েস দিন..." className="min-h-14 text-sm"/>
            <PromptInputFooter><PromptInputTools><PromptInputButton tooltip="ছবি দিন" onClick={() => document.querySelector<HTMLInputElement>('input[aria-label="Upload files"]')?.click()}><ImageIcon/></PromptInputButton><PromptInputButton tooltip={recording ? "রেকর্ডিং বন্ধ করুন" : "ভয়েস রেকর্ড করুন"} onClick={() => void toggleRecording()} className={recording ? "text-destructive" : ""}>{recording ? <Square/> : <Mic/>}</PromptInputButton>{recording && <span className="text-xs font-bold text-destructive">রেকর্ডিং...</span>}</PromptInputTools><PromptInputSubmit status={chatSending ? "submitted" : "ready"} disabled={chatSending} className="bg-primary text-primary-foreground"><Send/></PromptInputSubmit></PromptInputFooter>
          </PromptInput>
          <p className="mt-1.5 text-center text-[9px] text-muted-foreground">AI উত্তর ভুল হতে পারে—কৃষি প্রয়োগের আগে লেবেল ও বিশেষজ্ঞের পরামর্শ অনুসরণ করুন</p>
        </div>
      </section>
    </div>}
  </>;
}
