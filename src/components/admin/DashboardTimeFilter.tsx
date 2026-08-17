import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Preset = "today" | "yesterday" | "7d" | "30d" | "month" | "lastMonth" | "custom";
export type DashboardRange = { from: string; to: string };

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "month", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "custom", label: "Custom Range" },
];

const isoRange = (from: Date, to: Date): DashboardRange => ({
  from: startOfDay(from).toISOString(),
  to: endOfDay(to).toISOString(),
});

export function getDashboardPresetRange(preset: Preset, now = new Date()): DashboardRange | null {
  const today = startOfDay(now);
  if (preset === "today") return isoRange(today, today);
  if (preset === "yesterday") { const day = subDays(today, 1); return isoRange(day, day); }
  if (preset === "7d") return isoRange(subDays(today, 6), today);
  if (preset === "30d") return isoRange(subDays(today, 29), today);
  if (preset === "month") return isoRange(startOfMonth(today), today);
  if (preset === "lastMonth") { const month = subMonths(today, 1); return isoRange(startOfMonth(month), endOfMonth(month)); }
  return null;
}

export function DashboardTimeFilter({ value, onChange }: { value: Preset; onChange: (preset: Preset, range: DashboardRange | null) => void }) {
  const [open, setOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange>();
  const label = useMemo(() => {
    if (value === "custom" && customRange?.from && customRange?.to) return `${format(customRange.from, "dd MMM")} → ${format(customRange.to, "dd MMM")}`;
    return PRESETS.find((p) => p.key === value)?.label ?? "Today";
  }, [value, customRange]);

  const choose = (preset: Preset) => {
    if (preset === "custom") return;
    onChange(preset, getDashboardPresetRange(preset));
    setOpen(false);
  };

  const applyCustom = () => {
    if (!customRange?.from || !customRange?.to) return;
    const from = customRange.from <= customRange.to ? customRange.from : customRange.to;
    const to = customRange.from <= customRange.to ? customRange.to : customRange.from;
    onChange("custom", isoRange(from, to));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 gap-2 rounded-lg bg-white px-3 text-xs font-bold shadow-sm">
          <CalendarDays className="h-4 w-4" /><span>{label}</span><ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] rounded-xl p-2">
        <div className="grid gap-1">
          {PRESETS.filter((p) => p.key !== "custom").map((p) => (
            <button key={p.key} type="button" onClick={() => choose(p.key)} className={cn("rounded-lg px-3 py-2 text-left text-xs font-semibold transition hover:bg-slate-100", value === p.key && "bg-slate-900 text-white hover:bg-slate-900")}>{p.label}</button>
          ))}
          <div className="mt-1 border-t pt-2">
            <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-wide text-slate-400">Custom Range</div>
            <Calendar mode="range" selected={customRange} onSelect={setCustomRange} numberOfMonths={1} className="mx-auto rounded-lg border p-2" />
            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <span className="text-[10px] font-semibold text-slate-500">{customRange?.from && customRange?.to ? `${format(customRange.from, "dd MMM yyyy")} → ${format(customRange.to, "dd MMM yyyy")}` : "Select start and end date"}</span>
              <Button size="sm" onClick={applyCustom} disabled={!customRange?.from || !customRange?.to} className="h-7 rounded-md px-3 text-[10px]">Apply</Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
export type { Preset as DashboardPreset };
