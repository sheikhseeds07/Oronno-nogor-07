import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, ArrowRight, Tag, Sparkles } from "lucide-react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { taka, bnDigits } from "@/lib/format";

export const Route = createFileRoute("/offers")({ component: OffersPage });

type Offer = { id:string; name:string; slug:string; price:number; sale_price:number|null; images:string[]; short_description:string|null; stock:number };

function OffersPage() {
  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["customer-offers"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("products") as any)
        .select("id,name,slug,price,sale_price,images,short_description,stock")
        .eq("is_offer", true).eq("is_active", true).eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Offer[];
    },
  });

  return <SiteLayout>
    <main className="container mx-auto max-w-5xl px-3 py-4 sm:px-5 sm:py-7">
      <section className="relative mb-5 overflow-hidden rounded-[24px] border border-brand/10 bg-gradient-to-br from-brand-light/60 via-white to-amber-50/40 p-5 shadow-[0_18px_55px_-35px_rgba(20,83,45,.55)] sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex items-center gap-2 text-brand-dark"><Tag className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[.18em]">Sheikh Seeds Offers</span></div>
        <h1 className="relative mt-1 text-2xl font-black tracking-tight text-brand-dark sm:text-3xl">বিশেষ অফার ও কম্বো</h1>
        <p className="relative mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">একসাথে একাধিক পণ্য নিয়ে তৈরি বিশেষ কম্বো—সাশ্রয়ী দামে, সহজে অর্ডার করুন।</p>
      </section>

      {isLoading ? <div className="py-16 text-center text-sm text-muted-foreground">অফার লোড হচ্ছে...</div> : offers.length === 0 ? <div className="rounded-2xl border border-dashed border-brand/20 bg-brand-light/20 py-16 text-center"><Sparkles className="mx-auto mb-2 h-7 w-7 text-brand" /><p className="text-sm font-bold text-muted-foreground">এই মুহূর্তে কোনো অফার নেই</p></div> : <div className="space-y-4">{offers.map((o, i) => { const price = o.sale_price ?? o.price; const discount = o.sale_price && o.sale_price < o.price ? Math.round(((o.price-o.sale_price)/o.price)*100) : 0; return <article key={o.id} className="group overflow-hidden rounded-[22px] border border-brand/10 bg-white shadow-[0_12px_40px_-28px_rgba(20,83,45,.55)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-28px_rgba(20,83,45,.6)]" style={{animationDelay:`${i*50}ms`}}><Link to="/product/$slug" params={{slug:o.slug}} className="grid grid-cols-[112px_1fr] gap-3 p-3 sm:grid-cols-[180px_1fr] sm:p-4"><div className="relative aspect-square overflow-hidden rounded-2xl bg-brand-light/30"><img src={o.images?.[0] || "/placeholder.svg"} alt={o.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />{discount>0 && <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-1 text-[9px] font-black text-white">{bnDigits(discount)}% ছাড়</span>}</div><div className="flex min-w-0 flex-col justify-center"><div className="mb-1 inline-flex w-fit items-center gap-1 rounded-full bg-brand-light px-2 py-1 text-[9px] font-black text-brand-dark"><Sparkles className="h-3 w-3" /> SPECIAL COMBO</div><h2 className="text-base font-black leading-snug text-foreground sm:text-xl">{o.name}</h2>{o.short_description && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground sm:text-sm">{o.short_description}</p>}<div className="mt-2.5 flex flex-wrap items-center gap-2"><span className="text-xl font-black text-brand-dark">{taka(price)}</span>{discount>0 && <span className="text-xs font-bold text-muted-foreground line-through">{taka(o.price)}</span>}<span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand px-3 py-2 text-[10px] font-black text-white shadow-sm"><ShoppingCart className="h-3.5 w-3.5" /> অর্ডার করুন <ArrowRight className="h-3 w-3" /></span></div></div></Link></article>; })}</div>}
    </main>
  </SiteLayout>;
}
