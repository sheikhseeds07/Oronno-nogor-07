export type SiteTexture = {
  id: string;
  name: string;
  nameEn: string;
  className: string | null;
  /** inline background used for the small preview swatch */
  preview: string;
};

export const SITE_TEXTURES: SiteTexture[] = [
  {
    id: "none",
    name: "সাধারণ",
    nameEn: "Plain",
    className: null,
    preview: "linear-gradient(135deg,#ffffff 0%,#eef3ee 100%)",
  },
  {
    id: "bamboo",
    name: "বাঁশপাতা",
    nameEn: "Bamboo",
    className: "texture-bamboo",
    preview:
      "repeating-linear-gradient(115deg,#2f8f4e 0 6px,#3fa85e 6px 12px,#dff0e2 12px 20px)",
  },
  {
    id: "tropical",
    name: "ট্রপিক্যাল",
    nameEn: "Tropical",
    className: "texture-tropical",
    preview:
      "radial-gradient(60% 70% at 25% 25%,#1fb783 0%,transparent 60%),radial-gradient(60% 70% at 75% 70%,#0f9d58 0%,transparent 60%),#d8f0e2",
  },
  {
    id: "golden",
    name: "গোল্ডেন",
    nameEn: "Golden",
    className: "texture-golden",
    preview:
      "linear-gradient(135deg,#f6d365 0%,#e0b23d 45%,#fff4d1 100%)",
  },
  {
    id: "shadow",
    name: "শ্যাডো",
    nameEn: "Shadow",
    className: "texture-shadow",
    preview:
      "repeating-linear-gradient(45deg,#2b2f33 0 5px,#3d4348 5px 10px)",
  },
  {
    id: "aurora",
    name: "অরোরা",
    nameEn: "Aurora",
    className: "texture-aurora",
    preview:
      "radial-gradient(60% 80% at 20% 30%,hsla(160,75%,55%,.9),transparent 60%),radial-gradient(50% 70% at 80% 20%,hsla(200,85%,60%,.85),transparent 60%),radial-gradient(70% 90% at 50% 100%,hsla(45,95%,60%,.8),transparent 65%),#151c28",
  },
  {
    id: "mesh",
    name: "মেশ",
    nameEn: "Mesh",
    className: "texture-mesh",
    preview:
      "conic-gradient(from 0deg at 30% 30%,#26d968,#47cfeb,#f6ce55,#e467bb,#26d968)",
  },
];

const STORAGE_KEY = "site-texture";

export function applyTexture(id: string) {
  if (typeof document === "undefined") return;
  const texture = SITE_TEXTURES.find((t) => t.id === id) ?? SITE_TEXTURES[0];
  const root = document.documentElement;
  SITE_TEXTURES.forEach((t) => t.className && root.classList.remove(t.className));
  if (texture.className) root.classList.add(texture.className);
  try {
    localStorage.setItem(STORAGE_KEY, texture.id);
  } catch {
    /* ignore */
  }
}

export function getStoredTexture(): string {
  if (typeof localStorage === "undefined") return "none";
  try {
    return localStorage.getItem(STORAGE_KEY) || "none";
  } catch {
    return "none";
  }
}
