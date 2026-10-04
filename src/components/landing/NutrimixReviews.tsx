import { SafeImage } from "@/components/SafeImage";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toImg } from "@/lib/img";
type Review = { name: string; rating: number; text: string; image?: string };
export function NutrimixReviews({ reviews, themeColor }: { reviews: Review[]; themeColor?: string }) {
  const [index, setIndex] = useState(0); const accent = themeColor || "#15803d";
  useEffect(() => { if (reviews.length < 2) return; const timer = window.setInterval(() => setIndex((current) => (current + 1) % reviews.length), 4200); return () => window.clearInterval(timer); }, [reviews.length]);
  if (!reviews.length) return null;
  return <section className="container mx-auto max-w-3xl px-3 py-7 sm:py-9" aria-label="কাস্টমার রিভিউ">
    <div className="mb-5 text-center"><span className="inline-flex rounded-full border px-3 py-1 text-[10px] font-extrabold tracking-wide" style={{ color: accent, borderColor: accent + "30", background: accent + "0B" }}>কাস্টমার রিভিউ</span><h2 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">NUTRIMIX ব্যবহারকারীদের অভিজ্ঞতা</h2><div className="mx-auto mt-2 h-1 w-12 rounded-full" style={{ background: accent }} /></div>
    <div className="relative overflow-hidden rounded-3xl border bg-white shadow-[0_12px_40px_rgba(15,23,42,0.10)]" style={{ borderColor: accent + "20" }}>
      <div className="relative h-[185px] sm:h-[175px]">{reviews.map((review, i) => { const active=i===index; const previous=i===(index-1+reviews.length)%reviews.length; return <article key={`${review.name}-${i}`} aria-hidden={!active} className={`absolute inset-0 flex flex-col justify-between px-5 py-5 sm:px-8 transition-all duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${active?"opacity-100 translate-x-0 scale-100":previous?"opacity-0 -translate-x-16 scale-[0.98]":"pointer-events-none opacity-0 translate-x-16 scale-[0.98]"}`}>
        <div><div className="flex items-center justify-center gap-1">{Array.from({length:5}).map((_,s)=><Star key={s} className="h-4 w-4" fill={s<review.rating?"currentColor":"none"} strokeWidth={1.8} style={{color:s<review.rating?"#f59e0b":"#cbd5e1"}}/>)}<span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{review.rating}.0</span></div><p className="mx-auto mt-3 max-w-2xl text-center text-[13px] font-medium leading-6 text-slate-700 sm:text-[14px]">“{review.text}”</p></div>
        <div className="flex items-center justify-center gap-2 border-t border-slate-100 pt-3">{review.image?<SafeImage src={toImg(review.image,{w:80,q:78})} alt={review.name} width={34} height={34} loading="lazy" className="h-[34px] w-[34px] rounded-full object-cover ring-2 ring-white shadow-sm"/>:<span className="grid h-[34px] w-[34px] place-items-center rounded-full text-xs font-extrabold text-white" style={{background:accent}}>{review.name?.charAt(0)||"★"}</span>}<div className="text-left"><div className="text-xs font-bold text-slate-800">{review.name}</div><div className="mt-0.5 text-[9px] font-semibold text-slate-400">NUTRIMIX ব্যবহারকারী</div></div></div>
      </article>})}</div>
      {reviews.length>1&&<div className="flex justify-center gap-1.5 border-t border-slate-100 bg-slate-50/70 py-2">{reviews.map((_,d)=><button key={d} type="button" onClick={()=>setIndex(d)} aria-label={`রিভিউ ${d+1}`} className="h-1.5 rounded-full transition-all duration-500" style={{width:index===d?22:6,background:index===d?accent:"#d1d5db"}}/>)}</div>}
    </div></section>;
}