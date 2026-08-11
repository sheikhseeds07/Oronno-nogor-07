import { useEffect, useRef } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

// Plays a short beep using WebAudio (no asset needed)
function beep() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    o.start();
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.stop(ctx.currentTime + 0.55);
  } catch {}
}

export function NewOrderNotifier() {
  const navigate = useNavigate();
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    // Browser notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const channel = supabase
      .channel("admin-new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const row: any = payload.new;
          // Ignore rows older than mount (initial backfill safety)
          if (row?.created_at && new Date(row.created_at).getTime() < startedAt.current - 5000) return;

          beep();
          const title = `নতুন অর্ডার: ${row?.customer_name ?? ""}`;
          const body = `${row?.customer_phone ?? ""} • ৳${row?.total ?? 0}`;
          toast.success(title, {
            description: body,
            duration: 8000,
            action: { label: "দেখুন", onClick: () => navigate({ to: "/admin/orders" }) },
          });
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const n = new Notification(title, { body, tag: row?.id });
              n.onclick = () => { window.focus(); navigate({ to: "/admin/orders" }); };
            } catch {}
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [navigate]);

  return null;
}
