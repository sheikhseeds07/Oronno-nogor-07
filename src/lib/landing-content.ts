// Everything on the clean landing page that used to be hardcoded now lives here.
// The whole object is stored in landing_pages.planting_steps (jsonb) so no schema
// change is needed, and every single string / image is editable from admin.

export type SeedRow = { name: string; qty: string; image?: string };
export type Feature = { title: string; text?: string; icon?: string };
export type WhyItem = { title: string; text?: string; icon?: string };
export type Review = { name: string; rating: number; text: string };
export type ComboOffer = { name: string; price: number; old_price?: number; image?: string; delivery_fee?: number | null; quantity?: string; is_active?: boolean };
export type LandingTemplate = "combo" | "premium" | "modern" | "product" | "all-product";

export type LandingContent = {
  template: LandingTemplate;
  promo_messages: string[];
  header_cta_text: string;
  offer_badge_text: string;
  price_prefix: string;
  discount_suffix: string;
  hero_note: string;
  red_cta_text: string;
  hero_image_2?: string;
  /** Nutrimix-only hero image rotation list. */
  hero_gallery_images?: string[];
  /** NUTRIMIX-only voice/audio URL uploaded from the landing-page editor. */
  audio_url?: string;
  /** Seed Combo-only voice/audio URL for the NUTRIMIX upsell popup. */
  nutrimix_popup_audio_url?: string;
  gift_cta_text: string;
  gift_title_1: string;
  gift_title_2: string;
  gift_subtitle: string;
  gift_image: string;
  gift_bullets: string[];
  seed_kicker: string;
  seed_title: string;
  seed_col_1: string;
  seed_col_2: string;
  seed_table: SeedRow[];
  show_countdown: boolean;
  countdown_hours: number;
  countdown_title: string;
  features_kicker: string;
  features_title: string;
  why_kicker: string;
  why_title: string;
  reviews_kicker: string;
  reviews_title: string;
  package_kicker: string;
  package_title: string;
  order_kicker: string;
  order_title: string;
  order_note: string;
  name_label: string;
  phone_label: string;
  address_label: string;
  submit_text: string;
  cod_note: string;
  gallery_images: string[];
  show_popup: boolean;
  popup_title: string;
  popup_text: string;
  popup_cta: string;
  popup_mode: "text" | "image";
  popup_image: string;
  popup_delay: number;
  /** Seed Combo-only Nutrimix upsell popup master switch. */
  nutrimix_popup_enabled: boolean;
  /** Seed Combo popup product is fully independent of the products table. */
  nutrimix_offer_name: string;
  nutrimix_offer_price: number;
  nutrimix_offer_old_price?: number;
  nutrimix_offer_image: string;
  nutrimix_popup_heading: string;
  nutrimix_popup_description: string;
  nutrimix_popup_accept_text: string;
  nutrimix_popup_decline_text: string;
  /** Controls whether the All Product CTA opens the offer-selection popup before checkout. */
  product_selection_popup_enabled: boolean;
  /** Optional All Product template-only combo choices shown as a compact 2-column grid. */
  combo_offers: ComboOffer[];
};

export const DEFAULT_SEEDS: SeedRow[] = [
  { name: "বিটরুট", qty: "৫ পিস" }, { name: "কেরালা শিম", qty: "৫ পিস" }, { name: "করলা", qty: "৫ পিস" }, { name: "উস্তে", qty: "৫ পিস" },
  { name: "লাউ", qty: "৫ পিস" }, { name: "শষা", qty: "২০+ পিস" }, { name: "চিচিঙ্গা", qty: "৫ পিস" }, { name: "মিষ্টি কুমড়া", qty: "৫ পিস" },
  { name: "মরিচ", qty: "২০+ পিস" }, { name: "বেগুন", qty: "২০+ পিস" }, { name: "ঢেরষ", qty: "১৫+ বীজ" }, { name: "বরবটি", qty: "৭+ পিস" },
  { name: "ধুন্দল", qty: "৭+ পিস" }, { name: "ঝিঙা", qty: "৭+ পিস" }, { name: "চালকুমড়া", qty: "৮+ পিস" }, { name: "ধনিয়া", qty: "১ জিপার" },
  { name: "পালন শাক", qty: "১ জিপার" }, { name: "পুই শাক", qty: "১ জিপার" }, { name: "কলমি শাক", qty: "১ জিপার" }, { name: "সবুজ শাক", qty: "১ জিপার" },
  { name: "লাল শাক", qty: "১ জিপার" }, { name: "ডাটা শাক", qty: "১ জিপার" }, { name: "সুগন্ধি শাক", qty: "১ জিপার" }, { name: "নাফা শাক", qty: "১ জিপার" },
];

export const DEFAULT_FEATURES: Feature[] = [
  { title: "১০০% অরিজিনাল ও পরীক্ষিত বীজ", text: "প্রতিটি প্যাকেট উচ্চ অংকুরোদগম হারের নিশ্চয়তা সহ প্যাক করা হয়।" },
  { title: "ছাদ বাগান ও টবের জন্য উপযুক্ত", text: "অল্প জায়গাতেই সারা বছর সবজি ফলানোর জন্য বাছাই করা জাত।" },
  { title: "সব ঋতুর মিক্স কালেকশন", text: "শাক, ফল ও সবজির বৈচিত্র্যময় সংগ্রহ — একবারেই পুরো বাগান।" },
  { title: "সহজ চাষ পদ্ধতি সহ গাইড", text: "কোন বীজ কখন ও কীভাবে বুনবেন — বাংলায় নির্দেশনা।" },
];

export const DEFAULT_WHY: WhyItem[] = [
  { title: "ক্যাশ অন ডেলিভারি", text: "পণ্য হাতে পেয়ে টাকা পরিশোধ করুন।" },
  { title: "সারা দেশে দ্রুত ডেলিভারি", text: "ঢাকায় ১–২ দিন, ঢাকার বাইরে ২–৩ দিনে পৌঁছে যাবে।" },
  { title: "মান নিশ্চয়তা", text: "প্যাকেজিং সমস্যা বা ভুল পণ্য হলে রিপ্লেসমেন্ট।" },
  { title: "সরাসরি কাস্টমার সাপোর্ট", text: "অর্ডার সংক্রান্ত যেকোনো সহায়তায় আমরা আছি।" },
];

export const DEFAULT_REVIEWS: Review[] = [
  { name: "রাশেদুল ইসলাম, ঢাকা", rating: 5, text: "প্যাকেজিং খুব ভালো ছিল, প্রায় সব বীজেই চারা এসেছে। ছাদ বাগানের জন্য দুর্দান্ত।" },
  { name: "সুমাইয়া আক্তার, চট্টগ্রাম", rating: 5, text: "দাম অনুযায়ী এত প্রকার বীজ আশা করিনি। আবার অর্ডার করব ইনশাআল্লাহ।" },
  { name: "মাহবুব হাসান, রাজশাহী", rating: 4, text: "সময়মতো ডেলিভারি পেয়েছি, ডেলিভারি ম্যানের ব্যবহারও ভালো ছিল।" },
];

export const DEFAULT_CONTENT: LandingContent = {
  template: "combo",
  promo_messages: ["আমাদের বীজ কিনলেই পাবেন গ্যারান্টি কার্ড", "বীজ থেকে চারা তৈরির সম্পূর্ণ গাইডলাইন ফ্রি", "সারা দেশে ক্যাশ অন হোম ডেলিভারি", "১০০% অরিজিনাল ও উচ্চ অংকুরোদগম হারের বীজ", "অর্ডারে সমস্যা হলে সরাসরি কাস্টমার সাপোর্ট"],
  header_cta_text: "অর্ডার করুন",
  offer_badge_text: "BEST OFFER",
  price_prefix: "মাত্র",
  discount_suffix: "% ছাড়",
  hero_note: "সারা দেশে ক্যাশ অন হোম ডেলিভারি",
  red_cta_text: "অর্ডার করতে ক্লিক করুন",
  hero_image_2: "",
  hero_gallery_images: [],
  audio_url: "",
  nutrimix_popup_audio_url: "",
  gift_cta_text: "১ প্যাকেট বিদেশি বীজ ফ্রী নিন!",
  gift_title_1: "১ প্যাকেট",
  gift_title_2: "বিদেশি বীজ ফ্রী",
  gift_subtitle: "অর্ডারের সাথে বোনাস — সীমিত স্টক পর্যন্ত।",
  gift_image: "/landing-images/strawberry-combo.jpg",
  gift_bullets: ["১০০% অরিজিনাল ও ভেজালমুক্ত", "উচ্চ অংকুরোদগম হার", "সারা দেশে দ্রুত ডেলিভারি", "হাতে পেয়ে টাকা পরিশোধ"],
  seed_kicker: "প্যাকেজ কনটেন্ট",
  seed_title: "কম্বোতে যে যে বীজ থাকবে",
  seed_col_1: "বীজের নাম",
  seed_col_2: "পরিমাণ",
  seed_table: DEFAULT_SEEDS,
  show_countdown: true,
  countdown_hours: 3,
  countdown_title: "অফারটি শেষ হতে আর মাত্র...",
  features_kicker: "প্রোডাক্ট ডিটেইলস",
  features_title: "কেন এই প্যাকেজটি বিশেষ",
  why_kicker: "আমাদের নিশ্চয়তা",
  why_title: "কেন আমাদের ওপর আস্থা রাখবেন",
  reviews_kicker: "কাস্টমার ফিডব্যাক",
  reviews_title: "ক্রেতারা যা বলছেন",
  package_kicker: "",
  package_title: "",
  order_kicker: "",
  order_title: "",
  order_note: "",
  name_label: "আপনার পুরো নাম *",
  phone_label: "আপনার ফোন নাম্বার *",
  address_label: "আপনার সম্পূর্ণ ঠিকানা *",
  submit_text: "অর্ডার কনফার্ম করুন",
  cod_note: "পণ্য হাতে পেয়ে টাকা পরিশোধ করুন — ক্যাশ অন ডেলিভারি।",
  gallery_images: [],
  show_popup: true,
  popup_title: "গ্যারান্টি কার্ড",
  popup_text: "আমাদের বীজ কিনলেই ১ প্যাকেট বিদেশি বীজ ফ্রী পাবেন, সাথে গ্যারান্টি কার্ড এবং বীজ থেকে চারা তৈরির সম্পূর্ণ নির্দেশনা।",
  popup_cta: "এখনই অর্ডার করুন",
  popup_mode: "text",
  popup_image: "",
  popup_delay: 1200,
  nutrimix_popup_enabled: true,
  nutrimix_offer_name: "🎁 NUTRIMIX - গাছের খাদ্য",
  nutrimix_offer_price: 200,
  nutrimix_offer_old_price: 600,
  nutrimix_offer_image: "",
  nutrimix_popup_heading: "বীজ কম্বোর সাথে “অনুখাদ্য” নিন 🌱",
  nutrimix_popup_description: "২৪ প্রকার সবজির বীজের সাথে ৳২০০ যোগ করেই গাছের নিয়মিত পরিচর্যার জন্য 🎁“অনুখাদ্য” /NUTRIMIX - নিয়ে নিন। যা গাছে ব্যবহার করলে সব সমস্যা সমাধান হয়ে যাবে",
  nutrimix_popup_accept_text: "🎁 ২৪ প্রকার বীজ কম্বোর সাথে অনুখাদ্যও নিন",
  nutrimix_popup_decline_text: "না, শুধু ২৪ প্রকার বীজই নিবো",
  product_selection_popup_enabled: true,
  combo_offers: [],
};

export function mergeContent(raw: unknown): LandingContent {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<LandingContent>;
  const out = { ...DEFAULT_CONTENT, ...value, seed_table: Array.isArray(value.seed_table) && value.seed_table.length ? value.seed_table : DEFAULT_CONTENT.seed_table, combo_offers: Array.isArray(value.combo_offers) ? value.combo_offers.map((item) => ({ ...item, is_active: item.is_active !== false })) : DEFAULT_CONTENT.combo_offers } as LandingContent;
  if (out.template === "combo") {
    out.package_kicker = "";
    out.package_title = "";
    out.order_kicker = "";
    out.order_title = "";
    out.order_note = "";
  }
  return out;
}
