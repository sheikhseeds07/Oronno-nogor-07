import fs from "node:fs";

const path = "src/components/landing/AllProductLandingPage.tsx";
const source = fs.readFileSync(path, "utf8");
let next = source;

next = next.replace(
  'import { BadgeCheck, Check, ChevronDown, Leaf, MapPin, PackageCheck, Phone, ShieldCheck, ShoppingBag, Sparkles, Star, Truck, User, Wallet } from "lucide-react";',
  'import { Check, ChevronDown, Leaf, MapPin, PackageCheck, Phone, ShieldCheck, ShoppingBag, Sparkles, Star, Truck, User, Wallet } from "lucide-react";'
);

next = next.replace(
  '<div className="flex min-w-0 items-center gap-1.5"><img src={logo} alt={brand} className="h-6 w-6 rounded-full border border-all-product-line object-cover" /><div className="flex min-w-0 items-center gap-1 text-[13px] font-black leading-none"><span className="truncate">{brand}</span><BadgeCheck className="h-3 w-3 shrink-0 text-all-product-primary" fill="currentColor" /></div></div>',
  '<div className="flex min-w-0 items-center gap-2.5"><div className="relative shrink-0"><img src={logo} alt="শেখ সিডস" className="h-7 w-7 rounded-full border border-all-product-gold/50 bg-white object-cover shadow-sm" /></div><div className="min-w-0 leading-none"><div className="all-product-brand-name whitespace-nowrap text-[17px] font-black tracking-[-0.02em] text-all-product-primary sm:text-[18px]">শেখ সিডস</div><div className="mt-1 h-px w-9 bg-all-product-gold/70" aria-hidden="true" /></div></div>'
);

next = next.replace(
  '<div className="flex shrink-0 items-center gap-1.5 text-[10px] font-black text-all-product-alert" aria-label="অফার শেষ হওয়ার কাউন্টডাউন">\n        <span className="ap-cd-dot h-1.5 w-1.5 rounded-full bg-all-product-alert" aria-hidden="true" />\n        <span>অফার শেষ</span>\n        <span className="flex items-center gap-1">{units.map((unit, i) => (\n          <span key={i} className="flex items-center gap-1">\n            {i > 0 && <span className="text-all-product-muted">:</span>}\n            <span key={unit} className="ap-cd-box rounded bg-all-product-alert/10 px-1 py-0.5 tabular-nums ring-1 ring-all-product-alert/25">{bnDigits(unit)}</span>\n          </span>\n        ))}</span>\n      </div>',
  '<div className="flex shrink-0 items-center gap-2 rounded-full border border-all-product-alert/20 bg-all-product-alert/[0.06] px-2.5 py-1.5 shadow-sm" aria-label="অফার শেষ হওয়ার কাউন্টডাউন">\n        <span className="ap-cd-dot h-1.5 w-1.5 shrink-0 rounded-full bg-all-product-alert" aria-hidden="true" />\n        <span className="text-[10px] font-black leading-none text-all-product-alert sm:text-[11px]">অফার শেষ হবে</span>\n        <span className="flex items-center gap-0.5">{units.map((unit, i) => (\n          <span key={i} className="flex items-center gap-0.5">\n            {i > 0 && <span className="px-0.5 text-[9px] font-black text-all-product-alert/50">:</span>}\n            <span key={unit} className="ap-cd-box min-w-[18px] rounded-md bg-all-product-alert/10 px-1 py-0.5 text-center text-[10px] font-black leading-none tabular-nums text-all-product-alert ring-1 ring-all-product-alert/15 sm:min-w-[20px]">{bnDigits(unit)}</span>\n          </span>\n        ))}</span>\n      </div>'
);

next = next.replace(
  '@media (prefers-reduced-motion:reduce){.ap-cd-box,.ap-cd-dot{animation:none!important}}',
  '@media (prefers-reduced-motion:reduce){.ap-cd-box,.ap-cd-dot{animation:none!important}}\n.all-product-brand-name{font-family:"Noto Serif Bengali","Hind Siliguri","Noto Sans Bengali",serif;}'
);

if (next === source) {
  console.log("All Product header polish already applied or source pattern changed; nothing to patch.");
} else {
  fs.writeFileSync(path, next);
  console.log("Polished All Product header branding and offer countdown.");
}
