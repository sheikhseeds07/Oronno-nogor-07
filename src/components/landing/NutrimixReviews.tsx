import { SafeImage } from "@/components/SafeImage";
import { useEffect, useState } from "react";
import { Star, Quote } from "lucide-react";
import { toImg } from "@/lib/img";

type Review = { name: string; rating: number; text: string; image?: string };

export function NutrimixReviews({ reviews, themeColor }: { reviews: Review[]; themeColor?: string }) {
  const [index, setIndex] = useState(0);
  const accent = themeColor || "#15803d";

  useEffect(() => {
    if (reviews.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % reviews.length), 5000);
    return () => window.clearInterval(timer);
  }, [reviews.length]);

  if (!reviews.length) return null;
  const review = reviews[index];

  return (
    <section className="mx-auto max-w-2xl px-3 py-4 sm:py-5" aria-label="কাস্টমার রিভিউ">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-extrabold tracking-[0.16em]" style={{ color: accent }}>CUSTOMER STORIES</span>
          <h2 className="mt-0.5 text-base font-black tracking-tight text-slate-900 sm:text-lg">কাস্টমার রিভিউ</h2>
          <p className="text-[11px] font-medium text-slate-500">NUTRIMIX ব্যবহারকারীদের অভিজ্ঞতা</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-amber-200/80 bg-amber-50 px-2.5 py-1.5">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
          <span className="text-sm font-black tabular-nums text-slate-800">{Number(review.rating).toFixed(1)}</span>
          <span className="text-[9px] font-bold text-slate-500">/ 5</span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-white via-white to-emerald-50/70 px-3.5 py-3.5 shadow-[0_8px_24px_-18px_rgba(15,60,38,.38)] sm:px-5 sm:py-4" style={{ borderColor: accent + "24" }}>
        <div className="pointer-events-none absolute -right-3 -top-4 text-emerald-900/[0.045]"><Quote className="h-20 w-20" /></div>
        <div key={index} className="relative animate-in fade-in duration-300">
          <div className="mb-2 flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
            {Array.from({ length: 5 }).map((_, star) => (
              <Star key={star} className="h-3 w-3" fill={star < review.rating ? "#f59e0b" : "none"} stroke={star < review.rating ? "#f59e0b" : "#cbd5e1"} />
            ))}
            <span className="ml-1 text-[10px] font-bold text-slate-500">যাচাইকৃত অভিজ্ঞতা</span>
          </div>
          <p className="relative text-[13px] font-semibold leading-[1.75] text-slate-700 sm:text-sm">“{review.text}”</p>
          <div className="mt-3 flex items-center gap-2.5 border-t border-slate-100 pt-2.5">
            {review.image ? (
              <SafeImage src={toImg(review.image, { w: 80, q: 78 })} alt={review.name} width={34} height={34} loading="lazy" className="h-[34px] w-[34px] rounded-full object-cover ring-2 ring-white shadow-sm" />
            ) : (
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-xs font-black text-white shadow-sm" style={{ background: accent }}>{review.name?.charAt(0) || "★"}</span>
            )}
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-800">{review.name}</div>
              <div className="mt-0.5 text-[10px] font-medium text-slate-500">NUTRIMIX ব্যবহারকারী</div>
            </div>
            {reviews.length > 1 && <div className="ml-auto flex items-center gap-1.5" aria-label="রিভিউ নেভিগেশন">
              {reviews.map((_, dot) => <button key={dot} type="button" onClick={() => setIndex(dot)} aria-label={`রিভিউ ${dot + 1}`} aria-current={dot === index ? "true" : undefined} className="h-1.5 rounded-full" style={{ width: index === dot ? 18 : 6, background: index === dot ? accent : "#d1d5db" }} />)}
            </div>}
          </div>
        </div>
      </div>
    </section>
  );
}
