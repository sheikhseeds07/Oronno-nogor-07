import { TopBar } from "./TopBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FloatingContact } from "./FloatingContact";
import { FacebookPixel } from "./FacebookPixel";
import { VisitTracker } from "./VisitTracker";

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <FloatingContact />
      <FacebookPixel />
      <VisitTracker />
    </div>
  );
}
