import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

export const syncFacebookNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ assertIsStaff }, { loadFbPageConfig }, { checkFacebookConnection, syncFacebookHistory }] = await Promise.all([
      import("@/lib/_admin-guard.server"),
      import("@/lib/fb-page.server"),
      import("@/lib/fb-sync.server"),
    ]);
    await assertIsStaff(context.userId);
    const cfg = await loadFbPageConfig(true);
    if (!cfg?.page_id || !cfg.page_access_token) throw new Error("আগে Facebook Page কানেক্ট করুন");
    const page = await checkFacebookConnection(cfg);
    const stats = await syncFacebookHistory(cfg);
    return { ok: true, page_name: page.name ?? cfg.page_name, ...stats };
  });
/**
 * Fast background tick used by the admin inbox: pulls new Facebook messages and
 * lets the AI answer anything still unanswered — no manual action needed.
 */
export const autoSyncAndReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertIsStaff } = await import("@/lib/_admin-guard.server");
    await assertIsStaff(context.userId);
    // Shares the exact same locked autopilot pass as the scheduler, so the
    // open admin panel can never trigger a second reply to the same message.
    const { runFbAutopilot } = await import("@/lib/fb-autopilot.server");
    const result = await runFbAutopilot();
    if (!result.ok) return { ok: false as const, reason: "not_connected" as const };
    return {
      ok: true as const,
      conversations: 0,
      messages: "messages" in result ? result.messages : 0,
      comments: "comments" in result ? result.comments : 0,
      replied: "replied_messages" in result ? result.replied_messages : 0,
      replied_comments: "replied_comments" in result ? result.replied_comments : 0,
    };
  });
