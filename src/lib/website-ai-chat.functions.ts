import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateGeminiWebReply } from "@/lib/gemini-ai.server";

const InputSchema = z.object({
  incoming: z.string().trim().min(1).max(2000),
  history: z.array(z.object({
    direction: z.enum(["in", "out"]),
    text: z.string().max(2000).nullable(),
  })).max(14).default([]),
});

type Input = z.infer<typeof InputSchema>;

export const websiteAiChat = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const text = await generateGeminiWebReply({ incoming: data.incoming, history: data.history });
    if (!text) throw new Error("AI উত্তর দিতে পারেনি। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
    return { text, orderId: null, needsHuman: false };
  });
