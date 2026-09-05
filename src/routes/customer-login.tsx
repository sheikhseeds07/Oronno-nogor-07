import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { customerSendOtp, customerVerifyOtp } from "@/lib/customer-auth.functions";
import { Phone, ShieldCheck, ArrowRight, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/customer-login")({
  component: CustomerLogin,
  head: () => ({
    meta: [
      { title: "কাস্টমার লগইন — Sheikh Seeds" },
      { name: "description", content: "মোবাইল নম্বর দিয়ে লগইন করে অর্ডার, রিভিউ ও কমিউনিটিতে অংশ নিন।" },
      { property: "og:title", content: "কাস্টমার লগইন — Sheikh Seeds" },
      { property: "og:description", content: "মোবাইল নম্বর দিয়ে লগইন করে অর্ডার, রিভিউ ও কমিউনিটিতে অংশ নিন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CustomerLogin() {
  const navigate = useNavigate();
  const sendOtp = useServerFn(customerSendOtp);
  const verifyOtp = useServerFn(customerVerifyOtp);

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const validPhone = /^01[3-9][0-9]{8}$/.test(phone.replace(/\D/g, ""));

  const doSend = async () => {
    if (!validPhone) return toast.error("সঠিক মোবাইল নম্বর দিন (০১XXXXXXXXX)");
    setBusy(true);
    try {
      await sendOtp({ data: { phone } });
      setStep("code");
      toast.success("কোড পাঠানো হয়েছে");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "কোড পাঠানো যায়নি");
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    if (code.trim().length < 4) return toast.error("কোডটি লিখুন");
    setBusy(true);
    try {
      const res = await verifyOtp({ data: { phone, code: code.trim(), fullName: name.trim() || undefined } });
      const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: res.tokenHash });
      if (error) throw new Error(error.message);
      toast.success("সফলভাবে লগইন হয়েছে");
      navigate({ to: "/profile" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "কোড মিলেনি");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteLayout>
      <div className="container mx-auto px-3 py-10">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border bg-white shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="bg-gradient-to-br from-brand to-brand-dark text-white px-6 py-7 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-3">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-extrabold">কাস্টমার লগইন</h1>
              <p className="text-white/80 text-sm mt-1">মোবাইল নম্বর দিয়েই লগইন — পাসওয়ার্ড লাগবে না</p>
            </div>

            <div className="p-6 space-y-4">
              {step === "phone" ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div>
                    <label className="text-sm font-semibold">মোবাইল নম্বর</label>
                    <div className="mt-1 flex items-center gap-2 border rounded-xl px-3 focus-within:border-brand transition">
                      <Phone className="w-4 h-4 text-brand-dark" />
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        inputMode="numeric"
                        placeholder="01XXXXXXXXX"
                        className="flex-1 py-3 outline-none bg-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">আপনার নাম (ঐচ্ছিক)</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="নাম লিখুন"
                      className="mt-1 w-full border rounded-xl px-3 py-3 outline-none focus:border-brand transition"
                    />
                  </div>
                  <button
                    onClick={doSend}
                    disabled={busy}
                    className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    কোড পাঠান
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{phone}</span> নম্বরে পাঠানো কোডটি লিখুন
                  </p>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    placeholder="• • • •"
                    className="w-full border rounded-xl px-3 py-4 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-brand transition"
                  />
                  <button
                    onClick={doVerify}
                    disabled={busy}
                    className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    লগইন করুন
                  </button>
                  <button
                    onClick={() => setStep("phone")}
                    className="w-full text-sm text-muted-foreground flex items-center justify-center gap-1 hover:text-brand-dark transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> নম্বর পরিবর্তন করুন
                  </button>
                </div>
              )}

              <div className="pt-2 text-center text-xs text-muted-foreground">
                লগইন ছাড়াও আপনি <Link to="/shop" className="text-brand-dark font-semibold">কেনাকাটা</Link> করতে পারবেন।
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
