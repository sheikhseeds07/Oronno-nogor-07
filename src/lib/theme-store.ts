export type SiteTheme = {
  id: string;
  name: string;
  className: string | null;
  dark: boolean;
  colors: [string, string, string];
};

export const SITE_THEMES: SiteTheme[] = [
  { id: "default", name: "ডিফল্ট", className: null, dark: false, colors: ["#2f8f4e", "#a7e0b5", "#ffffff"] },
  { id: "leaf", name: "লিফ", className: "theme-leaf", dark: false, colors: ["#307a4f", "#5fa532", "#eef5ef"] },
  { id: "ocean", name: "ওশান", className: "theme-ocean", dark: false, colors: ["#2563eb", "#0ea5e9", "#f5f8fc"] },
  { id: "sky", name: "স্কাই", className: "theme-sky", dark: false, colors: ["#3b82f6", "#4f6ff0", "#f0f4fa"] },
  { id: "sunset", name: "সানসেট", className: "theme-sunset", dark: false, colors: ["#e6185f", "#f97316", "#f7f4f3"] },
  { id: "rose", name: "রোজ", className: "theme-rose", dark: false, colors: ["#e2456e", "#f0607a", "#fdf3f5"] },
  { id: "doodle", name: "ডুডল", className: "theme-doodle", dark: false, colors: ["#e6a119", "#f08a2b", "#f8f4ea"] },
  { id: "silver", name: "সিলভার", className: "theme-silver", dark: false, colors: ["#595959", "#808080", "#eeeeee"] },
  { id: "pearl-aurora", name: "পার্ল অরোরা", className: "theme-pearl-aurora", dark: false, colors: ["#d1603d", "#cc6688", "#faf5f1"] },
  { id: "midnight", name: "মিডনাইট", className: "theme-midnight", dark: true, colors: ["#3d8ee0", "#7d4fd1", "#141726"] },
  { id: "royal-onyx", name: "রয়্যাল অনিক্স", className: "theme-royal-onyx", dark: true, colors: ["#e0b23d", "#b78d2e", "#101010"] },
  { id: "emerald-noir", name: "এমারাল্ড নোয়া", className: "theme-emerald-noir", dark: true, colors: ["#1fb783", "#e0b23d", "#0d1a15"] },
];

const STORAGE_KEY = "site-theme";

export function applyTheme(id: string) {
  if (typeof document === "undefined") return;
  const theme = SITE_THEMES.find((t) => t.id === id) ?? SITE_THEMES[0];
  const root = document.documentElement;
  SITE_THEMES.forEach((t) => t.className && root.classList.remove(t.className));
  if (theme.className) root.classList.add(theme.className);
  root.classList.toggle("dark", theme.dark);
  try { localStorage.setItem(STORAGE_KEY, theme.id); } catch { /* ignore */ }
}

export function getStoredTheme(): string {
  if (typeof localStorage === "undefined") return "default";
  try { return localStorage.getItem(STORAGE_KEY) || "default"; } catch { return "default"; }
}
