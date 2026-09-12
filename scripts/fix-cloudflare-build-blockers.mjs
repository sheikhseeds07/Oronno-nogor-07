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
  if (adminLayout.includes(productsNav) && !adminLayout.includes(offersNav)) { adminLayout = adminLayout.replace(productsNav, productsNav + "\n  " + offersNav); await writeFile(adminLayoutPath, adminLayout, "utf8"); console.log("Added Offers to admin navigation."); }
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
