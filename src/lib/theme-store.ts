export type SiteTheme = {
  id: string;
  name: string;
  className: string | null;
  dark: boolean;
  colors: [string, string, string];
};

export const SITE_THEMES: SiteTheme[] = [
  { id: "default", name: "ডিফল্ট", className: null, dark: false, colors: ["#185C3A", "#DCEBDD", "#F8F6EE"] },
  { id: "leaf", name: "লিফ", className: "theme-leaf", dark: false, colors: ["#307a4f", "#5fa532", "#eef5ef"] },
  { id: "ocean", name: "ওশান", className: "theme-ocean", dark: false, colors: ["#2563eb", "#0ea5e9", "#f5f8fc"] },
  { id: "sunset", name: "সানসেট", className: "theme-sunset", dark: false, colors: ["#e6185f", "#f97316", "#f7f4f3"] },
  { id: "rose", name: "রোজ", className: "theme-rose", dark: false, colors: ["#e2456e", "#f0607a", "#fdf3f5"] },
  { id: "midnight", name: "মিডনাইট", className: "theme-midnight", dark: true, colors: ["#3d8ee0", "#7d4fd1", "#141726"] },
];

const STORAGE_KEY = "site-theme";

const DEFAULT_THEME_VARS: Record<string, string> = {
  "--background": "#F8F6EE",
  "--foreground": "#173629",
  "--card": "#FFFFFF",
  "--card-foreground": "#173629",
  "--popover": "#FFFFFF",
  "--popover-foreground": "#173629",
  "--brand": "#185C3A",
  "--brand-dark": "#0F3F2A",
  "--brand-light": "#DCEBDD",
  "--primary": "#185C3A",
  "--primary-foreground": "#FFFFFF",
  "--secondary": "#F1EEE2",
  "--secondary-foreground": "#28523D",
  "--muted": "#F2F3ED",
  "--muted-foreground": "#68756E",
  "--accent": "#E8D9A8",
  "--accent-foreground": "#4A3D19",
  "--border": "#E2E4DB",
  "--input": "#E2E4DB",
  "--ring": "#185C3A",
  "--success": "#2E7D55",
  "--warning": "#C5962C",
  "--chart-1": "#185C3A",
  "--chart-2": "#C5962C",
  "--chart-3": "#B95C43",
  "--chart-4": "#527A67",
  "--chart-5": "#8C6B45",
  "--sidebar": "#FBFAF4",
  "--sidebar-foreground": "#173629",
  "--sidebar-primary": "#185C3A",
  "--sidebar-primary-foreground": "#FFFFFF",
  "--sidebar-accent": "#EAF1E9",
  "--sidebar-accent-foreground": "#28523D",
  "--sidebar-border": "#E2E4DB",
  "--sidebar-ring": "#185C3A",
};

export function applyTheme(id: string) {
  if (typeof document === "undefined") return;
  const theme = SITE_THEMES.find((t) => t.id === id) ?? SITE_THEMES[0];
  const root = document.documentElement;
  SITE_THEMES.forEach((t) => t.className && root.classList.remove(t.className));

  if (theme.id === "default") {
    Object.entries(DEFAULT_THEME_VARS).forEach(([name, value]) => root.style.setProperty(name, value));
  } else {
    Object.keys(DEFAULT_THEME_VARS).forEach((name) => root.style.removeProperty(name));
  }

  if (theme.className) root.classList.add(theme.className);
  root.classList.toggle("dark", theme.dark);
  try { localStorage.setItem(STORAGE_KEY, theme.id); } catch { /* ignore */ }
}

export function getStoredTheme(): string {
  if (typeof localStorage === "undefined") return "default";
  try { return localStorage.getItem(STORAGE_KEY) || "default"; } catch { return "default"; }
}
