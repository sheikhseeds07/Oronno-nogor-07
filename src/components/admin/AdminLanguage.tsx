import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AdminLanguage = "bn" | "en";

type AdminLanguageContextValue = {
  language: AdminLanguage;
  setLanguage: (language: AdminLanguage) => void;
  t: (bn: string, en?: string) => string;
};

const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(null);
const STORAGE_KEY = "admin-language";

/**
 * Central admin-only UI dictionary.
 * Never pass customer/order data through this dictionary.
 * Values are interface labels only.
 */
const EN: Record<string, string> = {
  "অপেক্ষা করুন...": "Please wait...",
  "প্রবেশাধিকার নেই": "Access Denied",
  "এই পেজটি দেখার অনুমতি আপনার নেই।": "You do not have permission to view this page.",
  "হোমে যান": "Go Home",
  "অ্যাডমিন প্যানেল": "Admin Panel",
  "কর্মী প্যানেল": "Staff Panel",
  "ড্যাশবোর্ড": "Dashboard",
  "অর্ডার": "Orders",
  "ফাইল আপলোড করে অর্ডার": "Import Orders",
  "প্রোডাক্ট": "Products",
  "পণ্য": "Product",
  "ক্যাটাগরি": "Categories",
  "ক্যাটাগরি নাম": "Category Name",
  "ক্যাটাগরি নির্বাচন করুন": "Select Category",
  "ক্যাটাগরি যোগ করুন": "Add Category",
  "নতুন ক্যাটাগরি": "New Category",
  "সাব-ক্যাটাগরি": "Subcategory",
  "মেইন ক্যাটাগরি": "Main Category",
  "কাস্টমার": "Customers",
  "ব্যানার": "Banners",
  "কুপন": "Coupons",
  "ল্যান্ডিং পেজ": "Landing Pages",
  "কর্মচারী": "Employees",
  "কর্মী": "Employee",
  "হাজিরা": "Attendance",
  "সেটিংস": "Settings",
  "All API": "All API",
  "সার্চ": "Search",
  "খুঁজুন": "Search",
  "সার্চ করুন": "Search",
  "সার্চ অর্ডার": "Search Orders",
  "ফিল্টার": "Filter",
  "রিসেট": "Reset",
  "সেভ": "Save",
  "সেভ করুন": "Save",
  "সংরক্ষণ করুন": "Save",
  "আপডেট": "Update",
  "আপডেট করুন": "Update",
  "এডিট": "Edit",
  "মুছে ফেলুন": "Delete",
  "ডিলিট": "Delete",
  "বাতিল": "Cancel",
  "বাতিল করুন": "Cancel",
  "বন্ধ করুন": "Close",
  "যোগ করুন": "Add",
  "নতুন": "New",
  "রিফ্রেশ": "Refresh",
  "ডাউনলোড": "Download",
  "প্রিন্ট": "Print",
  "এক্সপোর্ট": "Export",
  "কপি": "Copy",
  "দেখুন": "View",
  "বিস্তারিত দেখুন": "View Details",
  "অ্যাকশন": "Actions",
  "অ্যাকশনসমূহ": "Actions",
  "ওয়েব অর্ডার": "Web Orders",
  "ওয়েব অর্ডার": "Web Orders",
  "ওয়েব পেন্ডিং": "Web Pending",
  "ওয়েব পেন্ডিং": "Web Pending",
  "অর্ডার লিস্ট": "Order List",
  "অর্ডার বিস্তারিত": "Order Details",
  "অর্ডার নম্বর": "Order Number",
  "অর্ডার আইডি": "Order ID",
  "নতুন অর্ডার": "New Order",
  "নিউ অর্ডার": "New Order",
  "পেন্ডিং": "Pending",
  "ইনকমপ্লিট": "Incomplete",
  "ইনকমপ্লিট অর্ডার": "Incomplete Orders",
  "ক্যান্সেল": "Cancel",
  "ক্যান্সেলড": "Cancelled",
  "ক্যান্সেল অর্ডার": "Cancelled Orders",
  "ক্যান্সেল অর্ডার লিস্ট": "Cancelled Order List",
  "ডেলিভার্ড": "Delivered",
  "শিপড": "Shipped",
  "রিটার্নড": "Returned",
  "রিটার্ন পেন্ডিং": "Return Pending",
  "পার্শিয়াল": "Partial",
  "হোল্ড": "Hold",
  "আরটিএস": "RTS",
  "RTS (রেডি)": "RTS (Ready)",
  "অর্ডার হয়েছে": "Ordered",
  "অর্ডার পাওয়া গেছে": "Orders Found",
  "স্ট্যাটাস": "Status",
  "অবস্থা": "Status",
  "তারিখ": "Date",
  "সময়": "Time",
  "সময়": "Time",
  "তৈরি হয়েছে": "Created At",
  "তৈরি হয়েছে": "Created At",
  "মোট": "Total",
  "সাবটোটাল": "Subtotal",
  "ডেলিভারি চার্জ": "Delivery Charge",
  "পেমেন্ট": "Payment",
  "পেমেন্ট স্ট্যাটাস": "Payment Status",
  "ক্যাশ অন ডেলিভারি": "Cash on Delivery",
  "কাস্টমারের নাম": "Customer Name",
  "ফোন নম্বর": "Phone Number",
  "ফোন নাম্বার": "Phone Number",
  "ঠিকানা": "Address",
  "নাম": "Name",
  "ইমেইল": "Email",
  "পরিমাণ": "Quantity",
  "মূল্য": "Price",
  "ছবি": "Image",
  "বিবরণ": "Description",
  "স্টক": "Stock",
  "স্টক নেই": "Out of Stock",
  "স্টকে আছে": "In Stock",
  "সক্রিয়": "Active",
  "নিষ্ক্রিয়": "Inactive",
  "অ্যাক্টিভ": "Active",
  "ইনঅ্যাক্টিভ": "Inactive",
  "প্রকাশিত": "Published",
  "ড্রাফট": "Draft",
  "প্রোডাক্ট নাম": "Product Name",
  "পণ্য যোগ করুন": "Add Product",
  "নতুন পণ্য": "New Product",
  "লোড হচ্ছে...": "Loading...",
  "ডাটা লোড হচ্ছে...": "Loading Data...",
  "ডেটা লোড হচ্ছে...": "Loading Data...",
  "ক্যাটাগরি লোড হচ্ছে...": "Loading Categories...",
  "কোনো ডাটা পাওয়া যায়নি": "No Data Found",
  "কোনো তথ্য পাওয়া যায়নি": "No Information Found",
  "কোনো অর্ডার পাওয়া যায়নি": "No Orders Found",
  "কোনো প্রোডাক্ট পাওয়া যায়নি": "No Products Found",
  "কোনো কাস্টমার পাওয়া যায়নি": "No Customers Found",
  "কোনো কর্মী পাওয়া যায়নি": "No Employees Found",
  "এখনো কোনো অর্ডার নেই": "No Orders Yet",
  "পরবর্তী": "Next",
  "আগের": "Previous",
  "পৃষ্ঠা": "Page",
  "প্রতি পৃষ্ঠায়": "Per Page",
  "সব": "All",
  "সকল": "All",
  "সবগুলো": "All",
  "সকল পণ্য": "All Products",
  "সব পণ্য": "All Products",
  "ড্যাশবোর্ডে ফিরে যান": "Back to Dashboard",
  "সব দেখুন": "View All",
  "সব প্রোডাক্ট →": "All Products →",
  "সব অর্ডার দেখুন": "View All Orders",
  "রিপোর্ট": "Reports",
  "রিপোর্ট দেখুন": "View Report",
  "রিপোর্ট ডাউনলোড": "Download Report",
  "আজ": "Today",
  "৭ দিন": "7 Days",
  "৩০ দিন": "30 Days",
  "এই মাস": "This Month",
  "কাস্টম": "Custom",
  "দৈনিক বিক্রয়": "Daily Sales",
  "দৈনিক বিক্রয়": "Daily Sales",
  "মোট বিক্রয়": "Total Sales",
  "ডেলিভার্ড বিক্রয়": "Delivered Sales",
  "ক্যান্সেল/রিটার্ন": "Cancel / Return",
  "মোট প্রোডাক্ট": "Total Products",
  "মোট কাস্টমার": "Total Customers",
  "সাইটে ভিজিটর": "Site Visitors",
  "মোট ভিজিট (সর্বমোট)": "Total Visits (All Time)",
  "কম স্টক": "Low Stock",
  "সবকিছু ভালো আছে ✅": "Everything looks good ✅",
  "ইনকমপ্লিট ফানেল": "Incomplete Funnel",
  "ওয়েব অর্ডার ফানেল": "Web Order Funnel",
  "কর্মী রিপোর্ট": "Employee Report",
  "মোট অর্ডার": "Total Orders",
  "কনফার্ম": "Confirmed",
  "অর্ডার কনফার্ম": "Confirm Order",
  "কনফার্ম করুন": "Confirm",
  "অর্ডার নিশ্চিত করুন": "Confirm Order",
  "অর্ডার নিশ্চিত": "Order Confirmed",
  "বিক্রয়": "Sales",
  "এই সময়সীমায়": "For This Period",
  "প্রসেস": "Processed",
  "সফল": "Success",
  "সফলভাবে সংরক্ষণ করা হয়েছে": "Saved Successfully",
  "সফলভাবে আপডেট করা হয়েছে": "Updated Successfully",
  "সফলভাবে মুছে ফেলা হয়েছে": "Deleted Successfully",
  "ত্রুটি": "Error",
  "কিছু ভুল হয়েছে": "Something went wrong",
  "নিশ্চিত করুন": "Confirm",
  "আপনি কি নিশ্চিত?": "Are you sure?",
  "হ্যাঁ": "Yes",
  "না": "No",
  "আবার চেষ্টা করুন": "Try Again",
  "সফলভাবে সম্পন্ন হয়েছে": "Completed Successfully",
  "কর্মচারী যোগ করুন": "Add Employee",
  "নতুন কর্মচারী": "New Employee",
  "কর্মচারী তথ্য": "Employee Information",
  "পারমিশন": "Permissions",
  "অনুমতি": "Permissions",
  "রোল": "Role",
  "অ্যাডমিন": "Admin",
  "স্টাফ": "Staff",
  "অ্যাক্সেস": "Access",
  "অনুমোদিত": "Allowed",
  "লগআউট": "Logout",
  "অনুমোদিত নয়": "Not Allowed",
  "সুইচ করুন": "Switch",
  "ইংরেজি": "English",
  "বাংলা": "Bengali",
  "বাংলায় পরিবর্তন করুন": "Switch to Bengali",
  "ইংরেজিতে পরিবর্তন করুন": "Switch to English",
  "Expand Sidebar": "Expand Sidebar",
  "Collapse Sidebar": "Collapse Sidebar",
  "সেটিংস সংরক্ষণ করুন": "Save Settings",
  "সেটিংস আপডেট করুন": "Update Settings",
  "সক্রিয় করুন": "Enable",
  "নিষ্ক্রিয় করুন": "Disable",
  "হ্যাঁ, মুছে ফেলুন": "Yes, Delete",
  "না, বাতিল করুন": "No, Cancel",
  "অর্ডার ডিলিট": "Delete Order",
  "অর্ডার মুছুন": "Delete Order",
  "অর্ডার পুনরুদ্ধার": "Restore Order",
  "পুনরুদ্ধার": "Restore",
  "বাল্ক অ্যাকশন": "Bulk Actions",
  "নির্বাচিত": "Selected",
  "নির্বাচন করুন": "Select",
  "সব নির্বাচন করুন": "Select All",
  "কোনো ফলাফল নেই": "No Results",
  "কোনো রেজাল্ট পাওয়া যায়নি": "No Results Found",
  "এরর": "Error",
  "সফলভাবে": "Successfully",
  "চালু": "Enabled",
  "বন্ধ": "Disabled",
  "প্রোফাইল": "Profile",
  "ব্যবহারকারী": "User",
  "ব্যবহারকারীর নাম": "Username",
  "পাসওয়ার্ড": "Password",
  "লগইন": "Login",
  "লগইন করুন": "Log In",
  "লগআউট করুন": "Log Out",
  "কুরিয়ার": "Courier",
  "কুরিয়ার": "Courier",
  "কুরিয়ার নির্বাচন করুন": "Select Courier",
  "কুরিয়ার নির্বাচন করুন": "Select Courier",
  "ডেলিভারি": "Delivery",
  "ট্র্যাকিং": "Tracking",
  "ট্র্যাকিং নম্বর": "Tracking Number",
  "নোট": "Note",
  "নোটস": "Notes",
  "ফোন": "Phone",
  "মোবাইল": "Mobile",
  "মোবাইল নম্বর": "Mobile Number",
  "জেলা": "District",
  "উপজেলা": "Upazila",
  "বিভাগ": "Division",
  "কর্মচারী": "Employee",
  "কর্মচারী তালিকা": "Employee List",
  "পণ্য তালিকা": "Product List",
  "ক্যাটাগরি তালিকা": "Category List",
  "অর্ডার তালিকা": "Order List",
  "কাস্টমার তালিকা": "Customer List",
  "ফর্ম": "Form",
  "ফর্ম সাবমিট করুন": "Submit Form",
  "সাবমিট": "Submit",
  "নির্বাচন": "Selection",
  "বাছাই করুন": "Select",
  "বিবরণ লিখুন": "Enter Description",
  "নাম লিখুন": "Enter Name",
  "ফোন নম্বর লিখুন": "Enter Phone Number",
  "ঠিকানা লিখুন": "Enter Address",
  "পরিমাণ লিখুন": "Enter Quantity",
  "মূল্য লিখুন": "Enter Price",
  "তারিখ নির্বাচন করুন": "Select Date",
  "শুরু": "Start",
  "শেষ": "End",
  "থেকে": "From",
  "পর্যন্ত": "To",
  "আজকের": "Today's",
  "মোট মূল্য": "Total Price",
  "মোট পরিমাণ": "Total Quantity",
  "ডেলিভারি ঠিকানা": "Delivery Address",
  "অর্ডারের তথ্য": "Order Information",
  "কাস্টমারের তথ্য": "Customer Information",
  "পণ্যের তথ্য": "Product Information",
  "অর্ডার আইটেম": "Order Items",
  "আইটেম": "Item",
  "সর্বমোট": "Grand Total",
  "ডিসকাউন্ট": "Discount",
  "কুপন কোড": "Coupon Code",
  "কুপন নির্বাচন করুন": "Select Coupon",
  "কুপন প্রয়োগ করুন": "Apply Coupon",
  "প্রয়োগ করুন": "Apply",
  "পরিবর্তন সংরক্ষণ করুন": "Save Changes",
  "পরিবর্তন বাতিল করুন": "Discard Changes",
  "লোড": "Load",
  "রিলোড": "Reload",
  "রিফ্রেশ করুন": "Refresh",
  "ক্লিয়ার": "Clear",
  "মুছে দিন": "Clear",
  "সকল স্ট্যাটাস": "All Statuses",
  "স্ট্যাটাস নির্বাচন করুন": "Select Status",
  "অর্ডার স্ট্যাটাস": "Order Status",
  "পেমেন্ট পদ্ধতি": "Payment Method",
  "পেমেন্ট পদ্ধতি নির্বাচন করুন": "Select Payment Method",
  "ক্যাশ": "Cash",
  "অনলাইন": "Online",
  "বিকাশ": "bKash",
  "নগদ": "Nagad",
  "ডেলিভারি চার্জ": "Delivery Charge",
  "মোট বিল": "Total Bill",
  "অর্ডার তৈরি হয়েছে": "Order Created",
  "অর্ডার আপডেট হয়েছে": "Order Updated",
  "অর্ডার সফলভাবে আপডেট হয়েছে": "Order updated successfully",
  "অর্ডার সফলভাবে তৈরি হয়েছে": "Order created successfully",
  "অর্ডার সফলভাবে বাতিল হয়েছে": "Order cancelled successfully",
  "অর্ডার সফলভাবে ডিলিট হয়েছে": "Order deleted successfully",
};

const BN = Object.fromEntries(Object.entries(EN).map(([bn]) => [bn, bn]));

function readInitialLanguage(): AdminLanguage {
  if (typeof window === "undefined") return "bn";
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "en" || value === "bn" ? value : "bn";
}

function containsBengali(value: string) {
  return /[\u0980-\u09FF]/.test(value);
}

function translateExact(value: string, language: AdminLanguage) {
  const key = value.trim();
  if (!containsBengali(key)) return value;
  if (language === "bn") return BN[key] ?? value;
  return EN[key] ?? value;
}

export function AdminLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AdminLanguage>(readInitialLanguage);

  const setLanguage = (next: AdminLanguage) => {
    setLanguageState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<AdminLanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (bn, en) => language === "en" ? (en ?? EN[bn] ?? bn) : bn,
  }), [language]);

  return <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>;
}

export function useAdminLanguage() {
  const context = useContext(AdminLanguageContext);
  if (!context) throw new Error("useAdminLanguage must be used inside AdminLanguageProvider");
  return context;
}

/**
 * Translates existing legacy admin JSX without touching customer/order data.
 * Only exact UI strings in the centralized dictionary are changed.
 * A MutationObserver keeps dynamically rendered tables, modals, tabs, mobile UI,
 * dropdowns and toast messages synchronized after navigation or state changes.
 */
export function AdminLanguageSurface({ children }: { children: ReactNode }) {
  const { language } = useAdminLanguage();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.querySelector("[data-admin-language-surface]") as HTMLElement | null;
    if (!root) return;

    const translateNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const value = node.nodeValue ?? "";
        const translated = translateExact(value, language);
        if (translated !== value) node.nodeValue = translated;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      if (el.closest("[data-admin-language-ignore]")) return;
      ["placeholder", "title", "aria-label"].forEach((attribute) => {
        const value = el.getAttribute(attribute);
        if (!value) return;
        const translated = translateExact(value, language);
        if (translated !== value) el.setAttribute(attribute, translated);
      });
      for (const child of Array.from(el.childNodes)) translateNode(child);
    };

    translateNode(root);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) translateNode(node);
        if (mutation.type === "characterData" && mutation.target) translateNode(mutation.target);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return <div data-admin-language-surface="true" className="contents">{children}</div>;
}
