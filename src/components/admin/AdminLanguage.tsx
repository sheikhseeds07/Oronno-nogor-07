import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type AdminLanguage = "bn" | "en";
type AdminLanguageContextValue = {
  language: AdminLanguage;
  setLanguage: (language: AdminLanguage) => void;
  t: (bn: string, en?: string) => string;
};

const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(null);
const STORAGE_KEY = "admin-language";

const EN: Record<string, string> = {
  "অপেক্ষা করুন...": "Please wait...", "প্রবেশাধিকার নেই": "Access Denied", "এই পেজটি দেখার অনুমতি আপনার নেই।": "You do not have permission to view this page.", "হোমে যান": "Go Home",
  "অ্যাডমিন প্যানেল": "Admin Panel", "কর্মী প্যানেল": "Staff Panel", "ড্যাশবোর্ড": "Dashboard", "অর্ডার": "Orders", "ফাইল আপলোড করে অর্ডার": "Import Orders", "প্রোডাক্ট": "Products", "পণ্য": "Product", "ক্যাটাগরি": "Categories", "কাস্টমার": "Customers", "ব্যানার": "Banners", "কুপন": "Coupons", "ল্যান্ডিং পেজ": "Landing Pages", "কর্মচারী": "Employees", "কর্মী": "Employee", "হাজিরা": "Attendance", "সেটিংস": "Settings", "All API": "All API",
  "সার্চ": "Search", "খুঁজুন": "Search", "সার্চ করুন": "Search", "সার্চ অর্ডার": "Search Orders", "ফিল্টার": "Filter", "রিসেট": "Reset", "সেভ": "Save", "সেভ করুন": "Save", "সংরক্ষণ করুন": "Save", "আপডেট": "Update", "আপডেট করুন": "Update", "এডিট": "Edit", "মুছে ফেলুন": "Delete", "ডিলিট": "Delete", "বাতিল": "Cancel", "বাতিল করুন": "Cancel", "বন্ধ করুন": "Close", "যোগ করুন": "Add", "নতুন": "New", "রিফ্রেশ": "Refresh", "রিফ্রেশ করুন": "Refresh", "ডাউনলোড": "Download", "প্রিন্ট": "Print", "এক্সপোর্ট": "Export", "কপি": "Copy", "দেখুন": "View", "বিস্তারিত দেখুন": "View Details", "অ্যাকশন": "Actions", "অ্যাকশনসমূহ": "Actions",
  "ওয়েব অর্ডার": "Web Orders", "ওয়েব অর্ডার": "Web Orders", "ওয়েব পেন্ডিং": "Web Pending", "ওয়েব পেন্ডিং": "Web Pending", "অর্ডার লিস্ট": "Order List", "অর্ডার তালিকা": "Order List", "অর্ডার বিস্তারিত": "Order Details", "অর্ডার ডিটেইলস": "Order Details", "অর্ডার নম্বর": "Order Number", "অর্ডার আইডি": "Order ID", "নতুন অর্ডার": "New Order", "নিউ অর্ডার": "New Order", "ম্যানুয়াল অর্ডার": "Manual Order", "ম্যানুয়াল অর্ডার": "Manual Order", "অর্ডার ইমপোর্ট": "Import Orders",
  "পেন্ডিং": "Pending", "ইনকমপ্লিট": "Incomplete", "ইনকমপ্লিট অর্ডার": "Incomplete Orders", "ক্যান্সেল": "Cancel", "ক্যান্সেলড": "Cancelled", "ক্যান্সেল অর্ডার": "Cancelled Orders", "ক্যান্সেল অর্ডার লিস্ট": "Cancelled Order List", "ডেলিভার্ড": "Delivered", "শিপড": "Shipped", "রিটার্নড": "Returned", "রিটার্ন পেন্ডিং": "Return Pending", "পার্শিয়াল": "Partial", "হোল্ড": "Hold", "আরটিএস": "RTS", "RTS (রেডি)": "RTS (Ready)", "অর্ডার হয়েছে": "Ordered", "অর্ডার পাওয়া গেছে": "Orders Found", "স্ট্যাটাস": "Status", "অবস্থা": "Status", "অর্ডার স্ট্যাটাস": "Order Status", "সকল স্ট্যাটাস": "All Statuses", "স্ট্যাটাস নির্বাচন করুন": "Select Status",
  "তারিখ": "Date", "সময়": "Time", "সময়": "Time", "তৈরি হয়েছে": "Created At", "তৈরি হয়েছে": "Created At", "মোট": "Total", "সাবটোটাল": "Subtotal", "ডেলিভারি চার্জ": "Delivery Charge", "পেমেন্ট": "Payment", "পেমেন্ট স্ট্যাটাস": "Payment Status", "পেমেন্ট পদ্ধতি": "Payment Method", "পেমেন্ট পদ্ধতি নির্বাচন করুন": "Select Payment Method", "ক্যাশ অন ডেলিভারি": "Cash on Delivery", "ক্যাশ": "Cash", "অনলাইন": "Online", "বিকাশ": "bKash", "নগদ": "Nagad",
  "কাস্টমারের নাম": "Customer Name", "কাস্টমারের তথ্য": "Customer Information", "কাস্টমার লিস্ট": "Customer List", "কাস্টমার ডিটেইলস": "Customer Details", "ফোন নম্বর": "Phone Number", "ফোন নাম্বার": "Phone Number", "ঠিকানা": "Address", "ডেলিভারি ঠিকানা": "Delivery Address", "নাম": "Name", "ইমেইল": "Email", "ফোন": "Phone", "মোবাইল": "Mobile", "মোবাইল নম্বর": "Mobile Number", "নোট": "Note", "নোটস": "Notes", "নাম লিখুন": "Enter Name", "ফোন নম্বর লিখুন": "Enter Phone Number", "ঠিকানা লিখুন": "Enter Address", "ফোন নাম্বার / ইনভয়েস / নাম দিন": "Enter phone number / invoice / name", "বিবরণ লিখুন": "Enter Description",
  "পরিমাণ": "Quantity", "পরিমাণ লিখুন": "Enter Quantity", "মূল্য": "Price", "মূল্য লিখুন": "Enter Price", "ছবি": "Image", "বিবরণ": "Description", "পণ্য তালিকা": "Product List", "প্রোডাক্ট নাম": "Product Name", "স্টক": "Stock", "স্টক নেই": "Out of Stock", "স্টকে আছে": "In Stock", "সক্রিয়": "Active", "নিষ্ক্রিয়": "Inactive", "অ্যাক্টিভ": "Active", "ইনঅ্যাক্টিভ": "Inactive", "প্রকাশিত": "Published", "ড্রাফট": "Draft", "পণ্য যোগ করুন": "Add Product", "নতুন পণ্য": "New Product",
  "ক্যাটাগরি নাম": "Category Name", "ক্যাটাগরি নির্বাচন করুন": "Select Category", "ক্যাটাগরি যোগ করুন": "Add Category", "নতুন ক্যাটাগরি": "New Category", "ক্যাটাগরি তালিকা": "Category List", "সাব-ক্যাটাগরি": "Subcategory", "মেইন ক্যাটাগরি": "Main Category", "ক্যাটাগরি ইমেজ": "Category Image",
  "লোড হচ্ছে...": "Loading...", "ডাটা লোড হচ্ছে...": "Loading Data...", "ডেটা লোড হচ্ছে...": "Loading Data...", "ক্যাটাগরি লোড হচ্ছে...": "Loading Categories...", "কোনো ডাটা পাওয়া যায়নি": "No Data Found", "কোনো তথ্য পাওয়া যায়নি": "No Information Found", "কোনো অর্ডার পাওয়া যায়নি": "No Orders Found", "কোনো প্রোডাক্ট পাওয়া যায়নি": "No Products Found", "কোনো কাস্টমার পাওয়া যায়নি": "No Customers Found", "কোনো কর্মী পাওয়া যায়নি": "No Employees Found", "এখনো কোনো অর্ডার নেই": "No Orders Yet", "কোনো ফলাফল নেই": "No Results", "কোনো রেজাল্ট পাওয়া যায়নি": "No Results Found",
  "সব": "All", "সকল": "All", "সবগুলো": "All", "সকল পণ্য": "All Products", "সব পণ্য": "All Products", "পরবর্তী": "Next", "আগের": "Previous", "পৃষ্ঠা": "Page", "প্রতি পৃষ্ঠায়": "Per Page", "নির্বাচিত": "Selected", "নির্বাচন করুন": "Select", "সব নির্বাচন করুন": "Select All", "বাল্ক অ্যাকশন": "Bulk Actions",
  "ড্যাশবোর্ডে ফিরে যান": "Back to Dashboard", "সব দেখুন": "View All", "সব প্রোডাক্ট →": "All Products →", "সব অর্ডার দেখুন": "View All Orders", "রিপোর্ট": "Reports", "রিপোর্ট দেখুন": "View Report", "রিপোর্ট ডাউনলোড": "Download Report", "আজ": "Today", "৭ দিন": "7 Days", "৩০ দিন": "30 Days", "এই মাস": "This Month", "কাস্টম": "Custom", "দৈনিক বিক্রয়": "Daily Sales", "দৈনিক বিক্রয়": "Daily Sales", "মোট বিক্রয়": "Total Sales", "ডেলিভার্ড বিক্রয়": "Delivered Sales", "ক্যান্সেল/রিটার্ন": "Cancel / Return", "মোট প্রোডাক্ট": "Total Products", "মোট কাস্টমার": "Total Customers", "সাইটে ভিজিটর": "Site Visitors", "মোট ভিজিট (সর্বমোট)": "Total Visits (All Time)", "কম স্টক": "Low Stock", "সবকিছু ভালো আছে ✅": "Everything looks good ✅", "ইনকমপ্লিট ফানেল": "Incomplete Funnel", "ওয়েব অর্ডার ফানেল": "Web Order Funnel", "কর্মী রিপোর্ট": "Employee Report", "মোট অর্ডার": "Total Orders", "বিক্রয়": "Sales", "এই সময়সীমায়": "For This Period", "প্রসেস": "Processed",
  "অর্ডার কনফার্ম": "Confirm Order", "কনফার্ম": "Confirmed", "কনফার্ম করুন": "Confirm", "অর্ডার নিশ্চিত করুন": "Confirm Order", "অর্ডার নিশ্চিত": "Order Confirmed", "সফল": "Success", "সফলভাবে": "Successfully", "সফলভাবে সংরক্ষণ করা হয়েছে": "Saved Successfully", "সফলভাবে আপডেট করা হয়েছে": "Updated Successfully", "সফলভাবে মুছে ফেলা হয়েছে": "Deleted Successfully", "ত্রুটি": "Error", "এরর": "Error", "কিছু ভুল হয়েছে": "Something went wrong", "নিশ্চিত করুন": "Confirm", "আপনি কি নিশ্চিত?": "Are you sure?", "হ্যাঁ": "Yes", "না": "No", "আবার চেষ্টা করুন": "Try Again", "সফলভাবে সম্পন্ন হয়েছে": "Completed Successfully",
  "কর্মচারী যোগ করুন": "Add Employee", "নতুন কর্মচারী": "New Employee", "কর্মচারী তথ্য": "Employee Information", "কর্মচারী তালিকা": "Employee List", "পারমিশন": "Permissions", "অনুমতি": "Permissions", "রোল": "Role", "অ্যাডমিন": "Admin", "স্টাফ": "Staff", "অ্যাক্সেস": "Access", "অনুমোদিত": "Allowed", "অনুমোদিত নয়": "Not Allowed", "অ্যাটেনডেন্স": "Attendance", "উপস্থিত": "Present", "অনুপস্থিত": "Absent", "ছুটি": "Leave", "মাস": "Month", "বছর": "Year",
  "ব্যানার যোগ করুন": "Add Banner", "নতুন ব্যানার": "New Banner", "কুপন যোগ করুন": "Add Coupon", "নতুন কুপন": "New Coupon", "ল্যান্ডিং পেজ যোগ করুন": "Add Landing Page", "নতুন ল্যান্ডিং পেজ": "New Landing Page", "সাধারণ সেটিংস": "General Settings", "ডেলিভারি সেটিংস": "Delivery Settings", "পেমেন্ট সেটিংস": "Payment Settings", "সেটিংস সংরক্ষণ করুন": "Save Settings", "সেটিংস আপডেট করুন": "Update Settings",
  "অর্ডার ডিলিট": "Delete Order", "অর্ডার মুছে ফেলুন": "Delete Order", "অর্ডার মুছুন": "Delete Order", "অর্ডার পুনরুদ্ধার": "Restore Order", "পুনরুদ্ধার": "Restore", "ডিলিটেড অর্ডার": "Deleted Orders", "মুছে ফেলা অর্ডার": "Deleted Orders", "অর্ডার প্রিন্ট": "Print Order", "ইনভয়েস": "Invoice", "ইনভয়েস": "Invoice", "ইনভয়েস নম্বর": "Invoice Number", "অর্ডার তৈরি করুন": "Create Order", "ফাইল নির্বাচন করুন": "Choose File", "ফাইল আপলোড": "Upload File",
  "কুরিয়ার": "Courier", "কুরিয়ার": "Courier", "কুরিয়ার নির্বাচন করুন": "Select Courier", "কুরিয়ার নির্বাচন করুন": "Select Courier", "কুরিয়ার হিস্ট্রি": "Courier History", "ডেলিভারি": "Delivery", "ডেলিভারি হিস্ট্রি": "Delivery History", "ট্র্যাকিং": "Tracking", "ট্র্যাকিং নম্বর": "Tracking Number", "সাকসেস রেট": "Success Rate", "কল": "Call", "মেসেজ": "Message", "ওপেন": "Open", "বন্ধ": "Closed", "অপেক্ষমাণ": "Pending",
  "প্রোফাইল": "Profile", "ব্যবহারকারী": "User", "ব্যবহারকারীর নাম": "Username", "পাসওয়ার্ড": "Password", "লগইন": "Login", "লগইন করুন": "Log In", "লগআউট": "Logout", "লগআউট করুন": "Log Out", "চালু": "Enabled", "সক্রিয় করুন": "Enable", "নিষ্ক্রিয় করুন": "Disable", "প্রয়োগ করুন": "Apply", "ক্লিয়ার": "Clear", "মুছে দিন": "Clear", "পরিবর্তন সংরক্ষণ করুন": "Save Changes", "পরিবর্তন বাতিল করুন": "Discard Changes",
  "তারিখ নির্বাচন করুন": "Select Date", "শুরু": "Start", "শেষ": "End", "থেকে": "From", "পর্যন্ত": "To", "আজকের": "Today's", "মোট মূল্য": "Total Price", "মোট পরিমাণ": "Total Quantity", "অর্ডারের তথ্য": "Order Information", "পণ্যের তথ্য": "Product Information", "অর্ডার আইটেম": "Order Items", "আইটেম": "Item", "সর্বমোট": "Grand Total", "ডিসকাউন্ট": "Discount", "কুপন কোড": "Coupon Code", "কুপন নির্বাচন করুন": "Select Coupon", "কুপন প্রয়োগ করুন": "Apply Coupon",
  "অর্ডার তৈরি হয়েছে": "Order Created", "অর্ডার আপডেট হয়েছে": "Order Updated", "অর্ডার সফলভাবে আপডেট হয়েছে": "Order updated successfully", "অর্ডার সফলভাবে তৈরি হয়েছে": "Order created successfully", "অর্ডার সফলভাবে বাতিল হয়েছে": "Order cancelled successfully", "অর্ডার সফলভাবে ডিলিট হয়েছে": "Order deleted successfully",
  "বাংলা": "Bengali", "ইংরেজি": "English", "বাংলায় পরিবর্তন করুন": "Switch to Bengali", "ইংরেজিতে পরিবর্তন করুন": "Switch to English", "মেনু": "Menu", "সাইডবার প্রসারিত করুন": "Expand Sidebar", "সাইডবার সংকুচিত করুন": "Collapse Sidebar",
};

const PATTERNS: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^(\d+) টি অর্ডার$/, ([, n]) => `${n} orders`],
  [/^(\d+) টি প্রোডাক্ট$/, ([, n]) => `${n} products`],
  [/^(\d+) টি কাস্টমার$/, ([, n]) => `${n} customers`],
  [/^মোট (\d+) টি অর্ডার$/, ([, n]) => `Total ${n} orders`],
  [/^মোট (\d+) টি প্রোডাক্ট$/, ([, n]) => `Total ${n} products`],
  [/^মোট (\d+) টি কাস্টমার$/, ([, n]) => `Total ${n} customers`],
  [/^পৃষ্ঠা (\d+)$/, ([, n]) => `Page ${n}`],
  [/^(\d+) টি$/, ([, n]) => n],
];

function translateSource(source: string, language: AdminLanguage) {
  if (language === "bn") return source;
  const trimmed = source.trim();
  if (!trimmed || !/[\u0980-\u09FF]/.test(trimmed)) return source;
  if (EN[trimmed]) return source.replace(trimmed, EN[trimmed]);
  for (const [pattern, replacer] of PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return source.replace(trimmed, replacer(match));
  }
  return source;
}

function initialLanguage(): AdminLanguage {
  if (typeof window === "undefined") return "bn";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "en" || saved === "bn" ? saved : "bn";
}

export function AdminLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AdminLanguage>(initialLanguage);
  const setLanguage = (next: AdminLanguage) => {
    setLanguageState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
  };
  const value = useMemo<AdminLanguageContextValue>(() => ({ language, setLanguage, t: (bn, en) => language === "en" ? (en ?? EN[bn] ?? bn) : bn }), [language]);
  return <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>;
}

export function useAdminLanguage() {
  const context = useContext(AdminLanguageContext);
  if (!context) throw new Error("useAdminLanguage must be used inside AdminLanguageProvider");
  return context;
}

export function AdminLanguageSurface({ children }: { children: ReactNode }) {
  const { language } = useAdminLanguage();
  const originalsRef = useRef<WeakMap<Text, string>>(new WeakMap());
  const lastTranslatedRef = useRef<WeakMap<Text, string>>(new WeakMap());

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.body;
    const originals = originalsRef.current;
    const lastTranslated = lastTranslatedRef.current;

    const translateTextNode = (node: Text) => {
      const raw = node.nodeValue ?? "";
      const previous = lastTranslated.get(node);
      if (!originals.has(node) || (previous !== undefined && raw !== previous)) originals.set(node, raw);
      const source = originals.get(node) ?? raw;
      const translated = translateSource(source, language);
      if (raw !== translated) node.nodeValue = translated;
      lastTranslated.set(node, translated);
    };

    const scan = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        translateTextNode(node as Text);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as HTMLElement;
      if (element.closest("[data-admin-language-ignore]")) return;
      for (const attribute of ["placeholder", "title", "aria-label"]) {
        const raw = element.getAttribute(attribute);
        if (!raw) continue;
        const translated = translateSource(raw, language);
        if (raw !== translated) element.setAttribute(attribute, translated);
      }
      for (const child of Array.from(element.childNodes)) scan(child);
    };

    document.documentElement.setAttribute("data-admin-language", language);
    scan(root);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const added of Array.from(mutation.addedNodes)) scan(added);
        if (mutation.type === "characterData") scan(mutation.target);
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return <div data-admin-language-surface="true" className="contents">{children}</div>;
}
