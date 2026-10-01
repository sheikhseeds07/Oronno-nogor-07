export const R2_IMAGE_PLACEHOLDER = "/placeholder.png";

// One read only. Missing objects and failed reads resolve to the static image.
export async function readR2Image<T>(read: () => Promise<T | null>): Promise<T | typeof R2_IMAGE_PLACEHOLDER> {
  try { return await read() ?? R2_IMAGE_PLACEHOLDER; }
  catch { return R2_IMAGE_PLACEHOLDER; }
}
