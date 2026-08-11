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
        <Link to="/" className="mt-6 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
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
          onClick={() => { router.invalidate(); reset(); }}
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
      { title: "শেখ সিড — দেশের ১ নম্বর অনলাইন সিড কোম্পানি" },
      { name: "description", content: "১০০% অরিজিনাল বীজ, গার্ডেন টুলস ও সরঞ্জাম। সারাদেশে হোম ডেলিভারি — ক্যাশ অন ডেলিভারি।" },
      { property: "og:title", content: "শেখ সিড" },
      { property: "og:description", content: "দেশের ১ নম্বর অনলাইন সিড কোম্পানি" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", sizes: "180x180", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" },
      { rel: "preconnect", href: "https://qqubscomvvoymomtxzct.supabase.co", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://yqhtenonavuzxzemaiyk.supabase.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://connect.facebook.net" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "শেখ সিড",
          alternateName: "Sheikh Seeds",
          url: "https://sheikhseeds.site",
          logo: "https://sheikhseeds.site/favicon.png",
          image: "https://sheikhseeds.site/favicon.png",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "শেখ সিড",
          url: "https://sheikhseeds.site",
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
      <head><HeadContent /></head>
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [queryClient, router]);

  return null;
}
