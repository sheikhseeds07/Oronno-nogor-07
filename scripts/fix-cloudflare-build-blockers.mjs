import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardPath = path.resolve(here, "../src/components/admin/PremiumDashboard.tsx");

let dashboard = "";
try {
  dashboard = await readFile(dashboardPath, "utf8");
} catch {
  console.warn("PremiumDashboard.tsx not found; skipping build blocker fix.");
  process.exit(0);
}

const brokenLandingLabel = '{x.landingPages?.length?`Landing: ${x.landingPages.map((p:any)=>p.title).join(", ")}:`}';
const fixedLandingLabel = '{x.landingPages?.length?`Landing: ${x.landingPages.map((p:any)=>p.title).join(", ")}`:"No linked landing page"}';

if (dashboard.includes(brokenLandingLabel)) {
  dashboard = dashboard.replace(brokenLandingLabel, fixedLandingLabel);
  await writeFile(dashboardPath, dashboard, "utf8");
  console.log("Fixed PremiumDashboard landing-page ternary syntax.");
} else if (dashboard.includes(fixedLandingLabel)) {
  console.log("PremiumDashboard landing-page ternary syntax already fixed.");
} else {
  console.warn("PremiumDashboard landing-page expression not found; nothing to patch, continuing build.");
}

const shopPath = path.resolve(here, "../src/routes/shop.tsx");
try {
  let shop = await readFile(shopPath, "utf8");
  const oldShopFilter = 'supabase.from("products").select("id,name,slug,price,sale_price,images,stock,short_description,description").eq("is_active", true)';
  const newShopFilter = 'supabase.from("products").select("id,name,slug,price,sale_price,images,stock,short_description,description").eq("is_active", true).eq("is_offer", false).eq("is_archived", false)';
  if (shop.includes(oldShopFilter) && !shop.includes(newShopFilter)) { shop = shop.replace(oldShopFilter, newShopFilter); await writeFile(shopPath, shop, "utf8"); console.log("Excluded offer combos from /shop."); }
} catch (error) { console.warn("Offer /shop build patch skipped:", error instanceof Error ? error.message : error); }

const adminLayoutPath = path.resolve(here, "../src/components/admin/AdminLayout.tsx");
try {
  let adminLayout = await readFile(adminLayoutPath, "utf8");
  const productsNav = '{ to: "/admin/products", label: "Products", icon: Package, perm: "products", tone: "from-amber-400 to-orange-500" },';
  const offersNav = '{ to: "/admin/offers", label: "Offers", icon: Sparkles, perm: "products", tone: "from-emerald-400 to-teal-500" },';
  if (adminLayout.includes(productsNav) && !adminLayout.includes(offersNav) && !adminLayout.includes('to: "/admin/offers"')) { adminLayout = adminLayout.replace(productsNav, productsNav + "\n  " + offersNav); await writeFile(adminLayoutPath, adminLayout, "utf8"); console.log("Added Offers to admin navigation."); }
} catch (error) { console.warn("Offer admin navigation patch skipped:", error instanceof Error ? error.message : error); }

const headerPath = path.resolve(here, "../src/components/layout/Header.tsx");
try {
  let header = await readFile(headerPath, "utf8");
  header = header.replace('ShoppingCart, Search, X, ChevronRight, Home, Grid3x3, Phone, ArrowRight, Palette, Leaf, Sprout, Flower2, TreePine, Wheat, Sun, Users, UserRound','ShoppingCart, Search, X, ChevronRight, Home, Grid3x3, Phone, ArrowRight, Palette, Leaf, Sprout, Flower2, TreePine, Wheat, Sun, Users, UserRound, Sparkles');
  const desktopShop = '<Link to="/shop" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-dark hover:text-white hover:bg-gradient-to-r hover:from-brand hover:to-brand-dark rounded-full transition shrink-0"><Grid3x3 className="w-3.5 h-3.5" /> সকল পণ্য</Link>';
  const desktopOffers = '<Link to="/offers" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-brand-dark hover:text-white hover:bg-gradient-to-r hover:from-brand hover:to-brand-dark rounded-full transition shrink-0"><Sparkles className="w-3.5 h-3.5" /> অফার</Link>';
  if (header.includes(desktopShop) && !header.includes('to="/offers"')) header = header.replace(desktopShop, desktopShop + desktopOffers);
  const drawerShop = '<Link to="/shop" onClick={closeDrawer} style={{ "--d": nextDelay() } as React.CSSProperties} className="drawer-item group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-gradient-to-r hover:from-brand-light/60 hover:to-transparent transition">';
  const drawerOffers = '<Link to="/offers" onClick={closeDrawer} style={{ "--d": nextDelay() } as React.CSSProperties} className="drawer-item group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-gradient-to-r hover:from-brand-light/60 hover:to-transparent transition"><span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-orange-500/30 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300"><Sparkles className="w-3.5 h-3.5" /></span><span className="font-bold text-[13px]">অফার</span><ChevronRight className="w-4 h-4 ml-auto text-brand/50 group-hover:translate-x-1 group-hover:text-brand transition-all" /></Link>';
  if (header.includes(drawerShop) && !header.includes('>অফার</span>')) header = header.replace(drawerShop, drawerShop + drawerOffers);
  await writeFile(headerPath, header, "utf8");
  console.log("Added Offers to customer navigation.");
} catch (error) { console.warn("Offer customer navigation patch skipped:", error instanceof Error ? error.message : error); }

// Offer builder: selected products keep their own images as secondary combo gallery images; the uploaded image remains the main image.
const offersAdminPath = path.resolve(here, "../src/routes/admin/offers.tsx");
try {
  let offersAdmin = await readFile(offersAdminPath, "utf8");
  const oldValidation = 'if(sale<=0)return toast.error("Offer price দিন");setSaving(true);';
  const newValidation = 'if(sale<=0)return toast.error("Offer price দিন");if(!image)return toast.error("Main Combo Image আপলোড করুন");setSaving(true);';
  if (offersAdmin.includes(oldValidation) && !offersAdmin.includes('Main Combo Image আপলোড করুন')) offersAdmin = offersAdmin.replace(oldValidation, newValidation);
  const oldImages = 'images:image?[image]:[]';
  const newImages = 'images:image?[image,...selected.flatMap(p=>p.images??[]).filter(src=>src!==image)]:[]';
  if (offersAdmin.includes(oldImages)) offersAdmin = offersAdmin.replaceAll(oldImages, newImages);
  const oldImageLabel = '<div className="mb-2 text-xs font-bold">Combo image</div>';
  const newImageLabel = '<div className="mb-2 text-xs font-bold">Main Combo Image <span className="font-normal text-muted-foreground">(Required)</span></div>';
  if (offersAdmin.includes(oldImageLabel)) offersAdmin = offersAdmin.replace(oldImageLabel, newImageLabel);

  // Fix mobile/desktop offer drag sorting. The previous implementation changed touch-action only after the long-press,
  // and also cancelled the drag on pointerleave. On mobile that can cause the browser to take over scrolling before
  // the first reorder event. Keep the pointer stream captured and disable native touch gestures for draggable cards.
  const oldPointerDown = 'const onPointerDown=(e:React.PointerEvent,id:string)=>{if(showArchived)return;startY.current=e.clientY;clearHold();holdTimer.current=setTimeout(()=>{dragId.current=id;setActiveId(id);if(typeof navigator!=="undefined"&&navigator.vibrate)navigator.vibrate(12);},220)};';
  const newPointerDown = 'const onPointerDown=(e:React.PointerEvent,id:string)=>{if(showArchived)return;if((e.target as HTMLElement).closest("button,a,input,textarea,select"))return;startY.current=e.clientY;clearHold();try{e.currentTarget.setPointerCapture(e.pointerId)}catch{};holdTimer.current=setTimeout(()=>{dragId.current=id;setActiveId(id);if(typeof navigator!=="undefined"&&navigator.vibrate)navigator.vibrate(12);},220)};';
  if (offersAdmin.includes(oldPointerDown)) offersAdmin = offersAdmin.replace(oldPointerDown, newPointerDown);

  const oldPointerUp = 'const onPointerUp=()=>{clearHold();if(!dragId.current)return;dragId.current=null;setActiveId(null);void persist(listRef.current)};';
  const newPointerUp = 'const onPointerUp=(e?:React.PointerEvent)=>{clearHold();if(!dragId.current)return;try{if(e) e.currentTarget.releasePointerCapture(e.pointerId)}catch{};dragId.current=null;setActiveId(null);void persist(listRef.current)};';
  if (offersAdmin.includes(oldPointerUp)) offersAdmin = offersAdmin.replace(oldPointerUp, newPointerUp);

  const oldListOpen = '<div className="space-y-3" style={activeId?{touchAction:"none"}:undefined} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerUp}>';
  const newListOpen = '<div className="space-y-3" style={{touchAction:showArchived?"auto":"none",userSelect:activeId?"none":undefined}} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>';
  if (offersAdmin.includes(oldListOpen)) offersAdmin = offersAdmin.replace(oldListOpen, newListOpen);

  const oldCardStyle = 'style={{touchAction:activeId?"none":undefined}}';
  const newCardStyle = 'style={{touchAction:showArchived?"auto":"none",userSelect:"none",WebkitUserSelect:"none"}}';
  if (offersAdmin.includes(oldCardStyle)) offersAdmin = offersAdmin.replace(oldCardStyle, newCardStyle);

  await writeFile(offersAdminPath, offersAdmin, "utf8");
  console.log("Offer builder now saves selected product images as combo gallery images, requires a main image, and uses reliable pointer capture for drag sorting.");
} catch (error) { console.warn("Offer builder image/drag patch skipped:", error instanceof Error ? error.message : error); }

// Floating customer bottom navigation: keep the compact-on-scroll behavior, but reveal icons immediately when scrolling stops.
// The idle timer is intentionally short so the bar feels responsive without flickering during normal touch scrolling.
const customerBottomNavPath = path.resolve(here, "../src/components/layout/CustomerBottomNav.tsx");
try {
  let customerNav = await readFile(customerBottomNavPath, "utf8");
  const oldScrollEffect = `  useEffect(() => {\n    let lastY = window.scrollY;\n    let ticking = false;\n    const onScroll = () => {\n      if (ticking) return;\n      ticking = true;\n      requestAnimationFrame(() => {\n        const y = window.scrollY;\n        if (y < 40) setMinimized(false);\n        else if (y > lastY + 5) setMinimized(true);\n        else if (y < lastY - 7) setMinimized(false);\n        lastY = y;\n        ticking = false;\n      });\n    };\n    window.addEventListener("scroll", onScroll, { passive: true });\n    return () => window.removeEventListener("scroll", onScroll);\n  }, []);`;
  const newScrollEffect = `  useEffect(() => {\n    let lastY = window.scrollY;\n    let ticking = false;\n    let idleTimer: ReturnType<typeof setTimeout> | null = null;\n\n    const revealWhenIdle = () => {\n      if (idleTimer) clearTimeout(idleTimer);\n      idleTimer = setTimeout(() => setMinimized(false), 180);\n    };\n\n    const onScroll = () => {\n      revealWhenIdle();\n      if (ticking) return;\n      ticking = true;\n      requestAnimationFrame(() => {\n        const y = window.scrollY;\n        if (y < 40) setMinimized(false);\n        else if (y > lastY + 5) setMinimized(true);\n        else if (y < lastY - 7) setMinimized(false);\n        lastY = y;\n        ticking = false;\n      });\n    };\n    window.addEventListener("scroll", onScroll, { passive: true });\n    return () => {\n      window.removeEventListener("scroll", onScroll);\n      if (idleTimer) clearTimeout(idleTimer);\n    };\n  }, []);`;

  if (customerNav.includes(oldScrollEffect)) customerNav = customerNav.replace(oldScrollEffect, newScrollEffect);

  // Refine the visual treatment without changing the existing navigation structure or contact modal.
  customerNav = customerNav.replace(
    `.customer-bottom-nav { transition: transform .5s cubic-bezier(.22,1,.36,1), opacity .35s ease; }`,
    `.customer-bottom-nav { transition: transform .5s cubic-bezier(.22,1,.36,1), opacity .35s ease, filter .35s ease; }`
  );
  customerNav = customerNav.replace(
    `background:rgba(255,255,255,.985);`,
    `background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,250,249,.96));\n          backdrop-filter:blur(18px);\n          -webkit-backdrop-filter:blur(18px);`
  );
  customerNav = customerNav.replace(
    `box-shadow:0 18px 48px -18px rgba(15,23,42,.24), 0 6px 18px -10px rgba(22,101,52,.22), inset 0 1px 0 rgba(255,255,255,.95);`,
    `box-shadow:0 22px 52px -20px rgba(15,23,42,.30), 0 8px 22px -12px rgba(22,101,52,.24), inset 0 1px 0 rgba(255,255,255,.98);`
  );
  customerNav = customerNav.replace(
    `.customer-bottom-nav.is-minimized { transform: translateY(2px); }`,
    `.customer-bottom-nav.is-minimized { transform: translateY(2px) scale(.992); filter:saturate(.96); }`
  );
  customerNav = customerNav.replace(
    `.customer-bottom-nav.is-minimized::before { box-shadow:0 12px 34px -16px rgba(15,23,42,.22), 0 5px 16px -10px rgba(22,101,52,.18); }`,
    `.customer-bottom-nav.is-minimized::before { box-shadow:0 14px 38px -18px rgba(15,23,42,.24), 0 6px 18px -11px rgba(22,101,52,.20); }`
  );
  customerNav = customerNav.replace(
    `.customer-nav-icon { transition: transform .45s cubic-bezier(.22,1,.36,1), opacity .35s ease, height .45s ease, margin .45s ease; }`,
    `.customer-nav-icon { transition: transform .42s cubic-bezier(.22,1,.36,1), opacity .28s ease, height .42s cubic-bezier(.22,1,.36,1), margin .42s cubic-bezier(.22,1,.36,1), box-shadow .3s ease; }`
  );
  customerNav = customerNav.replace(
    `.customer-bottom-nav.is-minimized .customer-nav-icon { transform: scale(.12); opacity:0; height:2px; margin-bottom:-2px; }`,
    `.customer-bottom-nav.is-minimized .customer-nav-icon { transform:scale(.12) translateY(3px); opacity:0; height:2px; margin-bottom:-2px; }`
  );
  customerNav = customerNav.replace(
    `.customer-nav-label { transition: transform .45s cubic-bezier(.22,1,.36,1), color .25s ease; }`,
    `.customer-nav-label { transition: transform .42s cubic-bezier(.22,1,.36,1), color .25s ease, opacity .28s ease; }`
  );

  await writeFile(customerBottomNavPath, customerNav, "utf8");
  console.log("Polished customer bottom navigation and added scroll-idle icon reveal.");
} catch (error) { console.warn("Customer bottom navigation patch skipped:", error instanceof Error ? error.message : error); }
