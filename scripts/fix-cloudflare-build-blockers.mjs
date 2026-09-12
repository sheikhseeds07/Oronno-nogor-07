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

// Offers are first-class products, but must stay out of the normal shop/home collections.
const shopPath = path.resolve(here, "../src/routes/shop.tsx");
try {
  let shop = await readFile(shopPath, "utf8");
  const oldShopFilter = 'supabase.from("products").select("id,name,slug,price,sale_price,images,stock,short_description,description").eq("is_active", true)';
  const newShopFilter = 'supabase.from("products").select("id,name,slug,price,sale_price,images,stock,short_description,description").eq("is_active", true).eq("is_offer", false).eq("is_archived", false)';
  if (shop.includes(oldShopFilter) && !shop.includes(newShopFilter)) {
    shop = shop.replace(oldShopFilter, newShopFilter);
    await writeFile(shopPath, shop, "utf8");
    console.log("Excluded offer combos from /shop.");
  }
} catch (error) {
  console.warn("Offer /shop build patch skipped:", error instanceof Error ? error.message : error);
}

// Add Offers to the existing admin sidebar without replacing the production layout.
const adminLayoutPath = path.resolve(here, "../src/components/admin/AdminLayout.tsx");
try {
  let adminLayout = await readFile(adminLayoutPath, "utf8");
  const productsNav = '{ to: "/admin/products", label: "Products", icon: Package, perm: "products", tone: "from-amber-400 to-orange-500" },';
  const offersNav = '{ to: "/admin/offers", label: "Offers", icon: Sparkles, perm: "products", tone: "from-emerald-400 to-teal-500" },';
  if (adminLayout.includes(productsNav) && !adminLayout.includes(offersNav)) {
    adminLayout = adminLayout.replace(productsNav, productsNav + "\n  " + offersNav);
    await writeFile(adminLayoutPath, adminLayout, "utf8");
    console.log("Added Offers to admin navigation.");
  }
} catch (error) {
  console.warn("Offer admin navigation patch skipped:", error instanceof Error ? error.message : error);
}

// Add Offers to the customer desktop nav and drawer. Sparkles is already available elsewhere in the app.
const headerPath = path.resolve(here, "../src/components/layout/Header.tsx");
try {
  let header = await readFile(headerPath, "utf8");
  header = header.replace(
    'ShoppingCart, Search, X, ChevronRight, Home, Grid3x3, Phone, ArrowRight, Palette, Leaf, Sprout, Flower2, TreePine, Wheat, Sun, Users, UserRound',
    'ShoppingCart, Search, X, ChevronRight, Home, Grid3x3, Phone, ArrowRight, Palette, Leaf, Sprout, Flower2, TreePine, Wheat, Sun, Users, UserRound, Sparkles'
  );
  const desktopShop = '<Link to="/shop" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-dark hover:text-white hover:bg-gradient-to-r hover:from-brand hover:to-brand-dark rounded-full transition shrink-0"><Grid3x3 className="w-3.5 h-3.5" /> সকল পণ্য</Link>';
  const desktopOffers = '<Link to="/offers" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-brand-dark hover:text-white hover:bg-gradient-to-r hover:from-brand hover:to-brand-dark rounded-full transition shrink-0"><Sparkles className="w-3.5 h-3.5" /> অফার</Link>';
  if (header.includes(desktopShop) && !header.includes('to="/offers"')) header = header.replace(desktopShop, desktopShop + desktopOffers);
  const drawerShop = '<Link to="/shop" onClick={closeDrawer} style={{ "--d": nextDelay() } as React.CSSProperties} className="drawer-item group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-gradient-to-r hover:from-brand-light/60 hover:to-transparent transition">';
  const drawerOffers = '<Link to="/offers" onClick={closeDrawer} style={{ "--d": nextDelay() } as React.CSSProperties} className="drawer-item group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-gradient-to-r hover:from-brand-light/60 hover:to-transparent transition"><span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-orange-500/30 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300"><Sparkles className="w-3.5 h-3.5" /></span><span className="font-bold text-[13px]">অফার</span><ChevronRight className="w-4 h-4 ml-auto text-brand/50 group-hover:translate-x-1 group-hover:text-brand transition-all" /></Link>';
  if (header.includes(drawerShop) && !header.includes('>অফার</span>')) header = header.replace(drawerShop, drawerShop + drawerOffers);
  await writeFile(headerPath, header, "utf8");
  console.log("Added Offers to customer navigation.");
} catch (error) {
  console.warn("Offer customer navigation patch skipped:", error instanceof Error ? error.message : error);
}
