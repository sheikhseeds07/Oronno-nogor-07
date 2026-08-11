import { toast } from "sonner";

export function toastAddedToCart(name?: string) {
  toast.success("কার্টে যোগ হয়েছে ✓", {
    description: name ? name : undefined,
    duration: 1500,
  });
}
