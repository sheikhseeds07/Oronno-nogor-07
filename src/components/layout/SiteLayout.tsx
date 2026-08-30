import { TopBar } from "./TopBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FloatingContact } from "./FloatingContact";
import { VisitTracker } from "./VisitTracker";
import { SeoFromSettings } from "./SeoFromSettings";

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const isOdcLanding = pathname === "/landing/odc";
  const isKaralaLanding = pathname === "/landing/karala";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {!isOdcLanding && !isKaralaLanding && <TopBar />}
      {!isOdcLanding && !isKaralaLanding && <Header />}
      <main className={`flex-1 ${isOdcLanding ? "odc-landing-main" : ""}`}>
        {children}
      </main>
      {isOdcLanding && (
        <style>{`
          .odc-landing-main > :first-child { margin-top: 0 !important; }
          .odc-landing-main > :first-child > :first-child { margin-top: 0 !important; padding-top: 0 !important; }
          .odc-landing-main section:first-child { margin-top: 0 !important; }
          .odc-landing-main section:first-child > :first-child { margin-top: 0 !important; }
        `}</style>
      )}
      {!isKaralaLanding && <Footer />}
      <FloatingContact />
      <VisitTracker />
      <SeoFromSettings />
    </div>
  );
}
