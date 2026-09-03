import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

async function invokeOtpBridge(body: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.functions.invoke("phone-otp-bridge", { body });

  if (error) {
    // Supabase FunctionsHttpError often exposes only the generic
    // "non-2xx status code" message. Read the Edge Function response body
    // so the admin/login UI gets the real provider/configuration error.
    try {
      const context = (error as unknown as { context?: Response }).context;
      if (context) {
        const raw = await context.clone().text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { message?: unknown; error?: unknown };
            const detail = parsed?.message ?? parsed?.error;
            if (typeof detail === "string" && detail.trim()) throw new Error(detail.trim());
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message !== "Unexpected end of JSON input") {
              throw parseError;
            }
          }
          const cleaned = raw.replace(/\s+/g, " ").trim();
          if (cleaned) throw new Error(cleaned.slice(0, 500));
        }
      }
    } catch (bodyError) {
      if (bodyError instanceof Error && bodyError.message) throw bodyError;
    }
    throw new Error(error.message || "OTP service error");
  }

  if (data?.error) throw new Error(String(data.error));
  return data;
}

export const sendPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().min(6).max(20) }).parse(input))
  .handler(async ({ data }) => {
    return invokeOtpBridge({ action: "send", phone: data.phone });
  });

export const testSmsProvider = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().min(6).max(20) }).parse(input))
  .handler(async ({ data }) => {
    return invokeOtpBridge({ action: "test", phone: data.phone });
  });

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().min(6).max(20), code: z.string().length(4) }).parse(input))
  .handler(async ({ data }) => {
    return invokeOtpBridge({ action: "verify", phone: data.phone, code: data.code });
  });
