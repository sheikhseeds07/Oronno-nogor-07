import { toast } from "sonner";

export function toastAddedToCart(name?: string) {
  toast.success("পণ্যটি কার্টে যোগ হয়েছে", {
    description: name ? `${name} — আপনার শপিং কার্টে সংরক্ষিত হয়েছে` : undefined,
    duration: 2000,
  });
}
