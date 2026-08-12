import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
};

type CartState = {
  items: CartItem[];
  bumpKey: number;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      bumpKey: 0,
      add: (item, qty = 1) => {
        const existing = get().items.find((i) => i.id === item.id);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.id === item.id ? { ...i, quantity: Math.min(i.quantity + qty, item.stock || 999) } : i,
            ),
            bumpKey: get().bumpKey + 1,
          });
        } else {
          set({ items: [...get().items, { ...item, quantity: qty }], bumpKey: get().bumpKey + 1 });
        }
      },
      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      setQty: (id, qty) =>
        set({
          items: get()
            .items.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, qty) } : i))
            .filter((i) => i.quantity > 0),
        }),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
      subtotal: () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),
    }),
    { name: "oronno-nogor-cart", skipHydration: true },
  ),
);

export function hydrateCartStore() {
  return useCart.persist.rehydrate();
}
