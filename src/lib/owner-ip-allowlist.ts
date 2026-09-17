const OWNER_IP_ALLOWLIST = new Set(["45.117.62.206"]);

/** Owner IPs bypass customer blocking everywhere, including Facebook's in-app browser. */
export function isOwnerIpAllowed(ip: string | null | undefined): boolean {
  if (!ip) return false;
  return ip
    .split(",")
    .map((value) => value.trim().replace(/^::ffff:/, ""))
    .some((value) => OWNER_IP_ALLOWLIST.has(value));
}