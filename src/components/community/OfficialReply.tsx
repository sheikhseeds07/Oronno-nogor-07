import { BadgeCheck } from "lucide-react";

export const BRAND_NAME = "Sheikh Seeds";
export const BRAND_LOGO = "/sheikh-seeds-logo.svg";

/** Customer avatar with graceful initial fallback. */
export function CustomerAvatar({ name, src, size = 32 }: { name?: string | null; src?: string | null; size?: number }) {
  const style = { width: size, height: size } as const;
  if (src)
    return (
      <img
        src={src}
        alt={name || "কাস্টমার"}
        loading="lazy"
        style={style}
        className="shrink-0 rounded-full border border-border/60 object-cover"
      />
    );
  return (
    <div
      style={style}
      className="grid shrink-0 place-items-center rounded-full bg-brand-light text-[11px] font-black text-brand-dark"
    >
      {name?.trim()?.charAt(0) || "ক"}
    </div>
  );
}

/** Official Sheikh Seeds identity row: logo + name + blue verified tick. */
export function BrandBadge({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <img
        src={BRAND_LOGO}
        alt={BRAND_NAME}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full border border-brand/20 bg-white object-contain p-0.5"
      />
      <b className="truncate text-[12px] font-extrabold text-brand-dark">{BRAND_NAME}</b>
      <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-sky-500 text-white" />
    </span>
  );
}

function timeBn(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
}

/** Branded official reply card shown under a review, question or comment. */
export function OfficialReply({
  reply,
  at,
  compact = false,
}: {
  reply?: string | null;
  at?: string | null;
  compact?: boolean;
}) {
  if (!reply?.trim()) return null;
  return (
    <div
      className={`mt-2 rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-light/70 via-background to-sky-50/60 shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-300 ${
        compact ? "p-2.5" : "p-3"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <BrandBadge size={compact ? 20 : 24} />
        <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[9px] font-extrabold text-brand-dark">
          অফিসিয়াল উত্তর
        </span>
      </div>
      <p className={`mt-1.5 whitespace-pre-wrap leading-5 text-foreground/90 ${compact ? "text-[11px]" : "text-sm"}`}>
        {reply}
      </p>
      {at && <div className="mt-1 text-[9px] text-muted-foreground">{timeBn(at)}</div>}
    </div>
  );
}
