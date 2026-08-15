import { handlePresswayyOrder, presswayyInboundVerify } from "@/lib/presswayy.functions";

export async function POST({ request }: { request: Request }) {
  const auth = await presswayyInboundVerify(request);
  if (!auth.ok) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: auth.status, headers: { "Content-Type": "application/json" } });
  try {
    const result = await handlePresswayyOrder(JSON.parse(auth.raw));
    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("[presswayy/order-public]", error);
    return Response.json({ error: error instanceof Error ? error.message : "Order failed" }, { status: 400 });
  }
}
