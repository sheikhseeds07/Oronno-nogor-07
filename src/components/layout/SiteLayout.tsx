import { TopBar } from "./TopBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FloatingContact } from "./FloatingContact";
import { VisitTracker } from "./VisitTracker";
import { SeoFromSettings } from "./SeoFromSettings";

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const isOdcLanding = typeof window !== "undefined" && window.location.pathname === "/landing/odc";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {!isOdcLanding && <TopBar />}
      {!isOdcLanding && <Header />}
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
      <Footer />
      <FloatingContact />
      <VisitTracker />
      <SeoFromSettings />
    </div>
  );
}
