import { SafeImage } from "@/components/SafeImage";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { uploadToBucket, safeFileName } from "@/lib/storage-upload";
import { mergeContent, type SeedRow } from "@/lib/landing-content";
import { toast } from "sonner";
import { ImagePlus, Save, X } from "lucide-react";

export const Route = createFileRoute("/admin/landing-seeds")({ component: LandingSeedsAdmin });

type LP = { id: string; slug: string; title: string; planting_steps: unknown };

function LandingSeedsAdmin() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-seed-images"],
    queryFn: async () => {
      const { data, error } = await supabase.from("landing_pages").select("id,slug,title,planting_steps").eq("slug", "seedcombo").maybeSingle();
      if (error) throw error;
      return data as LP | null;
    },
  });

  const initial = mergeContent(data?.planting_steps);
  const [seeds, setSeeds] = useState<SeedRow[] | null>(null);
  const rows = seeds ?? initial.seed_table;

  const update = (index: number, patch: Partial<SeedRow>) => {
    setSeeds(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  };

  const upload = async (index: number, file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("শুধু image ফাইল দিন");
    if (file.size > 8 * 1024 * 1024) return toast.error("ইমেজ ৮MB-এর মধ্যে দিন");
    setUploading(index);
    try {
      const url = await uploadToBucket("site-assets", `seed-combo-${index + 1}-${safeFileName(file.name)}`, file);
      update(index, { image: url });
      toast.success(`${rows[index]?.name || "ইমেজ"} আপলোড হয়েছে`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ইমেজ আপলোড হয়নি");
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!data?.id) return toast.error("seedcombo landing page পাওয়া যায়নি");
    setSaving(true);
    try {
      const content = { ...initial, seed_table: rows };
      const { error } = await supabase.from("landing_pages").update({ planting_steps: content }).eq("id", data.id);
      if (error) throw error;
      setSeeds(rows);
      qc.invalidateQueries({ queryKey: ["admin-seed-images"] });
      toast.success("২৪টি বীজের তথ্য ও ইমেজ সংরক্ষণ হয়েছে");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "সংরক্ষণ হয়নি");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-4 pb-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Seed Combo — ২৪টি বীজ</h1>
            <p className="text-sm text-muted-foreground mt-1">প্রতিটি কার্ডে সরাসরি ইমেজ আপলোড করুন। নাম ও পরিমাণও এখান থেকে ঠিক থাকবে।</p>
          </div>
          <button onClick={save} disabled={saving || isLoading} className="bg-brand text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? "সংরক্ষণ হচ্ছে…" : "সব সংরক্ষণ"}
          </button>
        </div>

        {isLoading ? <div className="p-8 text-center text-muted-foreground">লোড হচ্ছে…</div> : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {rows.map((seed, index) => (
              <div key={`${seed.name}-${index}`} className="rounded-xl border bg-card p-2.5 space-y-2">
                <div className="aspect-[1/.82] rounded-lg overflow-hidden bg-muted flex items-center justify-center relative">
                  {seed.image ? <SafeImage src={seed.image} alt={seed.name} className="w-full h-full object-cover" /> : <div className="text-3xl">🌱</div>}
                  <label className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-lg bg-black/65 text-white py-1.5 text-xs font-semibold cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5" /> {uploading === index ? "আপলোড…" : seed.image ? "ইমেজ পরিবর্তন" : "ইমেজ আপলোড"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(index, f); e.currentTarget.value = ""; }} />
                  </label>
                </div>
                <input value={seed.name} onChange={(e) => update(index, { name: e.target.value })} className="w-full border rounded-lg px-2.5 py-2 text-sm font-semibold" aria-label="বীজের নাম" />
                <input value={seed.qty} onChange={(e) => update(index, { qty: e.target.value })} className="w-full border rounded-lg px-2.5 py-2 text-sm" aria-label="পরিমাণ" />
                {seed.image && <button type="button" onClick={() => update(index, { image: "" })} className="text-xs text-destructive font-semibold flex items-center gap-1"><X className="w-3 h-3" /> ইমেজ সরান</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
