import logo from "@/assets/logo.jpg";

export function BrandLoader({ label = "অরন্য নগর", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-6 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-brand/20 animate-ping" />
        <img src={logo} alt={label} className="relative w-10 h-10 rounded-full object-cover ring-2 ring-brand/40" />
      </div>
      <div className="text-xs font-bold text-brand-dark">{label}</div>
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
        <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
      </div>
    </div>
  );
}
