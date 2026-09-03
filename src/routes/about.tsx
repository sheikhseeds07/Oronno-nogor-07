import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ShieldCheck, Truck, Sprout, Headphones } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({
    meta: [
      { title: "আমাদের সম্পর্কে — Sheikh Seeds (শেখ সিডস)" },
      { name: "description", content: "Sheikh Seeds (শেখ সিডস) বাংলাদেশের একটি বিশ্বস্ত অনলাইন বীজ ও কৃষি উপকরণ প্রতিষ্ঠান — অরিজিনাল সবজি, ফল ও ফুলের বীজ, গার্ডেন টুলস, সার ও কীটনাশক সারাদেশে ডেলিভারি।" },
      { name: "keywords", content: "Sheikh Seeds, শেখ সিডস, sheikhseeds.com, বীজের দোকান, অনলাইন বীজ, কৃষি উপকরণ, বাংলাদেশ বীজ" },
      { property: "og:title", content: "আমাদের সম্পর্কে — Sheikh Seeds" },
      { property: "og:description", content: "বাংলাদেশের বিশ্বস্ত অনলাইন বীজ ও কৃষি উপকরণ প্রতিষ্ঠান Sheikh Seeds সম্পর্কে জানুন।" },
      { property: "og:url", content: "https://sheikhseeds.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://sheikhseeds.com/about" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "আমাদের সম্পর্কে — Sheikh Seeds",
          url: "https://sheikhseeds.com/about",
          inLanguage: "bn-BD",
          about: { "@id": "https://sheikhseeds.com/#organization" },
        }),
      },
    ],
  }),
});

const POINTS = [
  { icon: Sprout, title: "১০০% অরিজিনাল বীজ", text: "পরীক্ষিত ও উচ্চ অংকুরোদগম হারের সবজি, ফল ও ফুলের বীজ।" },
  { icon: ShieldCheck, title: "বিশ্বস্ত মান", text: "প্রতিটি প্যাকেট যাচাই করে প্যাকিং ও ডেলিভারি করা হয়।" },
  { icon: Truck, title: "সারাদেশে ডেলিভারি", text: "হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি সুবিধা।" },
  { icon: Headphones, title: "সহায়তা", text: "চাষ ও পরিচর্যা নিয়ে পরামর্শের জন্য আমাদের টিম প্রস্তুত।" },
];

function About() {
  return (
    <SiteLayout>
      <div className="container mx-auto max-w-3xl px-3 py-8">
        <h1 className="mb-4 text-3xl font-bold">Sheikh Seeds — আমাদের সম্পর্কে</h1>
        <p className="text-muted-foreground">
          Sheikh Seeds (শেখ সিডস) দেশী ও বিদেশী বীজের একটি বিশ্বস্ত প্রতিষ্ঠান। আমরা সবজি, ফল ও ফুলের
          অরিজিনাল বীজ, কৃষি ও গার্ডেন টুলস, সার এবং কীটনাশক সারাদেশে পৌঁছে দিই — যাতে প্রতিটি বাগান
          ও খেত সর্বোচ্চ ফলন দিতে পারে।
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-xl border bg-white p-5">
              <p.icon className="mb-2 h-8 w-8 text-brand" />
              <div className="font-bold">{p.title}</div>
              <div className="text-sm text-muted-foreground">{p.text}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/shop" className="rounded-md bg-brand px-4 py-2 text-sm text-white hover:bg-brand-dark">শপ দেখুন</Link>
          <Link to="/contact" className="rounded-md border px-4 py-2 text-sm hover:border-brand">যোগাযোগ করুন</Link>
        </div>
      </div>
    </SiteLayout>
  );
}
