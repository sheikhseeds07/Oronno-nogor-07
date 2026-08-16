import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { listAttendanceOverview, checkInAttendance, checkOutAttendance } from "@/lib/attendance.functions";
import { toast } from "sonner";
import { format, addDays, addMonths, endOfMonth, endOfWeek, isSameDay, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { bn } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, LogIn, LogOut, Eye, Users, CheckCircle2, Timer, Sparkles, UserRound, BriefcaseBusiness } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/attendance")({ component: AttendancePage });

type Employee = { employee_id: string; user_id: string | null; name: string; position?: string | null; activeAttendanceId: string | null; todayCheckIn: string | null; todayCheckOut: string | null; presentDays: number; totalHours: number; attendance: Array<{ id: string; date: string; checkIn: string; checkOut: string | null }> };

function AttendancePage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listAttendanceOverview);
  const checkIn = useServerFn(checkInAttendance);
  const checkOut = useServerFn(checkOutAttendance);
  const [month, setMonth] = useState(new Date());
  const [selectedId, setSelectedId] = useState<string>("");

  const { data, isFetching } = useQuery({ queryKey: ["admin-attendance"], queryFn: () => fetchList({ data: { days: 90 } }), refetchInterval: 30_000 });
  const employees = (data?.employees ?? []) as Employee[];
  const selected = employees.find((e) => e.employee_id === selectedId) ?? employees[0];
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-attendance"] });

  const handleIn = async (uid: string | null) => { if (!uid) return toast.error("ইউজার আইডি নেই"); try { await checkIn({ data: { user_id: uid } }); toast.success("চেক-ইন হয়েছে"); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); } };
  const handleOut = async (uid: string | null) => { if (!uid) return toast.error("ইউজার আইডি নেই"); try { await checkOut({ data: { user_id: uid } }); toast.success("চেক-আউট হয়েছে"); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); } };

  const today = new Date();
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const days: Date[] = []; let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [month]);

  const monthRows = selected?.attendance.filter((a) => a.date.startsWith(format(month, "yyyy-MM"))) ?? [];
  const presentThisMonth = new Set(monthRows.map((a) => a.date)).size;
  const completedRows = monthRows.filter((a) => a.checkOut);
  const monthHours = completedRows.reduce((sum, a) => sum + Math.max(0, (new Date(a.checkOut!).getTime() - new Date(a.checkIn).getTime()) / 3600000), 0);
  const activeToday = !!selected?.activeAttendanceId;

  return (
    <AdminLayout>
      <div className="space-y-5 pb-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 text-white p-5 sm:p-7 shadow-xl">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-2xl" />
          <div className="absolute -left-20 -bottom-28 h-64 w-64 rounded-full bg-cyan-400/10 blur-2xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-emerald-200"><Sparkles className="h-3.5 w-3.5" /> Smart Attendance</div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2"><CalendarDays className="h-7 w-7 text-emerald-300" /> হাজিরা</h1>
              <p className="mt-1 text-sm text-slate-300">কর্মীদের হাজিরা, সময় ও দৈনিক উপস্থিতি এক নজরে দেখুন।</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"><div className="text-[11px] text-slate-400">আজ</div><div className="font-bold">{format(today, "dd MMMM yyyy", { locale: bn })}</div></div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3"><div className="text-[11px] text-emerald-200">লাইভ স্ট্যাটাস</div><div className="font-bold flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> আপডেটেড</div></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users} label="মোট এমপ্লয়ি" value={employees.length} tone="indigo" />
          <StatCard icon={CheckCircle2} label="আজ উপস্থিত" value={employees.filter((e) => e.todayCheckIn).length} tone="emerald" />
          <StatCard icon={Timer} label="এখন অ্যাক্টিভ" value={employees.filter((e) => e.activeAttendanceId).length} tone="amber" />
          <StatCard icon={Clock} label="এই মাসে ঘণ্টা" value={selected ? `${monthHours.toFixed(1)}h` : "0h"} tone="violet" />
        </div>

        <div className="grid xl:grid-cols-[290px_1fr] gap-5">
          <aside className="bg-white border rounded-3xl p-4 shadow-sm h-fit xl:sticky xl:top-4">
            <div className="flex items-center justify-between mb-3"><div><p className="text-xs text-muted-foreground">কর্মী নির্বাচন</p><h2 className="font-bold">Team</h2></div><UserRound className="h-5 w-5 text-emerald-600" /></div>
            <div className="space-y-2 max-h-[480px] overflow-auto pr-1">
              {isFetching && !data ? <BrandLoader /> : employees.map((e) => {
                const active = selected?.employee_id === e.employee_id;
                return <button key={e.employee_id} onClick={() => setSelectedId(e.employee_id)} className={`w-full text-left rounded-2xl p-3 border transition-all duration-300 ${active ? "border-emerald-400 bg-emerald-50 shadow-sm scale-[1.01]" : "border-slate-100 hover:border-emerald-200 hover:bg-slate-50"}`}>
                  <div className="flex items-center gap-3"><div className={`h-10 w-10 rounded-xl grid place-items-center font-bold ${active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{e.name?.charAt(0) ?? "?"}</div><div className="min-w-0 flex-1"><div className="font-semibold truncate">{e.name}</div><div className="text-[11px] text-muted-foreground truncate">{e.position ?? "কর্মী"}</div></div>{e.activeAttendanceId && <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />}</div>
                  <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>{e.presentDays} দিন উপস্থিত</span><span>{e.totalHours}h</span></div>
                </button>;
              })}
            </div>
            {selected && <Link to="/admin/employees/$userId" params={{ userId: selected.user_id ?? "" }} className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition"><Eye className="h-4 w-4" /> বিস্তারিত প্রোফাইল</Link>}
          </aside>

          <main className="min-w-0">
            {selected ? <>
              <div className="bg-white border rounded-3xl p-4 sm:p-5 shadow-sm mb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3"><div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 grid place-items-center font-black text-lg">{selected.name.charAt(0)}</div><div><h2 className="text-lg font-extrabold">{selected.name}</h2><p className="text-xs text-muted-foreground flex items-center gap-1"><BriefcaseBusiness className="h-3 w-3" /> {selected.position ?? "কর্মী"}</p></div></div>
                  <div className="flex flex-wrap gap-2">
                    {selected.activeAttendanceId ? <button onClick={() => handleOut(selected.user_id)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 text-white px-4 py-2.5 text-sm font-bold shadow-sm hover:bg-red-700 active:scale-95 transition"><LogOut className="h-4 w-4" /> চেক-আউট</button> : <button onClick={() => handleIn(selected.user_id)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-bold shadow-sm hover:bg-emerald-700 active:scale-95 transition"><LogIn className="h-4 w-4" /> চেক-ইন</button>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4"><MiniStat label="এই মাসে উপস্থিত" value={`${presentThisMonth} দিন`} /><MiniStat label="মোট ঘণ্টা" value={`${monthHours.toFixed(1)}h`} /><MiniStat label="আজ" value={activeToday ? "অ্যাক্টিভ" : selected.todayCheckIn ? "সম্পন্ন" : "এখনও নেই"} /></div>
              </div>

              <div className="bg-white border rounded-3xl shadow-sm overflow-hidden animate-in fade-in duration-300">
                <div className="p-4 sm:p-5 border-b bg-gradient-to-r from-white to-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div><p className="text-xs text-muted-foreground">Attendance Calendar</p><h2 className="text-xl font-black">{format(month, "MMMM yyyy", { locale: bn })}</h2></div>
                  <div className="flex items-center gap-1.5"><button onClick={() => setMonth(subMonths(month, 1))} className="h-9 w-9 rounded-xl border grid place-items-center hover:bg-slate-50 active:scale-90 transition"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setMonth(new Date())} className="px-3 h-9 rounded-xl border text-xs font-bold hover:bg-slate-50 transition">আজ</button><button onClick={() => setMonth(addMonths(month, 1))} className="h-9 w-9 rounded-xl border grid place-items-center hover:bg-slate-50 active:scale-90 transition"><ChevronRight className="h-4 w-4" /></button></div>
                </div>
                <div className="p-3 sm:p-5">
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">{["রবি","সোম","মঙ্গল","বুধ","বৃহঃ","শুক্র","শনি"].map((d) => <div key={d} className="text-center text-[10px] sm:text-xs font-bold text-muted-foreground py-2">{d}</div>)}</div>
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {calendarDays.map((day) => {
                      const key = format(day, "yyyy-MM-dd");
                      const record = monthRows.find((a) => a.date === key);
                      const inMonth = day.getMonth() === month.getMonth();
                      const isToday = isSameDay(day, today);
                      return <div key={key} title={record ? `চেক-ইন ${format(new Date(record.checkIn), "hh:mm a")}${record.checkOut ? ` • চেক-আউট ${format(new Date(record.checkOut), "hh:mm a")}` : " • অ্যাক্টিভ"}` : "এই দিনে কোনো হাজিরা রেকর্ড নেই"} className={`group min-h-[66px] sm:min-h-[82px] rounded-2xl border p-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${!inMonth ? "opacity-30 bg-slate-50" : record ? record.checkOut ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/80" : "border-slate-100 bg-white hover:border-slate-200"} ${isToday ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}>
                        <div className="flex items-center justify-between"><span className={`text-xs sm:text-sm font-bold ${isToday ? "text-emerald-700" : "text-slate-700"}`}>{format(day, "d")}</span>{record && <span className={`h-2 w-2 rounded-full ${record.checkOut ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />}</div>
                        {record && <div className="mt-2 space-y-1"><div className="text-[9px] sm:text-[10px] font-semibold text-slate-600">{format(new Date(record.checkIn), "hh:mm a")}</div><div className={`text-[9px] font-bold ${record.checkOut ? "text-emerald-700" : "text-amber-700"}`}>{record.checkOut ? "উপস্থিত ✓" : "অ্যাক্টিভ • এখন"}</div></div>}
                        {!record && inMonth && <div className="mt-3 text-[9px] text-slate-300 group-hover:text-slate-400 transition">রেকর্ড নেই</div>}
                      </div>;
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> সম্পন্ন</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" /> অ্যাক্টিভ</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full border bg-white" /> রেকর্ড নেই</span></div>
                </div>
              </div>
            </> : <div className="bg-white border rounded-3xl p-12 text-center text-muted-foreground">কোনো অ্যাক্টিভ এমপ্লয়ি নেই</div>}
          </main>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Clock; label: string; value: number | string; tone: string }) {
  const tones: Record<string, string> = { indigo: "bg-indigo-50 text-indigo-600", emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", violet: "bg-violet-50 text-violet-600" };
  return <div className="bg-white border rounded-2xl p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"><div className="flex items-center gap-2"><span className={`h-9 w-9 rounded-xl grid place-items-center ${tones[tone]}`}><Icon className="h-4 w-4" /></span><span className="text-xs font-semibold text-muted-foreground">{label}</span></div><div className="text-2xl font-black mt-2">{value}</div></div>;
}
function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5"><div className="text-[10px] text-muted-foreground">{label}</div><div className="font-extrabold text-sm mt-0.5">{value}</div></div>; }
