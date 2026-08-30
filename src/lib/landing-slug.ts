// Landing page duplicates keep the source page slug plus a "-copy-xxxx" suffix.
// Every slug-specific behaviour (hidden header, hidden reviews, compact spacing,
// popup behaviour, template picks) must resolve through this helper so a copy
// renders exactly like the page it was duplicated from, now and after any future
// change to the original.
export function landingBaseSlug(slug: string): string {
  let out = (slug || "").toLowerCase();
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(/-copy(?:-[a-z0-9]+)?$/i, "");
  }
  return out;
}
