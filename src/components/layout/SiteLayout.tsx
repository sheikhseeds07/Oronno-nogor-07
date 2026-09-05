import { TopBar } from "./TopBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FloatingContact } from "./FloatingContact";
import { VisitTracker } from "./VisitTracker";
import { SeoFromSettings } from "./SeoFromSettings";

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const isProfile = pathname === "/profile";
  const isOdcLanding = pathname === "/landing/odc";
  const isKaralaLanding = pathname === "/landing/karala";

  return (
    <div className={`flex min-h-screen flex-col bg-background ${isProfile ? "profile-shell" : ""}`}>
      {!isOdcLanding && !isKaralaLanding && !isProfile && <TopBar />}
      {!isOdcLanding && !isKaralaLanding && !isProfile && <Header />}
      <main className={`flex-1 ${isOdcLanding ? "odc-landing-main" : ""} ${isProfile ? "profile-page" : ""}`}>
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
      {isProfile && (
        <style>{`
          .profile-page { padding: 0 !important; background: hsl(var(--background)) !important; }
          .profile-page > div { max-width: 760px !important; padding: 14px 10px 28px !important; }
          .profile-page .container > section:first-child { border-radius: 22px !important; box-shadow: 0 10px 34px rgba(20,83,45,.10) !important; }
          .profile-page .container > section:first-child > div:first-child { height: 128px !important; }
          .profile-page .container > section:first-child > div:nth-child(2) { padding: 0 14px 14px !important; }
          .profile-page .container > section:first-child > div:nth-child(2) > div:first-child { margin-top: -38px !important; }
          .profile-page .container > section:first-child .h-28 { width: 84px !important; height: 84px !important; border-radius: 25px !important; border-width: 4px !important; }
          .profile-page .container > section:first-child .h-28 + button { width: 30px !important; height: 30px !important; }
          .profile-page .container > section:first-child h1 { font-size: 1.25rem !important; line-height: 1.3 !important; }
          .profile-page .container > section:first-child p { margin-top: 3px !important; line-height: 1.45 !important; }
          .profile-page .container > section:first-child .mt-2 { margin-top: 4px !important; }
          .profile-page .container > div:nth-child(2) { margin-top: 10px !important; border-radius: 17px !important; padding: 4px !important; }
          .profile-page .container > section:nth-child(3) { margin-top: 10px !important; border-radius: 18px !important; }
          .profile-page .container > section:nth-child(3) > div { padding: 0 !important; }
          .profile-page .container > section:nth-child(3) a { padding: 12px 13px !important; }
          @media (min-width: 640px) {
            .profile-page > div { padding: 22px 14px 34px !important; }
            .profile-page .container > section:first-child > div:first-child { height: 158px !important; }
            .profile-page .container > section:first-child .h-28 { width: 92px !important; height: 92px !important; }
          }
        `}</style>
      )}
      {!isKaralaLanding && !isProfile && <Footer />}
      {!isProfile && <FloatingContact />}
      <VisitTracker />
      <SeoFromSettings />
    </div>
  );
}
