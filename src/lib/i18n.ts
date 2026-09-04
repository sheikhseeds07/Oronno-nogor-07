/**
 * Lightweight site-wide language switcher (বাংলা ⇄ English).
 *
 * The whole storefront is authored in Bengali, so instead of retrofitting a
 * translation call into every component we translate the rendered text of the
 * page. A MutationObserver keeps newly rendered content translated too.
 * Switching back to Bengali simply reloads the page (original text restored).
 */

export type SiteLang = "bn" | "en";

const STORAGE_KEY = "site-lang";

/** Bengali → English phrase dictionary (longest match wins). */
const DICT: Record<string, string> = {
  // header / nav / drawer
  "শেখ সিডস — ছাদ বাগানির বিশ্বস্ত সঙ্গী": "Sheikh Seeds — trusted partner of rooftop gardeners",
  "শেখ সিডস": "Sheikh Seeds",
  "দেশী ও বিদেশী বীজ এর একটি বিশ্বস্ত প্রতিষ্ঠান": "A trusted source of local & imported seeds",
  "দেশী ও বিদেশী বীজ": "Local & imported seeds",
  "দেশি-বিদেশি প্রিমিয়াম বীজ": "Local & imported premium seeds",
  "অরিজিনাল বীজ, গার্ডেন টুলস ও সার": "Original seeds, garden tools & fertilizer",
  "সাথেই আছে, সাথেই থাকবে": "with you, always",
  "শ্যাড খুঁজুন": "Search seeds",
  "প্রোডাক্টের নাম বা কীওয়ার্ড": "Product name or keyword",
  "অর্ডার কার্ট": "Order cart",
  "ক্যাটাগরি": "Categories",
  "মেনু": "Menu",
  "থিম": "Theme",
  "টেক্সচার": "Texture",
  "ভাষা": "Language",
  "হোম": "Home",
  "সকল পণ্য": "All products",
  "সব পণ্য": "All products",
  "আমাদের সম্পর্কে": "About us",
  "যোগাযোগ করুন": "Contact us",
  "যোগাযোগ": "Contact",
  "আমার একাউন্ট": "My account",
  "লগইন করুন": "Log in",
  "লগইন": "Log in",
  "লগআউট": "Log out",
  "প্রোফাইল": "Profile",
  "শপিং করুন": "Start shopping",
  "পণ্য ব্রাউজ করুন": "Browse products",

  // categories
  "সবজি": "Vegetables",
  "ফল": "Fruits",
  "ফুল": "Flowers",
  "টুল": "Tools",
  "কম্বো": "Combo",
  "সার": "Fertilizer",
  "শাক": "Leafy greens",

  // product / cart
  "কার্টে যোগ করুন": "Add to cart",
  "কার্টে যোগ হয়েছে": "Added to cart",
  "পণ্যটি কার্টে যোগ হয়েছে": "Product added to cart",
  "আপনার শপিং কার্টে সংরক্ষিত হয়েছে": "Saved to your shopping cart",
  "কার্টে যোগ": "Add to cart",
  "আমার শপিং কার্ট": "My shopping cart",
  "আপনার কার্টে এখনো কোনো পণ্য নেই": "Your cart is empty",
  "কার্ট খালি": "Cart is empty",
  "চেকআউট করুন": "Checkout",
  "চেকআউট": "Checkout",
  "স্টক নেই": "Out of stock",
  "স্টকে আছে": "In stock",
  "পরিমাণ:": "Quantity:",
  "পরিমাণ": "Quantity",
  "কমান": "Decrease",
  "বাড়ান": "Increase",
  "মুছুন": "Remove",
  "বন্ধ করুন": "Close",
  "বন্ধ": "Close",
  "পণ্যের বিস্তারিত": "Product details",
  "রেগুলার মূল্য": "Regular price",
  "অফার মূল্য": "Offer price",
  "সাশ্রয়": "You save",
  "ছাড়": "OFF",
  "রিভিউ": "reviews",
  "সাধারণ প্রশ্ন": "FAQ",
  "এই প্যাকেজে যা যা থাকছে": "What's inside this package",
  "এই প্যাকেজটি অর্ডার করুন": "Order this package",
  "প্যাকেজ সিলেক্ট করুন": "Select a package",
  "প্যাকেজ নির্বাচন করুন": "Select a package",
  "পণ্য সিলেক্ট করুন": "Select a product",
  "প্রোডাক্ট নির্বাচন করুন": "Select a product",
  "আপনার জন্য বাছাই করা প্যাকেজ": "Packages picked for you",
  "বিকল্প:": "Option:",

  // order / checkout
  "এখনই অর্ডার করুন": "Order now",
  "এখনই অর্ডার": "Order now",
  "অর্ডার করুন": "Order now",
  "অর্ডার করতে ক্লিক করুন": "Click to order",
  "অর্ডার কনফার্ম করুন": "Confirm order",
  "অর্ডার টি কনফার্ম করুন": "Confirm your order",
  "অর্ডার হচ্ছে...": "Placing order...",
  "অর্ডার সফল হয়েছে!": "Order placed successfully!",
  "অর্ডার সফল!": "Order placed!",
  "অর্ডার করতে সমস্যা হয়েছে": "Something went wrong placing the order",
  "অর্ডার তৈরি ব্যর্থ": "Failed to create the order",
  "দ্রুত অর্ডার করতে চাই": "I want to order quickly",
  "আমিও অর্ডার করতে চাই — আজই নিন": "I want to order too — get it today",
  "এখনই অর্ডার করে গ্যারান্টি কার্ড নিন": "Order now and get the guarantee card",
  "আজই অর্ডার করুন": "Order today",
  "অর্ডার নেওয়া বন্ধ আছে": "Ordering is currently closed",
  "ডেলিভারি ঠিকানা": "Delivery address",
  "আপনার নাম": "Your name",
  "নাম, ফোন ও ঠিকানা পূরণ করুন": "Please fill in name, phone and address",
  "সব তথ্য পূরণ করুন": "Please fill in all fields",
  "ফোন নম্বর": "Phone number",
  "ফোন": "Phone",
  "ইমেইল": "Email",
  "নাম": "Name",
  "ঠিকানা": "Address",
  "পূর্ণ ঠিকানা (গ্রাম/এলাকা, থানা, জেলা)": "Full address (village/area, thana, district)",
  "গ্রাম/এলাকা, থানা, জেলা": "Village/area, thana, district",
  "১১ ডিজিটের বাংলাদেশি নাম্বার": "11-digit Bangladeshi number",
  "সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নাম্বার দিন (01XXXXXXXXX)":
    "Enter a valid 11-digit Bangladeshi mobile number (01XXXXXXXXX)",
  "সর্বোচ্চ ১১ ডিজিটের নাম্বার দেওয়া যাবে": "Maximum 11 digits allowed",
  "পেমেন্ট মাধ্যম": "Payment method",
  "ক্যাশ অন ডেলিভারি": "Cash on delivery",
  "সারা দেশে ক্যাশ অন হোম ডেলিভারি": "Cash on home delivery nationwide",
  "সারা দেশে ক্যাশ অন ডেলিভারি": "Cash on delivery nationwide",
  "পণ্য হাতে পেয়ে পেমেন্ট করুন": "Pay when you receive the product",
  "পণ্য হাতে পেয়ে টাকা পরিশোধ করুন": "Pay when you receive the product",
  "পণ্য হাতে পেয়ে টাকা পরিশোধ": "Pay on delivery",
  "ডেলিভারি ফি": "Delivery fee",
  "ডেলিভারি চার্জ": "Delivery charge",
  "সাবটোটাল": "Subtotal",
  "সর্বমোট": "Grand total",
  "মোট": "Total",
  "ফ্রি": "Free",
  "টাকা": "Taka",
  "মাত্র": "only",
  "ঢাকার ভেতরে": "Inside Dhaka",
  "ঢাকার বাইরে": "Outside Dhaka",

  // trust / marketing
  "ক্রেতারা যা বলছেন": "What our customers say",
  "কাস্টমার রিভিউ": "Customer reviews",
  "কাস্টমার ফিডব্যাক": "Customer feedback",
  "সন্তুষ্ট কাস্টমারদের মতামত": "Reviews from happy customers",
  "বিশেষ অফার": "Special offer",
  "বিশেষ সুবিধা": "Special benefits",
  "অফারটি শেষ হতে আর মাত্র...": "Offer ends in...",
  "অফার শেষ হতে বাকি": "Offer ends in",
  "ঘণ্টা": "Hours",
  "মিনিট": "Minutes",
  "সেকেন্ড": "Seconds",
  "দিন": "Days",
  "সারাদেশে হোম ডেলিভারি": "Home delivery nationwide",
  "সারা দেশে দ্রুত ডেলিভারি": "Fast delivery nationwide",
  "হোম ডেলিভারি": "Home delivery",
  "দ্রুত ডেলিভারি": "Fast delivery",
  "২-৩ দিনে ডেলিভারি": "Delivery in 2-3 days",
  "ফ্রি ডেলিভারি ট্র্যাকিং": "Free delivery tracking",
  "১০০% অরিজিনাল বীজের নিশ্চয়তা": "100% original seed guarantee",
  "১০০% অরিজিনাল ও পরীক্ষিত বীজ": "100% original & tested seeds",
  "১০০% অরিজিনাল বীজ": "100% original seeds",
  "১০০% অরিজিনাল": "100% original",
  "আমাদের নিশ্চয়তা": "Our guarantee",
  "কেন আমাদের ওপর আস্থা রাখবেন": "Why trust us",
  "আমাদের ওপর আস্থা রাখার কারণ": "Why people trust us",
  "কেন কিনবেন": "Why buy from us",
  "গ্যারান্টি কার্ড অফার": "Guarantee card offer",
  "অরিজিনাল গ্যারান্টি কার্ড": "Original guarantee card",
  "গ্যারান্টি কার্ড": "Guarantee card",
  "বীজ কিনলে পাবেন গ্যারান্টি কার্ড": "Get a guarantee card with every seed purchase",
  "আমাদের বীজ কিনলেই পাবেন": "With every seed purchase you get",
  "ফ্রি বীজ থেকে চারা তৈরির গাইডলাইন": "Free seed-to-seedling guideline",
  "ফ্রি চারা তৈরির গাইডলাইন": "Free seedling guideline",
  "বীজ থেকে চারা তৈরির সহজ গাইডলাইন": "Easy seed-to-seedling guideline",
  "এবং বীজ থেকে চারা তৈরির সম্পূর্ণ নির্দেশনা": "and complete seed-to-seedling instructions",
  "সহজ চাষ পদ্ধতি সহ গাইড": "Guide with easy growing steps",
  "প্যাকেজের সাথে": "with the package",
  "দেওয়া হবে": "will be included",
  "সহজে চাষ করুন • নিশ্চিন্তে অর্ডার করুন": "Grow easily • Order with confidence",
  "সরাসরি সাপোর্ট": "Direct support",
  "ছাদ বাগান ও টবের জন্য উপযুক্ত": "Perfect for rooftop gardens and pots",
  "সব ঋতুর মিক্স কালেকশন": "All-season mixed collection",

  // states / misc
  "লোড হচ্ছে...": "Loading...",
  "লোড হচ্ছে": "Loading",
  "পেজ পাওয়া যায়নি": "Page not found",
  "পাওয়া যায়নি": "not found",
  "কোনো প্রোডাক্ট নেই": "No products found",
  "নামের প্রোডাক্ট পাওয়া যায়নি": "No product found with that name",
  "হোমে ফিরে যান": "Back to home",
  "সর্বস্বত্ব সংরক্ষিত": "All rights reserved",
  "ক্যান্সেল": "Cancel",
  "সেভ": "Save",
  "নতুন": "New",
  "অপেক্ষমাণ": "Pending",
  "কনফার্মড": "Confirmed",
  "প্রস্তুত হচ্ছে": "Processing",
  "ডেলিভারিতে": "In delivery",
  "ডেলিভারি সম্পন্ন": "Delivered",
  "ডেলিভারি": "Delivery",
  "বাতিল": "Cancelled",
  "আপনাকে Block করা হয়েছে": "You have been blocked",
  "এই সাইটে আপনার প্রবেশ বন্ধ করা হয়েছে। ভুল হয়ে থাকলে আমাদের সাথে যোগাযোগ করুন":
    "Your access to this site has been blocked. If this is a mistake, please contact us.",
  "পিস": "pcs",
  "গ্রাম": "g",
  "বীজ": "seeds",
  "ও": "&",
};

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

function toEnDigits(s: string) {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

const KEYS = Object.keys(DICT).sort((a, b) => b.length - a.length);
const RE = new RegExp(KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");

export function translateString(input: string): string {
  if (!input) return input;
  return toEnDigits(input.replace(RE, (m) => DICT[m] ?? m));
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE"]);
const ATTRS = ["placeholder", "title", "aria-label", "alt"];

function translateNode(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    const t = root.textContent;
    if (t && /[\u0980-\u09FF]/.test(t)) {
      const next = translateString(t);
      if (next !== t) root.textContent = next;
    }
    return;
  }
  if (!(root instanceof Element) && root.nodeType !== Node.DOCUMENT_NODE) return;
  const el = root as Element;
  if (el instanceof Element && SKIP_TAGS.has(el.tagName)) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (parent && SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return /[\u0980-\u09FF]/.test(node.textContent || "")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  let n = walker.nextNode();
  while (n) {
    nodes.push(n as Text);
    n = walker.nextNode();
  }
  nodes.forEach((node) => {
    const t = node.textContent || "";
    const next = translateString(t);
    if (next !== t) node.textContent = next;
  });

  if (el instanceof Element) {
    const all = [el, ...Array.from(el.querySelectorAll("*"))];
    all.forEach((e) => {
      ATTRS.forEach((a) => {
        const v = e.getAttribute(a);
        if (v && /[\u0980-\u09FF]/.test(v)) {
          const next = translateString(v);
          if (next !== v) e.setAttribute(a, next);
        }
      });
    });
  }
}

let observer: MutationObserver | null = null;
let scheduled = false;
const pending: Node[] = [];

function flush() {
  scheduled = false;
  const batch = pending.splice(0, pending.length);
  observer?.disconnect();
  batch.forEach((node) => {
    try {
      translateNode(node);
    } catch {
      /* ignore */
    }
  });
  if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function schedule(node: Node) {
  pending.push(node);
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(flush);
}

export function startEnglishMode() {
  if (typeof document === "undefined" || observer) return;
  document.documentElement.lang = "en";
  translateNode(document.body);
  observer = new MutationObserver((records) => {
    records.forEach((r) => {
      if (r.type === "characterData") schedule(r.target);
      else r.addedNodes.forEach((node) => schedule(node));
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

export function getStoredLang(): SiteLang {
  if (typeof localStorage === "undefined") return "bn";
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "bn";
  } catch {
    return "bn";
  }
}

/** Persist and apply the language. Switching back to Bengali reloads the page. */
export function setLanguage(lang: SiteLang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  if (lang === "en") {
    startEnglishMode();
  } else if (typeof window !== "undefined") {
    document.documentElement.lang = "bn";
    window.location.reload();
  }
}

/** Called once on mount to restore the saved language. */
export function initLanguage() {
  if (getStoredLang() === "en") startEnglishMode();
}
