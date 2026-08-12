import { Sparkles } from "lucide-react";

export function TopBar() {
  return (
    <div className="bg-gradient-to-r from-brand-dark via-brand to-brand-dark text-white text-xs sm:text-sm overflow-hidden">
      <div className="container mx-auto px-3 py-2 flex items-center justify-center gap-2 text-center">
        <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
        <span className="font-medium tracking-wide">অরন্য নগর — বীজ, সার, কীটনাশক ও কৃষি সরঞ্জামের বিশ্বস্ত ঠিকানা</span>
        <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
      </div>
    </div>
  );
}
