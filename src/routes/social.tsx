import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { useCustomer, db } from "@/lib/customer-account";
import { Heart, MessageCircle, Send, Loader2, MoreHorizontal, Trash2, Image as ImageIcon, Plus, Smile, Share2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/social")({
  component: SocialPage,
  head: () => ({ meta: [
    { title: "কমিউনিটি — Sheikh Seeds" },
    { name: "description", content: "বাগানিদের সোশ্যাল কমিউনিটি — পোস্ট, রিয়েক্ট, কমেন্ট, স্টোরি ও শেয়ার করুন।" },
  ] }),
});

type Post = { id:string; user_id:string|null; author_name:string; author_avatar?:string|null; body:string; image_urls?:string[]; like_count:number; comment_count:number; created_at:string };
type Reaction = { post_id:string; user_id:string; reaction:string };
type Comment = { id:string; post_id:string; user_id:string|null; author_name:string; body:string; parent_id:string|null; created_at:string };
type Story = { id:string; user_id:string|null; author_name:string; author_avatar?:string|null; body:string|null; image_url:string|null; created_at:string; expires_at:string };

const REACTIONS = [
  ["like", "👍"], ["love", "❤️"], ["haha", "😂"], ["wow", "😮"], ["sad", "😢"], ["angry", "😡"],
] as const;
const reactionEmoji = (r?:string|null) => REACTIONS.find(([key]) => key === r)?.[1] ?? "👍";
function timeAgoBn(iso:string) {
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "এইমাত্র";
  if (diff < 3600) return `${Math.floor(diff/60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff/3600)} ঘণ্টা আগে`;
  return new Date(iso).toLocaleDateString("bn-BD", {day:"numeric", month:"short"});
}
function Avatar({name, src, size="md"}:{name:string;src?:string|null;size?:"sm"|"md"|"lg"}) {
  const cls = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10";
  return src ? <img src={src} alt="" className={`${cls} rounded-full object-cover ring-1 ring-black/5`} /> :
    <div className={`${cls} rounded-full bg-gradient-to-br from-emerald-100 to-green-200 text-emerald-800 font-bold flex items-center justify-center shrink-0`}>{name?.slice(0,1) || "🌱"}</div>;
}

function SocialPage() {
  const { user, isLoggedIn, displayName, profile } = useCustomer();
  const qc = useQueryClient();
  const [body,setBody] = useState("");
  const [mediaUrl,setMediaUrl] = useState("");
  const [busy,setBusy] = useState(false);
  const [storyOpen,setStoryOpen] = useState(false);
  const [storyText,setStoryText] = useState("");
  const [storyImage,setStoryImage] = useState("");

  const postsQ = useQuery({ queryKey:["social-posts"], staleTime:15000, queryFn:async()=>{
    const {data,error}=await db.from("social_posts").select("id,user_id,author_name,author_avatar,body,image_urls,like_count,comment_count,created_at").eq("status","approved").order("created_at",{ascending:false}).limit(50);
    if(error) throw error; return (data??[]) as Post[];
  }});
  const storiesQ = useQuery({ queryKey:["social-stories"], staleTime:15000, queryFn:async()=>{
    const {data}=await db.from("social_stories").select("id,user_id,author_name,author_avatar,body,image_url,created_at,expires_at").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(30); return (data??[]) as Story[];
  }});
  const reactionsQ = useQuery({ queryKey:["social-reactions",postsQ.data?.map(p=>p.id).join(",")], enabled:!!postsQ.data?.length, queryFn:async()=>{
    const ids=(postsQ.data??[]).map(p=>p.id); const {data}=await db.from("social_post_reactions").select("post_id,user_id,reaction").in("post_id",ids); return (data??[]) as Reaction[];
  }});

  const createPost=async()=>{
    if(!user) return toast.error("পোস্ট করতে লগইন করুন");
    if(!body.trim() && !mediaUrl.trim()) return toast.error("কিছু লিখুন বা ছবি/মিডিয়া লিংক দিন");
    setBusy(true);
    const {error}=await db.from("social_posts").insert({user_id:user.id,author_name:displayName,author_avatar:profile?.avatar_url||null,body:body.trim()||"",image_urls:mediaUrl.trim()?[mediaUrl.trim()]:[]});
    setBusy(false); if(error) return toast.error(error.message); setBody(""); setMediaUrl(""); toast.success("পোস্ট প্রকাশিত হয়েছে"); qc.invalidateQueries({queryKey:["social-posts"]});
  };
  const createStory=async()=>{
    if(!user || (!storyText.trim()&&!storyImage.trim())) return;
    const {error}=await db.from("social_stories").insert({user_id:user.id,author_name:displayName,author_avatar:profile?.avatar_url||null,body:storyText.trim()||null,image_url:storyImage.trim()||null});
    if(error) return toast.error(error.message); setStoryText("");setStoryImage("");setStoryOpen(false);toast.success("স্টোরি যোগ হয়েছে");qc.invalidateQueries({queryKey:["social-stories"]});
  };
  const myReaction=(postId:string)=>reactionsQ.data?.find(r=>r.post_id===postId&&r.user_id===user?.id)?.reaction;
  const reactionCount=(postId:string)=>reactionsQ.data?.filter(r=>r.post_id===postId).length ?? 0;
  const share=async(p:Post)=>{ const url=`${window.location.origin}/social#${p.id}`; try{await navigator.clipboard.writeText(url);toast.success("পোস্টের লিংক কপি হয়েছে")}catch{toast.info(url)} };

  return <SiteLayout>
    <div className="min-h-screen bg-[#f0f2f5] pb-10">
      <div className="mx-auto w-full max-w-2xl px-0 sm:px-3 pt-0 sm:pt-4">
        <div className="bg-white sm:rounded-2xl border-b sm:border border-black/5 px-3 py-3 mb-2 sm:mb-3">
          <div className="flex items-center justify-between"><div><h1 className="text-xl font-extrabold text-slate-900">কমিউনিটি</h1><p className="text-xs text-slate-500">বাগানিদের সাথে গল্প, অভিজ্ঞতা ও অনুপ্রেরণা 🌱</p></div><button onClick={()=>setStoryOpen(true)} className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-2 text-sm font-bold flex gap-1.5 items-center"><Plus className="w-4 h-4"/> Story</button></div>
        </div>
        <div className="bg-white border-b sm:border border-black/5 sm:rounded-2xl p-3 mb-2 sm:mb-3">
          <div className="flex gap-2.5"><Avatar name={displayName} src={profile?.avatar_url}/><button onClick={()=>isLoggedIn&&document.getElementById("community-composer")?.focus()} className="flex-1 text-left bg-[#f0f2f5] rounded-full px-4 text-sm text-slate-500">{isLoggedIn?`${displayName}, আজ কী শেয়ার করবেন?`:"পোস্ট করতে লগইন করুন"}</button></div>
          {isLoggedIn && <div className="mt-3 border-t pt-2.5 flex gap-1.5"><button onClick={()=>document.getElementById("community-composer")?.focus()} className="flex-1 flex justify-center gap-1.5 items-center rounded-lg py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><ImageIcon className="w-5 h-5 text-emerald-600"/> Photo / Video</button><button onClick={()=>setStoryOpen(true)} className="flex-1 flex justify-center gap-1.5 items-center rounded-lg py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Smile className="w-5 h-5 text-amber-500"/> Story</button></div>}
        </div>

        {storyOpen && <div className="bg-white border-b sm:border sm:rounded-2xl p-3 mb-2 sm:mb-3"><div className="flex items-center justify-between mb-2"><b>নতুন Story</b><button onClick={()=>setStoryOpen(false)}><X className="w-5 h-5"/></button></div><textarea value={storyText} onChange={e=>setStoryText(e.target.value)} rows={2} placeholder="স্টোরিতে কিছু লিখুন..." className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none"/><input value={storyImage} onChange={e=>setStoryImage(e.target.value)} placeholder="ছবির URL (ঐচ্ছিক)" className="w-full mt-2 bg-slate-50 rounded-xl p-3 text-sm outline-none"/><button onClick={createStory} className="mt-2 w-full bg-emerald-600 text-white rounded-xl py-2.5 font-bold">Story শেয়ার করুন</button></div>}

        {(storiesQ.data??[]).length>0 && <div className="bg-white border-b sm:border sm:rounded-2xl p-3 mb-2 sm:mb-3"><div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">{(storiesQ.data??[]).map(s=><button key={s.id} className="w-[72px] shrink-0 text-center" onClick={()=>alert(s.body||"Story")}><div className="mx-auto rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-fuchsia-500 to-emerald-500 w-16 h-16"><div className="bg-white rounded-full p-[2px] w-full h-full"><Avatar name={s.author_name} src={s.author_avatar} size="lg"/></div></div><span className="block truncate mt-1 text-xs font-semibold">{s.author_name}</span></button>)}</div></div>}

        <div className="space-y-2 sm:space-y-3">
          {isLoggedIn && <div className="bg-white border-b sm:border sm:rounded-2xl p-3"><textarea id="community-composer" value={body} onChange={e=>setBody(e.target.value)} rows={2} placeholder={`${displayName}, আপনার বাগানের গল্প লিখুন...`} className="w-full outline-none resize-none text-[15px]"/><input value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)} placeholder="ছবি/ভিডিও URL (ঐচ্ছিক)" className="w-full mt-1 bg-slate-50 rounded-xl px-3 py-2 text-xs outline-none"/><div className="flex justify-end mt-2"><button onClick={createPost} disabled={busy} className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold text-sm flex gap-2 items-center disabled:opacity-50">{busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>} পোস্ট করুন</button></div></div>}
          {postsQ.isLoading?<div className="bg-white p-10 text-center text-slate-500">লোড হচ্ছে...</div>:postsQ.data?.length===0?<div className="bg-white p-10 text-center text-slate-500">এখনো কোনো পোস্ট নেই 🌱</div>:postsQ.data?.map(p=><PostCard key={p.id} post={p} userId={user?.id} displayName={displayName} liked={!!myReaction(p.id)} myReaction={myReaction(p.id)} reactionCount={reactionCount(p.id)} reactions={reactionsQ.data?.filter(r=>r.post_id===p.id)??[]} onReaction={async r=>{if(!user)return toast.error("রিয়েক্ট করতে লগইন করুন");const current=myReaction(p.id);if(current===r){await db.from("social_post_reactions").delete().eq("post_id",p.id).eq("user_id",user.id)}else{await db.from("social_post_reactions").upsert({post_id:p.id,user_id:user.id,reaction:r},{onConflict:"post_id,user_id"})}qc.invalidateQueries({queryKey:["social-reactions"]});}} onDelete={async()=>{if(p.user_id!==user?.id)return;await db.from("social_posts").delete().eq("id",p.id);qc.invalidateQueries({queryKey:["social-posts"])}}} onShare={()=>share(p)}/>)}</div>
      </div>
    </div>
  </SiteLayout>;
}

function PostCard({post,userId,displayName,myReaction,reactionCount,reactions,onReaction,onDelete,onShare}:{post:Post;userId?:string;displayName:string;liked:boolean;myReaction?:string;reactionCount:number;reactions:Reaction[];onReaction:(r:string)=>void;onDelete:()=>void;onShare:()=>void}) {
  const qc=useQueryClient(); const [open,setOpen]=useState(false); const [picker,setPicker]=useState(false); const [text,setText]=useState(""); const [replyTo,setReplyTo]=useState<string|null>(null);
  const commentsQ=useQuery({queryKey:["social-comments",post.id],enabled:open,queryFn:async()=>{const {data}=await db.from("social_post_comments").select("id,post_id,user_id,author_name,body,parent_id,created_at").eq("post_id",post.id).eq("status","approved").order("created_at",{ascending:true});return (data??[]) as Comment[]}});
  const addComment=async()=>{if(!userId||!text.trim())return toast.error("কমেন্ট করতে লগইন করুন");const {error}=await db.from("social_post_comments").insert({post_id:post.id,user_id:userId,author_name:displayName,body:text.trim(),parent_id:replyTo});if(error)return toast.error(error.message);setText("");setReplyTo(null);qc.invalidateQueries({queryKey:["social-comments",post.id]});qc.invalidateQueries({queryKey:["social-posts"]})};
  const roots=useMemo(()=>commentsQ.data?.filter(c=>!c.parent_id)??[],[commentsQ.data]); const replies=(id:string)=>commentsQ.data?.filter(c=>c.parent_id===id)??[];
  const image=post.image_urls?.[0];
  return <article className="bg-white border-b sm:border sm:rounded-2xl overflow-hidden">
    <div className="p-3 pb-2"><div className="flex items-center gap-2.5"><Avatar name={post.author_name} src={post.author_avatar}/><div className="flex-1 min-w-0"><div className="font-bold text-[14px] truncate">{post.author_name}</div><div className="text-[11px] text-slate-500">{timeAgoBn(post.created_at)} · 🌱</div></div><button className="p-1.5 text-slate-500"><MoreHorizontal className="w-5 h-5"/></button>{post.user_id===userId&&<button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>}</div><p className="mt-2.5 whitespace-pre-wrap text-[15px] leading-6">{post.body}</p></div>
    {image&&<img src={image} alt="" className="w-full max-h-[560px] object-cover bg-slate-100" loading="lazy"/>}
    <div className="px-3 pt-2 pb-1 flex items-center justify-between text-xs text-slate-500"><span>{reactionCount>0&&<span>{[...new Set(reactions.map(r=>reactionEmoji(r.reaction)))].slice(0,3).join(" ")} {reactionCount}</span>}</span><span>{post.comment_count?`${post.comment_count} কমেন্ট`:""}</span></div>
    <div className="mx-3 border-t flex relative"><div className="flex-1"><button onClick={()=>onReaction(myReaction||"like")} onContextMenu={e=>{e.preventDefault();setPicker(v=>!v)}} className={`w-full py-2.5 flex items-center justify-center gap-1.5 text-sm font-semibold ${myReaction?"text-emerald-600":"text-slate-600"}`}><span className="text-lg">{reactionEmoji(myReaction)}</span>{myReaction?REACTONS_LABEL(myReaction):"রিয়েক্ট"}</button>{picker&&<div className="absolute bottom-11 left-1 flex gap-1 bg-white shadow-xl border rounded-full px-2 py-1.5 z-10">{REACTIONS.map(([r,e])=><button key={r} onClick={()=>{onReaction(r);setPicker(false)}} className="text-xl hover:scale-125 transition">{e}</button>)}</div>}</div><button onClick={()=>setOpen(v=>!v)} className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-600"><MessageCircle className="w-4.5 h-4.5"/> কমেন্ট</button><button onClick={onShare} className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-600"><Share2 className="w-4 h-4"/> শেয়ার</button></div>
    {open&&<div className="border-t bg-slate-50/70 p-3"><div className="space-y-2">{roots.map(c=><div key={c.id}><div className="flex gap-2"><Avatar name={c.author_name} size="sm"/><div className="bg-white rounded-2xl px-3 py-2 shadow-sm"><b className="text-xs">{c.author_name}</b><p className="text-sm mt-0.5">{c.body}</p></div></div><button onClick={()=>setReplyTo(c.id)} className="ml-10 mt-0.5 text-[11px] font-bold text-slate-500">Reply</button>{replies(c.id).map(r=><div key={r.id} className="ml-10 mt-1.5 flex gap-2"><Avatar name={r.author_name} size="sm"/><div className="bg-white rounded-2xl px-3 py-2 shadow-sm"><b className="text-xs">{r.author_name}</b><p className="text-sm">{r.body}</p></div></div>)}</div>)}{commentsQ.data?.length===0&&<div className="text-xs text-slate-500">এখনো কোনো কমেন্ট নেই।</div>}</div><div className="flex gap-2 mt-3"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addComment()} placeholder={replyTo?"রিপ্লাই লিখুন...":"কমেন্ট লিখুন..."} className="flex-1 rounded-full bg-white border px-4 py-2 text-sm outline-none"/><button onClick={addComment} className="rounded-full bg-emerald-600 text-white p-2.5"><Send className="w-4 h-4"/></button></div>{replyTo&&<button onClick={()=>setReplyTo(null)} className="text-[11px] text-red-500 mt-1">রিপ্লাই বাতিল</button>}</div>}
  </article>;
}
function REACTONS_LABEL(r:string){return ({like:"লাইক",love:"লাভ",haha:"হাহা",wow:"ওয়াও",sad:"স্যাড",angry:"রাগ"} as Record<string,string>)[r]||"রিয়েক্ট"}
