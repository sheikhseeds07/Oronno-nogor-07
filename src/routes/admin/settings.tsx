import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { uploadToBucket, safeFileName } from "@/lib/storage-upload";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

type Settings = {
  // ডেলিভারি
  delivery_charge_inside?: number;
  delivery_charge_outside?: number;
  free_delivery_above?: number;
  // SEO
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  seo_og_image?: string;
  seo_site_url?: string;
  seo_google_verification?: string;
  seo_robots?: string;
  [key: string]: unknown;
};

const SEO_DEFAULTS = {
  seo_title: "অরন্য নগর (Oronno Nogor) — অরিজিনাল বীজ, গার্ডেন টুলস ও সার",
  seo_description:
    "অরন্য নগর — ছাদ বাগানির বিশ্বস্ত সঙ্গী। ১০০% অরিজিনাল সবজি, ফল ও ফুলের বীজ, গার্ডেন টুলস, সার ও কীটনাশক অনলাইনে অর্ডার করুন। সারাদেশে হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি।",
  seo_keywords:
    "অরন্য নগর, অরন্যনগর, oronno nogor, oronnonogor, বীজ, সবজির বীজ, ফুলের বীজ, ফলের বীজ, গার্ডেন টুলস, সার, কীটনাশক, ছাদ বাগান, ছাদ বাগানের দোকান, seeds bd, garden tools bd, online nursery bangladesh",
  seo_og_image: "https://oronnonogor.com/og-oronno-nogor.jpg",
  seo_site_url: "https://oronnonogor.com",
  seo_google_verification: "",
  seo_robots: "index, follow",
};


function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full border rounded-lg px-3 py-2 mt-1";

function SettingsPage() {
  const qc = useQueryClient();
  const [s, setS] = useState<Settings>({});
  const [id, setId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickImage = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToBucket("banners", `seo/${safeFileName(file.name)}`, file);
      setS((prev) => ({ ...prev, seo_og_image: url }));
      toast.success("ছবি আপলোড হয়েছে — এখন 'সংরক্ষণ করুন' চাপুন");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "আপলোড হয়নি");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };


  const { data } = useQuery({
    queryKey: ["site-settings-admin"],
    queryFn: async () => (await supabase.from("site_settings").select("*").maybeSingle()).data,
  });

  useEffect(() => {
    if (data) {
      const cur = (data.settings as Settings) ?? {};
      // SEO ঘর ফাঁকা থাকলে ডিফল্ট ভ্যালু বসে যাবে (পরে ইচ্ছেমতো বদলানো যাবে)
      setS({
        ...cur,
        seo_title: cur.seo_title || SEO_DEFAULTS.seo_title,
        seo_description: cur.seo_description || SEO_DEFAULTS.seo_description,
        seo_keywords: cur.seo_keywords || SEO_DEFAULTS.seo_keywords,
        seo_og_image: cur.seo_og_image || SEO_DEFAULTS.seo_og_image,
        seo_site_url: cur.seo_site_url || SEO_DEFAULTS.seo_site_url,
        seo_google_verification: cur.seo_google_verification || SEO_DEFAULTS.seo_google_verification,
        seo_robots: cur.seo_robots || SEO_DEFAULTS.seo_robots,
      });
      setId(data.id);
    }
  }, [data]);

  const save = async () => {
    const payload: Settings = {
      ...s,
      delivery_charge_inside: s.delivery_charge_inside ?? 60,
      delivery_charge_outside: s.delivery_charge_outside ?? 130,
      free_delivery_above: s.free_delivery_above ?? 1000,
    };
    if (id) {
      const { error } = await supabase.from("site_settings").update({ settings: payload as never }).eq("id", id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("site_settings").insert({ settings: payload as never });
      if (error) return toast.error(error.message);
    }
    toast.success("সংরক্ষণ হয়েছে");
    qc.invalidateQueries({ queryKey: ["site-settings-admin"] });
    qc.invalidateQueries({ queryKey: ["site-settings-public"] });
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-4">সেটিংস</h1>

      <div className="bg-white border rounded-xl p-5 max-w-3xl space-y-4 mb-5">
        <h2 className="font-bold text-lg">ডেলিভারি চার্জ</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="ঢাকার ভেতরে চার্জ (৳)">
            <input type="number" value={s.delivery_charge_inside ?? 60} onChange={(e) => setS({ ...s, delivery_charge_inside: +e.target.value })} className={inputCls} />
          </Field>
          <Field label="ঢাকার বাইরে চার্জ (৳)">
            <input type="number" value={s.delivery_charge_outside ?? 130} onChange={(e) => setS({ ...s, delivery_charge_outside: +e.target.value })} className={inputCls} />
          </Field>
          <Field label="ফ্রি ডেলিভারি (৳ এর বেশি)">
            <input type="number" value={s.free_delivery_above ?? 1000} onChange={(e) => setS({ ...s, free_delivery_above: +e.target.value })} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 max-w-3xl space-y-4">
        <div>
          <h2 className="font-bold text-lg">SEO সেটিংস</h2>
          <p className="text-xs text-muted-foreground">Google ও Facebook-এ সাইট কেমন দেখাবে তা এখান থেকে নিয়ন্ত্রণ করুন।</p>
        </div>

        <Field label="Meta Title (৬০ অক্ষরের ভেতরে ভালো)" hint={`বর্তমান: ${(s.seo_title ?? "").length} অক্ষর`}>
          <input value={s.seo_title ?? ""} onChange={(e) => setS({ ...s, seo_title: e.target.value })} className={inputCls} />
        </Field>

        <Field label="Meta Description (১৬০ অক্ষরের ভেতরে ভালো)" hint={`বর্তমান: ${(s.seo_description ?? "").length} অক্ষর`}>
          <textarea rows={3} value={s.seo_description ?? ""} onChange={(e) => setS({ ...s, seo_description: e.target.value })} className={inputCls} />
        </Field>

        <Field label="Keywords (কমা দিয়ে আলাদা)">
          <textarea rows={2} value={s.seo_keywords ?? ""} onChange={(e) => setS({ ...s, seo_keywords: e.target.value })} className={inputCls} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="সাইট URL (canonical)" hint="যেমন: https://oronnonogor.com">
            <input value={s.seo_site_url ?? ""} onChange={(e) => setS({ ...s, seo_site_url: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Google Site Verification code" hint="Search Console-এর meta ট্যাগের content অংশটুকু">
            <input value={s.seo_google_verification ?? ""} onChange={(e) => setS({ ...s, seo_google_verification: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Robots" hint="সাধারণত: index, follow">
            <select value={s.seo_robots ?? "index, follow"} onChange={(e) => setS({ ...s, seo_robots: e.target.value })} className={inputCls}>
              <option value="index, follow">index, follow (Google-এ দেখাবে)</option>
              <option value="noindex, nofollow">noindex, nofollow (লুকানো থাকবে)</option>
            </select>
          </Field>
        </div>

        <Field label="Share Image (Google/Facebook-এ যে ছবি দেখাবে)" hint="১২০০x৬৩০ px ছবি সবচেয়ে ভালো। ছবি আপলোড করুন অথবা URL বসান।">
          <div className="mt-1 flex flex-col sm:flex-row gap-3 sm:items-start">
            <div className="w-full sm:w-64 shrink-0">
              {s.seo_og_image ? (
                <img src={s.seo_og_image} alt="Share image preview" className="w-full aspect-[1200/630] object-cover rounded-lg border bg-slate-100" />
              ) : (
                <div className="w-full aspect-[1200/630] rounded-lg border border-dashed grid place-items-center text-xs text-muted-foreground bg-slate-50">
                  কোনো ছবি নেই
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => pickImage(e.target.files?.[0])}
                className="block w-full text-sm border rounded-lg px-3 py-2"
              />
              {uploading && <p className="text-xs text-emerald-700">আপলোড হচ্ছে…</p>}
              <input
                value={s.seo_og_image ?? ""}
                onChange={(e) => setS({ ...s, seo_og_image: e.target.value })}
                placeholder="https://oronnonogor.com/og-oronno-nogor.jpg"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setS({ ...s, seo_og_image: "https://oronnonogor.com/og-oronno-nogor.jpg" })}
                  className="text-xs border rounded-lg px-3 py-1.5 hover:bg-slate-50"
                >
                  অরন্য নগর ডিফল্ট ছবি
                </button>
                {s.seo_og_image && (
                  <button type="button" onClick={() => setS({ ...s, seo_og_image: "" })} className="text-xs border rounded-lg px-3 py-1.5 text-red-600 hover:bg-red-50">
                    ছবি সরান
                  </button>
                )}
              </div>
            </div>
          </div>
        </Field>

        <div className="border rounded-lg p-3 bg-slate-50">
          <p className="text-xs font-medium mb-2">Google প্রিভিউ</p>
          <p className="text-[13px] text-emerald-700">{s.seo_site_url}</p>
          <p className="text-[#1a0dab] text-base leading-snug">{s.seo_title}</p>
          <p className="text-xs text-slate-600 line-clamp-2">{s.seo_description}</p>
        </div>


        <button onClick={save} className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold">সংরক্ষণ করুন</button>
      </div>
    </AdminLayout>
  );
}
