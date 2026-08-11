import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

async function guard(userId: string) {
  const { assertIsStaff } = await import("@/lib/_admin-guard.server");
  await assertIsStaff(userId);
}

/** AI replies to every conversation whose newest message is from the customer. */
export const aiReplyAllPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ limit: z.number().min(1).max(100).default(40) }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { aiReplyBacklog } = await import("@/lib/fb-backlog.server");
    return aiReplyBacklog(data.limit);
  });

/** AI replies to one specific conversation right now. */
export const aiReplyOne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ conversation_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { aiReplyToConversation } = await import("@/lib/fb-backlog.server");
    return aiReplyToConversation(data.conversation_id);
  });
