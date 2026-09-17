import { BadgeCheck, LockKeyhole, PhoneCall, ShieldAlert } from "lucide-react";

/** Premium full-screen notice shown to blocked visitors (IP, device or account). */
export function BlockedNotice() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-foreground px-4 py-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-destructive" />
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="overflow-hidden rounded-lg border border-border/20 bg-card p-6 text-center text-card-foreground shadow-2xl sm:p-8">
          <div className="mb-6 flex items-center justify-between border-b border-border pb-4 text-xs font-bold text-muted-foreground">
            <span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-destructive" /> নিরাপত্তা নোটিশ</span>
            <span className="inline-flex items-center gap-1 text-brand"><BadgeCheck className="h-4 w-4" /> Sheikh Seeds</span>
          </div>
          <span className="relative mx-auto mb-5 grid h-20 w-20 place-items-center rounded-lg bg-destructive text-destructive-foreground shadow-lg">
            <span className="absolute inset-0 animate-ping rounded-lg bg-destructive/20 motion-reduce:hidden" />
            <ShieldAlert className="relative h-9 w-9" strokeWidth={2.3} />
          </span>
          <h1 className="text-2xl font-black leading-tight text-card-foreground">আপনাকে ব্লক করা হয়েছে</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-7 text-muted-foreground">
            দুঃখিত, এই ডিভাইস বা সংযোগ থেকে আমাদের ওয়েবসাইটে প্রবেশ বন্ধ করা হয়েছে। কোনো ভুল হয়ে থাকলে আমাদের সাপোর্ট টিমের সঙ্গে যোগাযোগ করুন।
          </p>
          <div className="mt-6 flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs font-bold text-card-foreground">
            <span>অ্যাক্সেস স্ট্যাটাস</span><span className="text-destructive">Blocked</span>
          </div>
          <a
            href="tel:+8809644553383"
            className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-lg bg-destructive px-5 text-sm font-black text-destructive-foreground shadow-lg transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            <PhoneCall className="h-4 w-4" /> সাপোর্টে কল করুন
          </a>
        </div>
      </div>
    </div>
  );
}
