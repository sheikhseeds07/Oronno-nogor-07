import { Sparkles } from "lucide-react";

export function TopBar() {
  return (
    <div className="bg-gradient-to-r from-brand-dark via-brand to-brand-dark text-white overflow-hidden">
      <div className="container mx-auto px-3 py-1.5 sm:py-2 flex items-center justify-center gap-1.5 sm:gap-2">
        <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 animate-pulse" />
        <span className="min-w-0 truncate whitespace-nowrap text-center text-[11px] sm:text-sm font-medium tracking-wide">
          অরন্য নগড় — ছাদ বাগানির বিশ্বস্ত সঙ্গী
        </span>
        <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 animate-pulse" />
      </div>
    </div>
  );
}
