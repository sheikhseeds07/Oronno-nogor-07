import { TopBar } from "./TopBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FloatingContact } from "./FloatingContact";
import { VisitTracker } from "./VisitTracker";
import { SeoFromSettings } from "./SeoFromSettings";
import { CustomerBottomNav } from "./CustomerBottomNav";

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const isProfile = pathname === "/profile";
  const isCart = pathname === "/cart";
  const isCheckout = pathname === "/checkout";
  const isOdcLanding = pathname === "/landing/odc";
  const isKaralaLanding = pathname === "/landing/karala";
  const isCleanShell = isProfile || isOdcLanding || isKaralaLanding;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!isCleanShell && <TopBar />}
      {!isCleanShell && <Header />}
      <main className={`relative z-0 flex-1 pb-24 ${isOdcLanding ? "odc-landing-main" : ""}`}>{children}</main>
      {isOdcLanding && <style>{`.odc-landing-main > :first-child { margin-top: 0 !important; }.odc-landing-main > :first-child > :first-child { margin-top: 0 !important; padding-top: 0 !important; }.odc-landing-main section:first-child { margin-top: 0 !important; }.odc-landing-main section:first-child > :first-child { margin-top: 0 !important; }`}</style>}
      {!isCleanShell && <Footer />}
      {!isCleanShell && !isCheckout && <FloatingContact />}
      <VisitTracker />
      <SeoFromSettings />
      {!isOdcLanding && !isKaralaLanding && !isCart && !isCheckout && <CustomerBottomNav />}
    </div>
  );
}
