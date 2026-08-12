import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/fb-callback")({
  ssr: false,
  component: FbCallback,
  head: () => ({
    meta: [
      { title: "Facebook সংযোগ | অরন্য নগর অ্যাডমিন" },
      { name: "description", content: "ফেসবুক পেইজ সংযোগের ধাপ সম্পন্ন হচ্ছে।" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function FbCallback() {
  const [msg, setMsg] = useState("সংযোগ সম্পন্ন হচ্ছে…");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    const state = q.get("state");
    const error = q.get("error_description") || q.get("error");
    const payload = code && state
      ? { type: "fb-oauth", code, state }
      : { type: "fb-oauth", error: error || "লগইন বাতিল হয়েছে" };
    if (window.opener) {
      const allowedOpeners = [
        "https://oronnonogor.com",
        "https://www.oronnonogor.com",
        "https://warm-db-link.lovable.app",
        "https://id-preview--7827bf31-180a-4633-8399-005e33b3075c.lovable.app",
        "https://7827bf31-180a-4633-8399-005e33b3075c.lovableproject.com",
        "http://localhost:8080",
      ];
      for (const origin of allowedOpeners) {
        try {
          window.opener.postMessage(payload, origin);
        } catch {
          /* Try the next approved app origin. */
        }
      }
    }
    if (window.opener) {
      window.close();
      setMsg("এই উইন্ডো বন্ধ করতে পারেন।");
    } else {
      // Same-tab fallback: hand the code back to the messages page.
      const target = code && state
        ? `/admin/all-api?fb_code=${encodeURIComponent(code)}&fb_state=${encodeURIComponent(state)}`
        : `/admin/all-api?fb_error=${encodeURIComponent(error || "লগইন বাতিল হয়েছে")}`;
      window.location.replace(target);
    }
  }, []);

  return <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">{msg}</div>;
}
