import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toImg } from "@/lib/img";

type Review = { name: string; rating: number; text: string; image?: string };

export function NutrimixReviews({ reviews, themeColor }: { reviews: Review[]; themeColor?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reviews.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % reviews.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [reviews.length]);

  if (!reviews.length) return null;

  return (
    <section className="container mx-auto px-4 max-w-2xl py-6" aria-label="কাস্টমার রিভিউ">
      <div className="mb-4 text-center">
        <h2 className="text-xl font-extrabold">কাস্টমার রিভিউ</h2>
        <p className="mt-1 text-xs text-slate-500">আমাদের NUTRIMIX ব্যবহার করে কাস্টমারদের মতামত</p>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: (themeColor || "#15803d") + "1A" }}>
        <div
          className="flex transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
          style={{ transform: `translate3d(-${index * 100}%,0,0)` }}
        >
          {reviews.map((review, i) => (
            <article key={`${review.name}-${i}`} className="w-full shrink-0 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <Star
                      key={starIndex}
                      className="h-4 w-4"
                      fill={starIndex < review.rating ? "currentColor" : "none"}
                      strokeWidth={1.8}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-semibold text-slate-400">{i + 1}/{reviews.length}</span>
              </div>

              <p className="mt-3 text-[14px] leading-7 text-slate-700">“{review.text}”</p>

              <div className="mt-4 flex items-center gap-2.5 border-t pt-3">
                {review.image ? (
                  <img src={toImg(review.image, { w: 80, q: 75 })} alt={review.name} width={38} height={38} loading="lazy" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span
                    className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: themeColor || "#15803d" }}
                  >
                    {review.name?.charAt(0) || "✓"}
                  </span>
                )}
                <div>
                  <div className="text-sm font-bold text-slate-700">{review.name}</div>
                  <div className="text-[10px] text-slate-400">ভেরিফাইড কাস্টমার</div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {reviews.length > 1 && (
          <div className="flex justify-center gap-1.5 border-t bg-slate-50/70 py-2.5">
            {reviews.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`রিভিউ ${dotIndex + 1}`}
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: index === dotIndex ? 24 : 7,
                  background: index === dotIndex ? (themeColor || "#15803d") : "#d1d5db",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
