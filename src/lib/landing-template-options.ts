export const LANDING_TEMPLATE_OPTIONS = [
  { value: "product", label: "Product Style", description: "HN Garden inspired — single product sales landing page" },
  { value: "combo", label: "Combo", description: "বর্তমান combo funnel style" },
  { value: "all", label: "All Product", description: "All Product Template" },
] as const;

export type LandingTemplate = typeof LANDING_TEMPLATE_OPTIONS[number]["value"];
