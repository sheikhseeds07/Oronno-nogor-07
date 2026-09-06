import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { useAuth } from "@/lib/auth";
import { customerSendOtp, customerVerifyOtp } from "@/lib/customer-auth.functions";
import { Phone, ShieldCheck, ArrowRight, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/customer-login")({
  component: CustomerLogin,
  head: () => ({
    meta: [
      { title: "কাস্টমার লগইন — Sheikh Seeds" },
      { name: "description", content: "মোবাইল নম্বর দিয়ে নিরাপদে লগইন করে অর্ডার, রিভিউ ও কমিউনিটিতে অংশ নিন।" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CustomerLogin() {
  const navigate = useNavigate();
  const { user, initialized } = useAuth();
  const sendOtp = useServerFn(customerSendOtp);
  const verifyOtp = useServerFn(customerVerifyOtp);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const validPhone = /^01[3-9][0-9]{8}$/.test(phone.replace(/\D/g, ""));

  useEffect(() => {
    if (initialized && user) navigate({ to: "/profile", replace: true });
  }, [initialized, user, navigate]);

  const doSend = async () => {
    const normalizedPhone = phone.replace(/\D/g, "");
    if (!/^01[3-9][0-9]{8}$/.test(normalizedPhone)) {
      return toast.error("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (০১XXXXXXXXX)");
    }
    setBusy(true);
    try {
      await sendOtp({ data: { phone: normalizedPhone } });
      setPhone(normalizedPhone);
      setDigits(["", "", "", ""]);
      setCode("");
      setStep("code");
      toast.success("আপনার নম্বরে OTP পাঠানো হয়েছে");
      setTimeout(() => codeRefs.current[0]?.focus(), 120);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "OTP পাঠানো যায়নি");
    } finally {
      setBusy(false);
    }
  };

  const updateDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setCode(next.join(""));
    if (clean && index < 3) codeRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      setCode(next.join(""));
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    const next = ["", "", "", ""];
    pasted.split("").forEach((d, i) => (next[i] = d));
    setDigits(next);
    setCode(pasted);
    codeRefs.current[Math.min(pasted.length, 4) - 1]?.focus();
  };

  const doVerify = async () => {
    const otp = code.replace(/\D/g, "");
    if (otp.length !== 4) return toast.error("৪ ডিজিটের OTP কোডটি সম্পূর্ণ লিখুন");
    setBusy(true);
    try {
      // Profile details are intentionally collected after login from /profile.
      const res = await verifyOtp({ data: { phone, code: otp } });
      const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: res.tokenHash });
      if (error) throw new Error(error.message);
      toast.success("সফলভাবে লগইন হয়েছে");
      navigate({ to: "/profile" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "OTP কোডটি সঠিক নয়");
    } finally {
      setBusy(false);
    }
  };

  if (initialized && user) return null;

  return (
    <SiteLayout>
      <div className="container mx-auto px-3 py-8 sm:py-10">
        <div className="mx-auto w-full max-w-md">
          <div className="overflow-hidden rounded-[28px] border bg-white shadow-[0_20px_60px_rgba(20,83,45,.12)] animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="relative overflow-hidden bg-gradient-to-br from-brand via-brand-dark to-emerald-950 px-6 py-7 text-center text-white sm:px-7 sm:py-8">
              <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-lime-300/20 blur-2xl" />
              <div className="absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
              <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner backdrop-blur-sm">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h1 className="relative text-xl font-extrabold tracking-tight">কাস্টমার লগইন</h1>
              <p className="relative mt-1 text-sm text-white/80">মোবাইল নম্বর দিয়ে নিরাপদে লগইন করুন</p>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {step === "phone" ? (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div>
                    <label className="text-sm font-bold text-foreground">মোবাইল নম্বর</label>
                    <p className="mt-1 text-xs text-muted-foreground">আপনার ১১ ডিজিটের বাংলাদেশি নম্বরটি দিন</p>
                    <div className="mt-2 flex items-center gap-2 rounded-2xl border bg-muted/20 px-3.5 transition-all focus-within:border-brand focus-within:bg-background focus-within:ring-4 focus-within:ring-brand/10">
                      <Phone className="h-4 w-4 shrink-0 text-brand-dark" />
                      <input
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                        onKeyDown={e => e.key === "Enter" && validPhone && doSend()}
                        inputMode="numeric"
                        autoComplete="tel"
                        placeholder="01XXXXXXXXX"
                        className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/60"
                      />
                    </div>
                  </div>
                  <button onClick={doSend} disabled={busy || !validPhone} className="w-full rounded-2xl bg-brand py-3.5 font-bold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-dark active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50">
                    {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : <><span>OTP কোড পাঠান</span><ArrowRight className="ml-2 inline h-4 w-4" /></>}
                  </button>
                </div>
              ) : (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-brand-light text-brand-dark">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h2 className="text-base font-extrabold">OTP দিয়ে যাচাই করুন</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground"><span className="font-bold text-foreground">{phone}</span> নম্বরে ৪ ডিজিটের কোড পাঠানো হয়েছে</p>
                  </div>

                  <div className="flex justify-center gap-2.5 sm:gap-3">
                    {digits.map((digit, index) => (
                      <input
                        key={index}
                        ref={el => { codeRefs.current[index] = el; }}
                        value={digit}
                        onChange={e => updateDigit(index, e.target.value)}
                        onKeyDown={e => handleCodeKeyDown(index, e)}
                        onPaste={handleCodePaste}
                        inputMode="numeric"
                        autoComplete={index === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        aria-label={`OTP digit ${index + 1}`}
                        className="h-14 w-14 rounded-2xl border-2 bg-muted/20 text-center text-2xl font-black text-foreground outline-none shadow-sm transition-all focus:border-brand focus:bg-background focus:ring-4 focus:ring-brand/10 sm:h-16 sm:w-16"
                      />
                    ))}
                  </div>

                  <button onClick={doVerify} disabled={busy || code.length !== 4} className="w-full rounded-2xl bg-brand py-3.5 font-bold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-dark active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50">
                    {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : <><ShieldCheck className="mr-2 inline h-4 w-4" />লগইন সম্পন্ন করুন</>}
                  </button>
                  <button onClick={() => { setStep("phone"); setDigits(["", "", "", ""]); setCode(""); }} className="mx-auto flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-brand-dark">
                    <RotateCcw className="h-3.5 w-3.5" /> মোবাইল নম্বর পরিবর্তন করুন
                  </button>
                </div>
              )}

              <div className="border-t pt-4 text-center text-[11px] leading-5 text-muted-foreground">
                লগইন করার পর <span className="font-semibold text-foreground">প্রোফাইল</span> থেকে আপনার নাম, প্রোফাইল ছবি ও কভার ছবি পরিবর্তন করতে পারবেন।
                <br />লগইন ছাড়াও <Link to="/shop" className="font-bold text-brand-dark">কেনাকাটা</Link> করা যাবে।
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
