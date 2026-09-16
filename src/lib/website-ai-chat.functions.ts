import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateGeminiWebReply } from "@/lib/gemini-ai.server";

const InputSchema = z.object({
  incoming: z.string().trim().max(2000).default(""),
  attachments: z.array(z.object({
    mediaType: z.string().regex(/^(image|audio)\//),
    data: z.string().max(7_000_000),
    name: z.string().max(200).optional(),
  })).max(2).default([]),
  history: z.array(z.object({
    direction: z.enum(["in", "out"]),
    text: z.string().max(2000).nullable(),
  })).max(14).default([]),
});

type Input = z.infer<typeof InputSchema>;

export const websiteAiChat = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    if (!data.incoming && !data.attachments.length) throw new Error("মেসেজ, ছবি বা ভয়েস দিন।");
    const result = await generateGeminiWebReply({ incoming: data.incoming, history: data.history, attachments: data.attachments });
    if (!result.text) throw new Error("AI উত্তর দিতে পারেনি। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
    return result;
  });
