import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircleHeart, ShieldCheck, Zap, Users } from "lucide-react";
import heroImage from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Alhamdulillah — Free, private messaging for everyone" },
      {
        name: "description",
        content:
          "Alhamdulillah is a calm, private messaging app. Chat one-to-one in real time, from any browser, with no downloads.",
      },
      { property: "og:title", content: "Alhamdulillah — Free, private messaging" },
      {
        property: "og:description",
        content: "Real-time one-to-one chat in your browser. Calm, private, and free.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Zap,
    title: "Instant delivery",
    body: "Messages appear the moment they are sent — no refresh, no waiting.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Only you and the person you are talking to can read your conversation.",
  },
  {
    icon: Users,
    title: "Find anyone by username",
    body: "Search a username and start talking. No phone number required.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <MessageCircleHeart className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold">Alhamdulillah</span>
        </div>
        <Button asChild variant="ghost">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-8 md:grid-cols-2 md:pt-16">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Messaging, made calm
            </p>
            <h1 className="mt-4 text-5xl leading-[1.05] font-semibold md:text-6xl">
              Say it with <span className="text-primary">Alhamdulillah</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              A gratitude-first chat app for friends and family. Real-time conversations in your
              browser — nothing to install, nothing to configure.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="rounded-full px-8">
                <Link to="/auth">Start chatting free</Link>
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border shadow-soft">
            <img
              src={heroImage}
              alt="Two ornate speech bubbles decorated with emerald and gold Islamic geometric patterns"
              width={1600}
              height={1200}
              className="h-full w-full object-cover"
            />
          </div>
        </section>

        <section className="border-t bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-background p-6 shadow-soft">
                <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <f.icon className="size-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">
        Alhamdulillah — built for kind conversations.
      </footer>
    </div>
  );
}
