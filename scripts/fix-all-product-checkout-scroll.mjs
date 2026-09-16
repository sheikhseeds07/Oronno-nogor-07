import fs from "node:fs";

const path = "src/components/landing/AllProductLandingPage.tsx";
const source = fs.readFileSync(path, "utf8");
let next = source;

next = next.replace(
  'const el = document.getElementById("all-product-order");\n    if (!el) return;\n    const header = document.querySelector(\'[role="banner"]\') as HTMLElement | null;\n    const headerHeight = header?.getBoundingClientRect().height ?? 0;\n    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - headerHeight - 10);\n    window.scrollTo({ top, behavior: "smooth" });',
  'const el = document.getElementById("all-product-info");\n    if (!el) return;\n    const header = document.querySelector(\'[role="banner"]\') as HTMLElement | null;\n    const headerHeight = header?.getBoundingClientRect().height ?? 0;\n    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - headerHeight - 10);\n    window.scrollTo({ top, behavior: "smooth" });'
);

next = next.replace(
  '<h2 className="mt-3 text-3xl font-black">নিচের ফর্ম গুলো পূরন করুন</h2>',
  '<h2 className="mt-3 whitespace-nowrap text-2xl font-black sm:text-3xl">নিচের ফর্ম গুলো পূরন করুন</h2>'
);

next = next.replace(
  '<div className="border-b border-all-product-line p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-all-product-primary text-sm font-black text-all-product-primary-foreground">১</span><h3 className="font-black">আপনার তথ্য দিন</h3></div>',
  '<div id="all-product-info" className="border-b border-all-product-line p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-all-product-primary text-sm font-black text-all-product-primary-foreground">১</span><h3 className="font-black">আপনার তথ্য দিন</h3></div>'
);

if (next === source) {
  console.log("All-product checkout scroll patch already applied or source pattern changed; nothing to patch.");
} else {
  fs.writeFileSync(path, next);
  console.log("Fixed all-product checkout scroll target and single-line heading.");
}
