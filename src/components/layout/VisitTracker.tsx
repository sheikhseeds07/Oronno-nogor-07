import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { trackVisit } from "@/lib/track-visit";

/** Fires a non-blocking site_visits insert once per session per path. */
export function VisitTracker() {
  const loc = useLocation();
  useEffect(() => {
    trackVisit(loc.pathname);
  }, [loc.pathname]);
  return null;
}
