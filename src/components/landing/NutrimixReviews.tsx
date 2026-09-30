import { SafeImage } from "@/components/SafeImage";
import { useEffect, useState } from "react";
import { BadgeCheck, Star } from "lucide-react";
import { toImg } from "@/lib/img";

type Review = { name: string; rating: number; text: string; image?: string };

export function NutrimixReviews({ reviews, themeColor }: { reviews: Review[]; themeColor?: string }) {
  const [index, setIndex] = useState(0);
  const accent = themeColor || "#15803d";

  useEffect(() => {
    if (reviews.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % reviews.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [reviews.length]);

  if (!reviews.length) return null;

  return (
    <section className="container mx-auto max-w-2xl px-3 py-4" aria-label="কাস্টমার রিভিউ">
      <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-slate-900">কাস্টমার রিভিউ</h2>
          <p className="mt-0.5 text-[10px] text-slate-400">NUTRIMIX ব্যবহারকারীদের অভিজ্ঞতা</p>
        </div>
        <div
          className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold"
          style={{ color: accent, borderColor: accent + "25", background: accent + "0A" }}
        >
          <BadgeCheck className="h-3 w-3" />
          VERIFIED
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative h-[154px] sm:h-[142px]">
          {reviews.map((review, i) => {
            const active = i === index;
            return (
              <article
                key={`${review.name}-${i}`}
                aria-hidden={!active}
                className={`absolute inset-0 flex flex-col justify-between px-4 py-3.5 sm:px-5 transition-all duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${active ? "opacity-100 translate-x-0" : "pointer-events-none opacity-0 -translate-x-8"}`}
              >
                <div>
                  <div className="flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star
                        key={starIndex}
                        className="h-3.5 w-3.5"
                        fill={starIndex < review.rating ? "currentColor" : "none"}
                        strokeWidth={1.8}
                        style={{ color: starIndex < review.rating ? "#f59e0b" : "#cbd5e1" }}
                      />
                    ))}
                    <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                      {review.rating}.0
                    </span>
                  </div>

                  <p className="mt-2 text-[12px] font-medium leading-5 text-slate-700 sm:text-[13px] sm:leading-6">
                    “{review.text}”
                  </p>
                </div>

                <div className="flex items-center gap-2 border-t border-slate-100 pt-2.5">
                  {review.image ? (
                    <SafeImage
                      src={toImg(review.image, { w: 80, q: 78 })}
                      alt={review.name}
                      width={32}
                      height={32}
                      loading="lazy"
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow-sm"
                    />
                  ) : (
                    <span
                      className="grid h-8 w-8 place-items-center rounded-full text-xs font-extrabold text-white"
                      style={{ background: accent }}
                    >
                      {review.name?.charAt(0) || "✓"}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-slate-800">{review.name}</div>
                    <div className="mt-0.5 flex items-center gap-0.5 text-[9px] text-slate-400">
                      <BadgeCheck className="h-2.5 w-2.5" style={{ color: accent }} />
                      ভেরিফাইড কাস্টমার
                    </div>
                  </div>
                  {reviews.length > 1 && (
                    <span className="ml-auto text-[9px] font-semibold text-slate-300">
                      {i + 1}/{reviews.length}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {reviews.length > 1 && (
          <div className="flex justify-center gap-1 border-t border-slate-100 bg-slate-50/70 py-1.5">
            {reviews.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`রিভিউ ${dotIndex + 1}`}
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: index === dotIndex ? 18 : 5,
                  background: index === dotIndex ? accent : "#d1d5db",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
