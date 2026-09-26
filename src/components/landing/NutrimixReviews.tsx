import { useEffect, useState } from "react";
import { BadgeCheck, Quote, Star } from "lucide-react";
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
    <section className="container mx-auto max-w-2xl px-4 py-7" aria-label="কাস্টমার রিভিউ">
      <div className="mb-4 text-center">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold tracking-wide"
          style={{ color: accent, borderColor: accent + "30", background: accent + "0D" }}>
          <BadgeCheck className="h-3.5 w-3.5" />
          VERIFIED CUSTOMER REVIEWS
        </div>
        <h2 className="text-xl font-extrabold tracking-tight text-slate-900">কাস্টমার রিভিউ</h2>
        <p className="mt-1 text-xs text-slate-500">NUTRIMIX ব্যবহার করে কাস্টমারদের অভিজ্ঞতা</p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

        <div className="relative min-h-[255px] sm:min-h-[235px]">
          {reviews.map((review, i) => {
            const active = i === index;
            return (
              <article
                key={`${review.name}-${i}`}
                aria-hidden={!active}
                className={`absolute inset-0 flex flex-col justify-between p-5 sm:p-7 transition-all duration-[1800ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${active ? "opacity-100 translate-y-0 scale-100 blur-0" : "pointer-events-none opacity-0 translate-y-2 scale-[0.985] blur-[2px]"}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Star
                          key={starIndex}
                          className="h-4 w-4"
                          fill={starIndex < review.rating ? "currentColor" : "none"}
                          strokeWidth={1.7}
                          style={{ color: starIndex < review.rating ? "#f59e0b" : "#cbd5e1" }}
                        />
                      ))}
                      <span className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        {review.rating}.0
                      </span>
                    </div>
                    <Quote className="h-7 w-7 rotate-180 opacity-10" style={{ color: accent }} />
                  </div>

                  <p className="mt-4 text-[14px] font-medium leading-7 text-slate-700 sm:text-[15px] sm:leading-8">
                    “{review.text}”
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                  {review.image ? (
                    <img
                      src={toImg(review.image, { w: 100, q: 80 })}
                      alt={review.name}
                      width={42}
                      height={42}
                      loading="lazy"
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                    />
                  ) : (
                    <span
                      className="grid h-10 w-10 place-items-center rounded-full text-sm font-extrabold text-white shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${accent}, ${accent}B8)` }}
                    >
                      {review.name?.charAt(0) || "✓"}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-slate-800">{review.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-400">
                      <BadgeCheck className="h-3 w-3" style={{ color: accent }} />
                      ভেরিফাইড কাস্টমার
                    </div>
                  </div>
                  <span className="ml-auto shrink-0 text-[10px] font-semibold text-slate-300">
                    {i + 1} / {reviews.length}
                  </span>
                </div>
              </article>
            );
          })}
        </div>

        {reviews.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 border-t border-slate-100 bg-white/80 px-4 py-3">
            {reviews.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`রিভিউ ${dotIndex + 1}`}
                className="h-1.5 rounded-full transition-all duration-700"
                style={{
                  width: index === dotIndex ? 25 : 6,
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
