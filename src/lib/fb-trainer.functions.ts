import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

async function guard(userId: string) {
  const { assertIsStaff } = await import("@/lib/_admin-guard.server");
  await assertIsStaff(userId);
}

export const chatWithFbTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        message: z
          .string()
          .trim()
          .transform((v) => v.slice(0, 12000))
          .default(""),
        image_url: z.string().url().max(1000).nullish(),
      })
      .refine((v) => v.message.length > 0 || !!v.image_url, { message: "মেসেজ বা ছবি দিন" })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { talkToFbTrainer } = await import("@/lib/fb-trainer.server");
    return talkToFbTrainer(data.message, data.image_url ?? null);
  });

export const listFbTrainerChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { listTrainerChat } = await import("@/lib/fb-trainer.server");
    return listTrainerChat();
  });

export const clearFbTrainerChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { clearTrainerChat } = await import("@/lib/fb-trainer.server");
    return clearTrainerChat();
  });
