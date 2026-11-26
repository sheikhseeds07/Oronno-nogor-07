// Landing page duplicates keep the source page slug plus a "-copy-xxxx" suffix.
// Every slug-specific behaviour (hidden header, hidden reviews, compact spacing,
// popup behaviour, template picks) must resolve through this helper so a copy
// renders exactly like the page it was duplicated from, now and after any future
// change to the original.
// Each landing page reads its own database row. Copies share the template/design,
// never the editable offer content, prices, text, or images.
export function landingDataSlug(slug: string): string {
  return slug;
}

export function landingBaseSlug(slug: string): string {
  let out = (slug || "").toLowerCase();
  // This manually named 48-seed duplicate must inherit the seedcombo template
  // and all of its route-level behaviour just like an automatically suffixed copy.
  if (out === "48-seed-combo-new") return "seedcombo";
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(/-copy(?:-[a-z0-9]+)?$/i, "");
  }
  return out;
}
