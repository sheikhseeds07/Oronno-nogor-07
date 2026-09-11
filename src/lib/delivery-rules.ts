export type DeliveryRule = { id: string; min_order: number; fee: number };

export const DEFAULT_DELIVERY_RULES: DeliveryRule[] = [
  { id: "delivery-0", min_order: 0, fee: 120 },
  { id: "delivery-200", min_order: 200, fee: 70 },
  { id: "delivery-300", min_order: 300, fee: 50 },
  { id: "delivery-800", min_order: 800, fee: 0 },
];

export function normalizeDeliveryRules(list?: unknown): DeliveryRule[] {
  if (!Array.isArray(list)) return DEFAULT_DELIVERY_RULES;
  const rules = list
    .map((r, i) => {
      const item = (r ?? {}) as Record<string, unknown>;
      return {
        id: String(item.id || `delivery-${i + 1}`),
        min_order: Math.max(0, Math.floor(Number(item.min_order) || 0)),
        fee: Math.max(0, Math.floor(Number(item.fee) || 0)),
      };
    })
    .sort((a, b) => a.min_order - b.min_order);
  return rules.length && rules.some((r) => r.min_order === 0) ? rules : DEFAULT_DELIVERY_RULES;
}

export function getDeliveryRule(subtotal: number, rules?: DeliveryRule[]) {
  const normalized = normalizeDeliveryRules(rules);
  return normalized.reduce((active, rule) => (rule.min_order <= subtotal ? rule : active), normalized[0]);
}

export function getDeliveryInfo(subtotal: number, rules?: DeliveryRule[]) {
  const normalized = normalizeDeliveryRules(rules);
  const active = getDeliveryRule(subtotal, normalized);
  const freeRule = normalized.find((r) => r.fee === 0 && r.min_order > subtotal);
  return {
    rules: normalized,
    active,
    delivery: active.fee,
    total: subtotal + active.fee,
    freeRule,
    amountToFree: freeRule ? Math.max(0, freeRule.min_order - subtotal) : 0,
  };
}
