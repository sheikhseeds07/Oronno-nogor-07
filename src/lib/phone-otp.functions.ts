import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

async function invokeOtpBridge(body: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.functions.invoke("phone-otp-bridge", { body });
  if (error) throw new Error(error.message || "OTP service error");
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
