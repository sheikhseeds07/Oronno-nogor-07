import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/lib/personal-supabase/client";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-brand">৪০৪</h1>
        <h2 className="mt-4 text-xl font-semibold">পেজটি খুঁজে পাওয়া যায়নি</h2>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          হোমে ফিরে যান
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">পেজ লোড হয়নি</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-brand px-4 py-2 text-sm text-white hover:bg-brand-dark"
        >
          আবার চেষ্টা করুন
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "অরন্য নগর (Oronno Nogor) — অরিজিনাল বীজ, গার্ডেন টুলস ও সার" },
      {
        name: "description",
        content:
          "অরন্য নগর — ছাদ বাগানির বিশ্বস্ত সঙ্গী। ১০০% অরিজিনাল বীজ, গার্ডেন টুলস, সার ও কীটনাশক। সারাদেশে হোম ডেলিভারি — ক্যাশ অন ডেলিভারি।",
      },
      { property: "og:site_name", content: "অরন্য নগর" },
      { property: "og:title", content: "অরন্য নগর (Oronno Nogor)" },
      {
        property: "og:description",
        content: "ছাদ বাগানির বিশ্বস্ত সঙ্গী — অরিজিনাল বীজ, গার্ডেন টুলস ও সার",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "bn_BD" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "author", content: "অরন্য নগর" },
      { name: "theme-color", content: "#0d4a29" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32-v2.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192-v2.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512-v2.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon-v2.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap",
      },
      {
        rel: "preconnect",
        href: "https://bvuhvzccziuniujeogng.supabase.co",
        crossOrigin: "anonymous",
      },
      { rel: "dns-prefetch", href: "https://connect.facebook.net" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "OnlineStore",
          "@id": "https://oronnonogor.com/#organization",
          name: "অরন্য নগর",
          alternateName: ["Oronno Nogor", "oronnonogor", "অরন্যনগর", "Oronno Nogor BD"],
          slogan: "ছাদ বাগানির বিশ্বস্ত সঙ্গী",
          description:
            "অরন্য নগর একটি অনলাইন গার্ডেন শপ — অরিজিনাল সবজি, ফল ও ফুলের বীজ, গার্ডেন টুলস, সার ও কীটনাশক সারাদেশে ডেলিভারি করে।",
          url: "https://oronnonogor.com",
          logo: "https://oronnonogor.com/logo.jpg",
          image: "https://oronnonogor.com/og-oronno-nogor.jpg",
          areaServed: { "@type": "Country", name: "Bangladesh" },
          address: { "@type": "PostalAddress", addressCountry: "BD" },
          paymentAccepted: "Cash on Delivery, bKash",
          currenciesAccepted: "BDT",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": "https://oronnonogor.com/#website",
          name: "অরন্য নগর",
          alternateName: "Oronno Nogor",
          inLanguage: "bn-BD",
          url: "https://oronnonogor.com",
          publisher: { "@id": "https://oronnonogor.com/#organization" },
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: "https://oronnonogor.com/shop?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthCacheSync />
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}

function AuthCacheSync() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [queryClient, router]);

  return null;
}
