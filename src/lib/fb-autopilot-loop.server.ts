/** Four short passes inside each minute keep webhook drops covered without opening long-lived client connections. */
export async function runFbAutopilotLoop() {
  const { runFbAutopilot } = await import("@/lib/fb-autopilot.server");
  const results: unknown[] = [];
  for (let i = 0; i < 4; i += 1) {
    results.push(await runFbAutopilot());
    if (i < 3) await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  return results;
}
