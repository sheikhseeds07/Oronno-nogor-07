import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Phone, MessageCircle, Mail, MapPin } from "lucide-react";

export const Route = createFileRoute("/contact")({ component: Contact });

function Contact() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-3 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-6">যোগাযোগ করুন</h1>
        <div className="grid sm:grid-cols-2 gap-3">
          <a href="tel:+8809644553383" className="bg-white border rounded-xl p-5 hover:border-brand">
            <Phone className="w-8 h-8 text-brand mb-2" />
            <div className="font-bold">কল করুন</div>
            <div className="text-sm text-muted-foreground">+৮৮০ ৯৬৪৪-৫৫৩৩৮৩</div>
          </a>
          <a href="https://wa.me/8809644553383" target="_blank" rel="noreferrer" className="bg-white border rounded-xl p-5 hover:border-brand">
            <MessageCircle className="w-8 h-8 text-green-500 mb-2" />
            <div className="font-bold">WhatsApp</div>
            <div className="text-sm text-muted-foreground">২৪/৭ মেসেজ পাঠান</div>
          </a>
          <a href="mailto:info@oronnonogor.com" className="bg-white border rounded-xl p-5 hover:border-brand">
            <Mail className="w-8 h-8 text-brand mb-2" />
            <div className="font-bold">ইমেইল</div>
            <div className="text-sm text-muted-foreground">info@oronnonogor.com</div>
          </a>
          <div className="bg-white border rounded-xl p-5">
            <MapPin className="w-8 h-8 text-brand mb-2" />
            <div className="font-bold">অফিস ঠিকানা</div>
            <div className="text-sm text-muted-foreground">গোপালগঞ্জ সদর, পাবলিক হল রোড</div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
