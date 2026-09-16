import fs from "node:fs";

const patches = [
  ["src/components/landing/AllProductLandingPage.tsx", [
    [
      'const el = document.getElementById("all-product-order");\n    if (!el) return;\n    const header = document.querySelector(\'[role="banner"]\') as HTMLElement | null;\n    const headerHeight = header?.getBoundingClientRect().height ?? 0;\n    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - headerHeight - 10);\n    window.scrollTo({ top, behavior: "smooth" });',
      'const el = document.getElementById("all-product-info");\n    if (!el) return;\n    const header = document.querySelector(\'[role="banner"]\') as HTMLElement | null;\n    const headerHeight = header?.getBoundingClientRect().height ?? 0;\n    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - headerHeight - 10);\n    window.scrollTo({ top, behavior: "smooth" });'
    ],
    [
      '<h2 className="mt-3 text-3xl font-black">নিচের ফর্ম গুলো পূরন করুন</h2>',
      '<h2 className="mt-3 whitespace-nowrap text-2xl font-black sm:text-3xl">নিচের ফর্ম গুলো পূরন করুন</h2>'
    ],
    [
      '<div className="border-b border-all-product-line p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-all-product-primary text-sm font-black text-all-product-primary-foreground">১</span><h3 className="font-black">আপনার তথ্য দিন</h3></div>',
      '<div id="all-product-info" className="border-b border-all-product-line p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-all-product-primary text-sm font-black text-all-product-primary-foreground">১</span><h3 className="font-black">আপনার তথ্য দিন</h3></div>'
    ],
    [
      'catch (error) { toast.error(orderErrorMessage(error)); setSubmitting(false); }',
      'catch (error) { const message = orderErrorMessage(error); if (message) toast.error(message); setSubmitting(false); }'
    ]
  ]],
  ["src/components/landing/LegacyLandingPage.tsx", [
    [
      'toast.error(orderErrorMessage(err));\n      setSubmitting(false);',
      'const message = orderErrorMessage(err);\n      if (message) toast.error(message);\n      setSubmitting(false);'
    ]
  ]],
  ["src/components/landing/ProfessionalLandingPage.tsx", [
    [
      'catch (err) { toast.error(orderErrorMessage(err)); setSubmitting(false); }',
      'catch (err) { const message = orderErrorMessage(err); if (message) toast.error(message); setSubmitting(false); }'
    ]
  ]],
  ["src/components/landing/ProductStyleLandingPage.tsx", [
    [
      'catch (err) { toast.error(orderErrorMessage(err)); setSubmitting(false); }',
      'catch (err) { const message = orderErrorMessage(err); if (message) toast.error(message); setSubmitting(false); }'
    ]
  ]],
  ["src/lib/order-block.ts", [
    [
      'const close = () => { backdrop.remove(); document.body.classList.remove("premium-order-modal-active"); if (timer) clearInterval(timer); document.removeEventListener("keydown", onKey); document.querySelectorAll("[data-sonner-toast]").forEach((toast) => { if (!toast.textContent?.trim()) toast.remove(); }); };',
      'const close = () => { backdrop.remove(); document.body.classList.remove("premium-order-modal-active"); if (timer) clearInterval(timer); document.removeEventListener("keydown", onKey); };'
    ]
  ]]
];

for (const [path, replacements] of patches) {
  const source = fs.readFileSync(path, "utf8");
  let next = source;
  for (const [from, to] of replacements) next = next.replace(from, to);
  if (next !== source) {
    fs.writeFileSync(path, next);
    console.log(`Patched ${path}`);
  }
}
