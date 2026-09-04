import { ShieldAlert } from "lucide-react";

/** Full-screen notice shown to visitors whose IP is on the block list. */
export function BlockedNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-700">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-extrabold text-slate-900">আপনাকে Block করা হয়েছে</h1>
        <p className="mt-2 text-sm text-slate-600">
          এই সাইটে আপনার প্রবেশ বন্ধ করা হয়েছে। ভুল হয়ে থাকলে আমাদের সাথে যোগাযোগ করুন।
        </p>
      </div>
    </div>
  );
}
