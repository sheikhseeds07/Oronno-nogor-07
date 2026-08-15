import { useEffect, useMemo, useRef } from "react";
import { createContext, useContext, useState, type ReactNode } from "react";

type AdminLanguage = "bn" | "en";
type AdminLanguageContextValue = { language: AdminLanguage; setLanguage: (language: AdminLanguage) => void };
const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(null);

// UI-only translations. Customer names, product names, addresses and order data are never translated
// because only exact interface phrases are matched here.
const EXACT: Record<string, string> = {
  "অপেক্ষা করুন...": "Please wait...", "প্রবেশাধিকার নেই": "Access Denied", "এই পেজটি দেখার অনুমতি আপনার নেই।": "You do not have permission to view this page.", "হোমে যান": "Go Home",
  "অ্যাডমিন প্যানেল": "Admin Panel", "কর্মী প্যানেল": "Staff Panel", "হাজিরা": "Attendance", "লগআউট": "Logout", "ড্যাশবোর্ড": "Dashboard",
  "অর্ডার": "Orders", "ফাইল আপলোড করে অর্ডার": "Import Orders", "প্রোডাক্ট": "Products", "ক্যাটাগরি": "Categories", "কাস্টমার": "Customers", "ব্যানার": "Banners", "কুপন": "Coupons", "ল্যান্ডিং পেজ": "Landing Pages", "কর্মচারী": "Employees", "সেটিংস": "Settings", "All API": "All API",
  "সার্চ": "Search", "খুঁজুন": "Search", "সেভ করুন": "Save", "সংরক্ষণ করুন": "Save", "আপডেট করুন": "Update", "এডিট": "Edit", "মুছে ফেলুন": "Delete", "ডিলিট": "Delete", "বাতিল": "Cancel", "বন্ধ করুন": "Close", "যোগ করুন": "Add", "নতুন": "New", "রিফ্রেশ": "Refresh", "রিসেট": "Reset",
  "সার্চ করুন": "Search", "সার্চ অর্ডার": "Search Orders", "নতুন অর্ডার": "New Order", "নিউ অর্ডার": "New Order", "ওয়েব অর্ডার": "Web Orders", "ওয়েব অর্ডার": "Web Orders", "ওয়েব পেন্ডিং": "Web Pending", "ওয়েব পেন্ডিং": "Web Pending", "অর্ডার লিস্ট": "Order List", "অর্ডার বিস্তারিত": "Order Details", "অর্ডার নম্বর": "Order Number", "অর্ডার আইডি": "Order ID",
  "কাস্টমারের নাম": "Customer Name", "ফোন নম্বর": "Phone Number", "ফোন নাম্বার": "Phone Number", "ঠিকানা": "Address", "স্ট্যাটাস": "Status", "তারিখ": "Date", "সময়": "Time", "সময়": "Time", "মোট": "Total", "সাবটোটাল": "Subtotal", "ডেলিভারি চার্জ": "Delivery Charge", "পেমেন্ট": "Payment", "পেমেন্ট স্ট্যাটাস": "Payment Status", "ক্যাশ অন ডেলিভারি": "Cash on Delivery",
  "অর্ডার কনফার্ম": "Confirm Order", "কনফার্ম": "Confirm", "কনফার্ম করুন": "Confirm", "অর্ডার নিশ্চিত করুন": "Confirm Order", "অর্ডার নিশ্চিত": "Order Confirmed", "ক্যান্সেল": "Cancel", "ক্যান্সেলড": "Cancelled", "ক্যান্সেল অর্ডার": "Cancelled Orders", "ক্যান্সেল অর্ডার লিস্ট": "Cancelled Order List", "পেন্ডিং": "Pending", "ইনকমপ্লিট": "Incomplete", "ডেলিভার্ড": "Delivered", "শিপড": "Shipped", "রিটার্নড": "Returned", "রিটার্ন পেন্ডিং": "Return Pending", "পার্শিয়াল": "Partial", "হোল্ড": "Hold", "আরটিএস": "RTS", "RTS (রেডি)": "RTS (Ready)", "অর্ডার হয়েছে": "Ordered", "অর্ডার পাওয়া গেছে": "Orders found",
  "ক্যাটাগরি লোড হচ্ছে...": "Loading categories...", "লোড হচ্ছে...": "Loading...", "ডাটা লোড হচ্ছে...": "Loading data...", "ডেটা লোড হচ্ছে...": "Loading data...", "কোনো ডাটা পাওয়া যায়নি": "No data found", "কোনো অর্ডার পাওয়া যায়নি": "No orders found", "কোনো প্রোডাক্ট পাওয়া যায়নি": "No products found", "কোনো কাস্টমার পাওয়া যায়নি": "No customers found", "এখনো কোনো অর্ডার নেই": "No orders yet", "কোনো তথ্য পাওয়া যায়নি": "No information found",
  "সবগুলো": "All", "সকল": "All", "সব": "All", "সকল পণ্য": "All Products", "সব পণ্য": "All Products", "ফিল্টার": "Filter", "পরবর্তী": "Next", "আগের": "Previous", "পৃষ্ঠা": "Page", "প্রতি পৃষ্ঠায়": "Per page", "দেখুন": "View", "বিস্তারিত দেখুন": "View details", "ডাউনলোড": "Download", "প্রিন্ট": "Print", "এক্সপোর্ট": "Export", "কপি": "Copy", "অ্যাকশন": "Actions", "অ্যাকশনসমূহ": "Actions", "অবস্থা": "Status", "নাম": "Name", "ইমেইল": "Email", "পরিমাণ": "Quantity", "মূল্য": "Price", "ছবি": "Image", "বিবরণ": "Description", "ক্যাটাগরি নির্বাচন করুন": "Select category", "পণ্য যোগ করুন": "Add product", "নতুন পণ্য": "New Product", "নতুন ক্যাটাগরি": "New Category", "ক্যাটাগরি যোগ করুন": "Add Category",
  "ড্যাশবোর্ডে ফিরে যান": "Back to Dashboard", "সব দেখুন": "View All", "সব প্রোডাক্ট →": "All Products →", "সব অর্ডার দেখুন": "View All Orders", "রিপোর্ট": "Reports", "রিপোর্ট দেখুন": "View Report", "রিপোর্ট ডাউনলোড": "Download Report", "আজ": "Today", "৭ দিন": "7 Days", "৩০ দিন": "30 Days", "এই মাস": "This Month", "কাস্টম": "Custom", "দৈনিক বিক্রয়": "Daily Sales", "দৈনিক বিক্রয়": "Daily Sales", "মোট বিক্রয়": "Total Sales", "ডেলিভার্ড বিক্রয়": "Delivered Sales", "ডেলিভার্ড": "Delivered", "ক্যান্সেল/রিটার্ন": "Cancel / Return", "মোট প্রোডাক্ট": "Total Products", "মোট কাস্টমার": "Total Customers", "সাইটে ভিজিটর": "Site Visitors", "মোট ভিজিট (সর্বমোট)": "Total Visits (All Time)", "কম স্টক": "Low Stock", "সবকিছু ভালো আছে ✅": "Everything looks good ✅", "ইনকমপ্লিট ফানেল": "Incomplete Funnel", "ওয়েব অর্ডার ফানেল": "Web Order Funnel", "কর্মী রিপোর্ট": "Employee Report", "কর্মী": "Employee", "মোট অর্ডার": "Total Orders", "কনফার্ম": "Confirmed", "বিক্রয়": "Sales", "এই সময়সীমায়": "For this period", "প্রসেস": "Processed",
  "পণ্য": "Product", "প্রোডাক্ট নাম": "Product Name", "স্টক": "Stock", "স্টক নেই": "Out of Stock", "স্টকে আছে": "In Stock", "সক্রিয়": "Active", "নিষ্ক্রিয়": "Inactive", "অ্যাক্টিভ": "Active", "ইনঅ্যাক্টিভ": "Inactive", "প্রকাশিত": "Published", "ড্রাফট": "Draft", "সাব-ক্যাটাগরি": "Subcategory", "মেইন ক্যাটাগরি": "Main Category", "ক্যাটাগরি নাম": "Category Name", "ক্যাটাগরি ইমেজ": "Category Image",
  "সফল": "Success", "সফলভাবে সংরক্ষণ করা হয়েছে": "Saved successfully", "সফলভাবে আপডেট করা হয়েছে": "Updated successfully", "সফলভাবে মুছে ফেলা হয়েছে": "Deleted successfully", "ত্রুটি": "Error", "কিছু ভুল হয়েছে": "Something went wrong", "নিশ্চিত করুন": "Confirm", "আপনি কি নিশ্চিত?": "Are you sure?", "বাতিল করুন": "Cancel", "হ্যাঁ": "Yes", "না": "No", "আবার চেষ্টা করুন": "Try again", "সফলভাবে সম্পন্ন হয়েছে": "Completed successfully",
  "কোনো কর্মী পাওয়া যায়নি": "No employees found", "কর্মচারী যোগ করুন": "Add Employee", "নতুন কর্মচারী": "New Employee", "কর্মচারী তথ্য": "Employee Information", "পারমিশন": "Permissions", "অনুমতি": "Permissions", "সেভ": "Save", "আপডেট": "Update", "রোল": "Role", "অ্যাডমিন": "Admin", "স্টাফ": "Staff", "কর্মী": "Staff", "অ্যাক্সেস": "Access", "অনুমোদিত": "Allowed", "অনুমোদিত নয়": "Not Allowed",
  "অ্যাটেনডেন্স": "Attendance", "উপস্থিত": "Present", "অনুপস্থিত": "Absent", "ছুটি": "Leave", "সময়": "Time", "শুরু": "Start", "শেষ": "End", "মাস": "Month", "বছর": "Year",
  "ব্যানার যোগ করুন": "Add Banner", "নতুন ব্যানার": "New Banner", "কুপন যোগ করুন": "Add Coupon", "নতুন কুপন": "New Coupon", "ল্যান্ডিং পেজ যোগ করুন": "Add Landing Page", "নতুন ল্যান্ডিং পেজ": "New Landing Page", "সেটিংস সংরক্ষণ করুন": "Save Settings", "সাধারণ সেটিংস": "General Settings", "ডেলিভারি সেটিংস": "Delivery Settings", "পেমেন্ট সেটিংস": "Payment Settings",
  "অর্ডার ডিলিট": "Delete Order", "অর্ডার মুছে ফেলুন": "Delete Order", "অর্ডার পুনরুদ্ধার": "Restore Order", "ডিলিটেড অর্ডার": "Deleted Orders", "মুছে ফেলা অর্ডার": "Deleted Orders", "অর্ডার প্রিন্ট": "Print Order", "ইনভয়েস": "Invoice", "ইনভয়েস": "Invoice", "ইনভয়েস নম্বর": "Invoice Number", "অর্ডার তৈরি করুন": "Create Order", "ম্যানুয়াল অর্ডার": "Manual Order", "ম্যানুয়াল অর্ডার": "Manual Order", "অর্ডার ইমপোর্ট": "Import Orders", "ফাইল নির্বাচন করুন": "Choose File", "ফাইল আপলোড": "Upload File",
  "সার্চ রেজাল্ট": "Search Results", "রেজাল্ট": "Results", "স্ট্যাটাস আপডেট হয়েছে": "Status updated", "ইনকমপ্লিট স্ট্যাটাসে ম্যানুয়ালি যাওয়া যাবে না": "Cannot manually change to Incomplete status", "ফোন নাম্বার / ইনভয়েস / নাম দিন": "Enter phone number / invoice / name", "টি অর্ডার পাওয়া গেছে": "orders found", "নতুন স্ট্যাটাস সিলেক্ট করে \"কনফার্ম\" চাপুন": "select a new status and click \"Confirm\"",
  "কাস্টমার": "Customer", "কাস্টমার লিস্ট": "Customer List", "কাস্টমার ডিটেইলস": "Customer Details", "অর্ডার ডিটেইলস": "Order Details", "অর্ডারের তথ্য": "Order Information", "অর্ডার আইটেম": "Order Items", "কুরিয়ার": "Courier", "কুরিয়ার": "Courier", "কুরিয়ার হিস্ট্রি": "Courier History", "ডেলিভারি হিস্ট্রি": "Delivery History", "সাকসেস রেট": "Success Rate", "কল": "Call", "মেসেজ": "Message", "ওপেন": "Open", "বন্ধ": "Closed", "অপেক্ষমাণ": "Pending",
};

const PATTERNS: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^(\d+) টি অর্ডার$/, ([, n]) => `${n} orders`],
  [/^(\d+) টি প্রোডাক্ট$/, ([, n]) => `${n} products`],
  [/^(\d+) টি কাস্টমার$/, ([, n]) => `${n} customers`],
  [/^(\d+) টি$/, ([, n]) => `${n}`],
  [/^পৃষ্ঠা (\d+)$/, ([, n]) => `Page ${n}`],
  [/^মোট (\d+) টি$/, ([, n]) => `Total ${n}`],
  [/^মোট (\d+) টি অর্ডার$/, ([, n]) => `Total ${n} orders`],
  [/^মোট (\d+) টি প্রোডাক্ট$/, ([, n]) => `Total ${n} products`],
  [/^মোট (\d+) টি কাস্টমার$/, ([, n]) => `Total ${n} customers`],
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
        if (!originals.current.has(textNode) || (previous !== undefined && raw !== previous)) originals.current.set(textNode, raw);
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

export function AdminLanguageProvider({ children, initialLanguage = "en" }: { children: ReactNode; initialLanguage?: AdminLanguage }) {
  const [language, setLanguageState] = useState<AdminLanguage>(() => {
    if (typeof window === "undefined") return initialLanguage;
    const saved = window.localStorage.getItem("admin-language");
    return saved === "en" || saved === "bn" ? saved : initialLanguage;
  });
  const value = useMemo(() => ({ language, setLanguage: (next: AdminLanguage) => { setLanguageState(next); if (typeof window !== "undefined") window.localStorage.setItem("admin-language", next); } }), [language]);
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
