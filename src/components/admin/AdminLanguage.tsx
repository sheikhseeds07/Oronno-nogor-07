import { useEffect, useMemo, useRef } from "react";
import { createContext, useContext, useState, type ReactNode } from "react";

type AdminLanguage = "bn" | "en";

type AdminLanguageContextValue = {
  language: AdminLanguage;
  setLanguage: (language: AdminLanguage) => void;
};

const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(null);

const EXACT: Record<string, string> = {
  "অপেক্ষা করুন...": "Please wait...",
  "প্রবেশাধিকার নেই": "Access Denied",
  "এই পেজটি দেখার অনুমতি আপনার নেই।": "You do not have permission to view this page.",
  "হোমে যান": "Go Home",
  "অ্যাডমিন প্যানেল": "Admin Panel",
  "কর্মী প্যানেল": "Staff Panel",
  "হাজিরা": "Attendance",
  "লগআউট": "Logout",
  "অর্ডার": "Orders",
  "ফাইল আপলোড করে অর্ডার": "Import Orders",
  "প্রোডাক্ট": "Products",
  "ক্যাটাগরি": "Categories",
  "কাস্টমার": "Customers",
  "ব্যানার": "Banners",
  "কুপন": "Coupons",
  "ল্যান্ডিং পেজ": "Landing Pages",
  "কর্মচারী": "Employees",
  "সেটিংস": "Settings",
  "ড্যাশবোর্ড": "Dashboard",
  "সার্চ": "Search",
  "খুঁজুন": "Search",
  "সেভ করুন": "Save",
  "সংরক্ষণ করুন": "Save",
  "আপডেট করুন": "Update",
  "এডিট": "Edit",
  "মুছে ফেলুন": "Delete",
  "ডিলিট": "Delete",
  "বাতিল": "Cancel",
  "বন্ধ করুন": "Close",
  "যোগ করুন": "Add",
  "নতুন": "New",
  "অর্ডার লিস্ট": "Order List",
  "অর্ডার বিস্তারিত": "Order Details",
  "অর্ডার নম্বর": "Order Number",
  "কাস্টমারের নাম": "Customer Name",
  "ফোন নম্বর": "Phone Number",
  "ঠিকানা": "Address",
  "স্ট্যাটাস": "Status",
  "তারিখ": "Date",
  "সময়": "Time",
  "মোট": "Total",
  "সাবটোটাল": "Subtotal",
  "ডেলিভারি চার্জ": "Delivery Charge",
  "পেমেন্ট": "Payment",
  "পেমেন্ট স্ট্যাটাস": "Payment Status",
  "অর্ডার কনফার্ম": "Confirm Order",
  "কনফার্ম": "Confirm",
  "ক্যান্সেল": "Cancel",
  "পেন্ডিং": "Pending",
  "ইনকমপ্লিট": "Incomplete",
  "ওয়েব পেন্ডিং": "Web Pending",
  "ডেলিভার্ড": "Delivered",
  "শিপড": "Shipped",
  "রিটার্নড": "Returned",
  "রিটার্ন পেন্ডিং": "Return Pending",
  "ক্যাটাগরি লোড হচ্ছে...": "Loading categories...",
  "লোড হচ্ছে...": "Loading...",
  "ডাটা লোড হচ্ছে...": "Loading data...",
  "কোনো ডাটা পাওয়া যায়নি": "No data found",
  "কোনো অর্ডার পাওয়া যায়নি": "No orders found",
  "কোনো প্রোডাক্ট পাওয়া যায়নি": "No products found",
  "কোনো কাস্টমার পাওয়া যায়নি": "No customers found",
  "সবগুলো": "All",
  "সকল": "All",
  "ফিল্টার": "Filter",
  "রিসেট": "Reset",
  "পরবর্তী": "Next",
  "আগের": "Previous",
  "পৃষ্ঠা": "Page",
  "প্রতি পৃষ্ঠায়": "Per page",
  "দেখুন": "View",
  "বিস্তারিত দেখুন": "View details",
  "ডাউনলোড": "Download",
  "প্রিন্ট": "Print",
  "এক্সপোর্ট": "Export",
  "রিফ্রেশ": "Refresh",
  "কপি": "Copy",
  "সফল": "Success",
  "সফলভাবে সংরক্ষণ করা হয়েছে": "Saved successfully",
  "সফলভাবে আপডেট করা হয়েছে": "Updated successfully",
  "সফলভাবে মুছে ফেলা হয়েছে": "Deleted successfully",
  "ত্রুটি": "Error",
  "কিছু ভুল হয়েছে": "Something went wrong",
  "নিশ্চিত করুন": "Confirm",
  "আপনি কি নিশ্চিত?": "Are you sure?",
};

const PATTERNS: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^(\d+) টি অর্ডার$/, ([, n]) => `${n} orders`],
  [/^(\d+) টি প্রোডাক্ট$/, ([, n]) => `${n} products`],
  [/^(\d+) টি কাস্টমার$/, ([, n]) => `${n} customers`],
  [/^পৃষ্ঠা (\d+)$/, ([, n]) => `Page ${n}`],
  [/^মোট (\d+) টি$/, ([, n]) => `Total ${n}`],
];

function translateText(value: string, language: AdminLanguage) {
  if (language === "bn") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (EXACT[trimmed]) return value.replace(trimmed, EXACT[trimmed]);
  for (const [pattern, replacer] of PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return value.replace(trimmed, replacer(match));
  }
  return value;
}

function useAdminTextTranslation(root: HTMLElement | null, language: AdminLanguage) {
  const originals = useRef(new WeakMap<Text, string>());
  const lastTranslated = useRef(new WeakMap<Text, string>());

  useEffect(() => {
    if (!root) return;

    const scan = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) nodes.push(node as Text);

      for (const textNode of nodes) {
        const raw = textNode.nodeValue ?? "";
        const previous = lastTranslated.current.get(textNode);
        if (!originals.current.has(textNode) || (previous !== undefined && raw !== previous)) {
          originals.current.set(textNode, raw);
        }
        const source = originals.current.get(textNode) ?? raw;
        const translated = translateText(source, language);
        if (raw !== translated) textNode.nodeValue = translated;
        lastTranslated.current.set(textNode, translated);
      }
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [root, language]);
}

export function AdminLanguageProvider({ children, initialLanguage = "bn" }: { children: ReactNode; initialLanguage?: AdminLanguage }) {
  const [language, setLanguageState] = useState<AdminLanguage>(() => {
    if (typeof window === "undefined") return initialLanguage;
    const saved = window.localStorage.getItem("admin-language");
    return saved === "en" || saved === "bn" ? saved : initialLanguage;
  });
  const value = useMemo(() => ({
    language,
    setLanguage: (next: AdminLanguage) => {
      setLanguageState(next);
      if (typeof window !== "undefined") window.localStorage.setItem("admin-language", next);
    },
  }), [language]);

  return <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>;
}

export function useAdminLanguage() {
  const context = useContext(AdminLanguageContext);
  if (!context) throw new Error("useAdminLanguage must be used inside AdminLanguageProvider");
  return context;
}

export function AdminLanguageSurface({ children }: { children: ReactNode }) {
  const { language } = useAdminLanguage();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  useAdminTextTranslation(root, language);
  return <div ref={setRoot} data-admin-language={language} className="contents">{children}</div>;
}
