import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { getEmployeeProfile, checkInAttendance, checkOutAttendance } from "@/lib/attendance.functions";
import { getEmployeePerformance } from "@/lib/employee-performance.functions";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Clock, Award, ShoppingBag, CheckCircle2, XCircle, LogIn, LogOut, Ban, CalendarDays, Activity } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/employees_/$userId")({ component: Profile });

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function rangeFor(preset: string) {
  const now = new Date(); const end = isoDate(now); const start = new Date(now);
  if (preset === "yesterday") { start.setDate(start.getDate() - 1); return { start: isoDate(start), end: isoDate(start) }; }
  if (preset === "week") { start.setDate(start.getDate() - 6); return { start: isoDate(start), end }; }
  if (preset === "month") { start.setDate(start.getDate() - 29); return { start: isoDate(start), end }; }
  return { start: end, end };
}

function Profile() {
  const { userId } = useParams({ from: "/admin/employees_/$userId" });
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getEmployeeProfile);
  const fetchPerformance = useServerFn(getEmployeePerformance);
  const checkIn = useServerFn(checkInAttendance);
  const checkOut = useServerFn(checkOutAttendance);
  const [preset, setPreset] = useState("today");
  const initial = useMemo(() => rangeFor("today"), []);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);

  const { data, isFetching } = useQuery({ queryKey: ["emp-profile", userId], queryFn: () => fetchProfile({ data: { user_id: userId } }) });
  const { data: perf, isFetching: perfLoading } = useQuery({ queryKey: ["emp-performance", userId, start, end], queryFn: () => fetchPerformance({ data: { user_id: userId, start, end } }), refetchInterval: 30000 });

  const selectPreset = (p: string) => { setPreset(p); const r = rangeFor(p); setStart(r.start); setEnd(r.end); };
  const doCheckIn = async () => { try { await checkIn({ data: { user_id: userId } }); toast.success("চেক-ইন হয়েছে"); qc.invalidateQueries({ queryKey: ["emp-profile", userId] }); } catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); } };
  const doCheckOut = async () => { try { await checkOut({ data: { user_id: userId } }); toast.success("চেক-আউট হয়েছে"); qc.invalidateQueries({ queryKey: ["emp-profile", userId] }); } catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); } };

  if (isFetching && !data) return <AdminLayout><div className="p-8"><BrandLoader /></div></AdminLayout>;
  if (!data) return <AdminLayout><div className="p-8 text-center text-muted-foreground">প্রোফাইল পাওয়া যায়নি</div></AdminLayout>;
  const { profile, employee, attendance, activeAttendanceId, stats } = data;
  const confirmed = perf?.confirmed ?? 0, cancelled = perf?.cancelled ?? 0;
  const webOrder = perf?.webOrder ?? 0, incomplete = perf?.incomplete ?? 0;
  const total = Math.max(confirmed + cancelled, 1);
  const ring = (value: number, label: string, cls: string) => <div className="flex flex-col items-center gap-2"><div className={`relative w-32 h-32 rounded-full ${cls} p-2 shadow-sm`}><div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center"><span className="text-2xl font-extrabold">{value}</span><span className="text-[11px] text-muted-foreground">{label}</span></div></div></div>;

  return <AdminLayout>
    <div className="mb-4 flex items-center gap-3"><Link to="/admin/employees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> এমপ্লয়ি লিস্ট</Link></div>
    <div className="bg-white border rounded-2xl p-5 mb-5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="w-16 h-16 rounded-2xl bg-brand text-white flex items-center justify-center text-2xl font-bold shadow-sm">{(profile?.full_name ?? "?").charAt(0)}</div>
        <div className="flex-1 min-w-0"><div className="text-xl font-bold">{profile?.full_name ?? employee?.name}</div><div className="text-sm text-muted-foreground">{employee?.position ?? "কর্মচারী"}</div><div className="text-xs text-muted-foreground mt-1">📞 {employee?.phone} • ✉️ {employee?.email}</div></div>
        {activeAttendanceId ? <button onClick={doCheckOut} className="bg-red-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 shadow-sm"><LogOut className="w-4 h-4" /> চেক-আউট</button> : <button onClick={doCheckIn} className="bg-green-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 shadow-sm"><LogIn className="w-4 h-4" /> চেক-ইন</button>}
      </div>
    </div>

    <div className="bg-white border rounded-2xl p-4 mb-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 mb-4"><CalendarDays className="w-5 h-5 text-brand" /><h2 className="font-bold">পারফরম্যান্স রিপোর্ট</h2><span className="text-xs text-muted-foreground ml-auto">{start} — {end}</span></div>
      <div className="flex flex-wrap gap-2 mb-3">{[["today","আজ"],["yesterday","গতকাল"],["week","গত সপ্তাহ"],["month","গত মাস"]].map(([key,label]) => <button key={key} onClick={() => selectPreset(key)} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${preset === key ? "bg-brand text-white shadow-sm" : "bg-muted hover:bg-muted/70"}`}>{label}</button>)}</div>
      <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm">শুরুর তারিখ<input type="date" value={start} onChange={e => {setPreset("custom");setStart(e.target.value)}} className="mt-1 w-full border rounded-lg px-3 py-2" /></label><label className="text-sm">শেষের তারিখ<input type="date" value={end} onChange={e => {setPreset("custom");setEnd(e.target.value)}} className="mt-1 w-full border rounded-lg px-3 py-2" /></label></div>
    </div>

    <div className="grid sm:grid-cols-4 gap-3 mb-5">
      <Stat icon={CheckCircle2} label="কনফার্ম অর্ডার" value={perfLoading ? "…" : confirmed} color="text-green-600" />
      <Stat icon={Ban} label="ক্যানসেল অর্ডার" value={perfLoading ? "…" : cancelled} color="text-red-600" />
      <Stat icon={ShoppingBag} label="ওয়েব অর্ডার" value={perfLoading ? "…" : webOrder} color="text-indigo-600" />
      <Stat icon={Activity} label="ইনকমপ্লিট থেকে" value={perfLoading ? "…" : incomplete} color="text-amber-600" />
    </div>

    <div className="grid lg:grid-cols-2 gap-5 mb-5">
      <div className="bg-white border rounded-2xl p-6 shadow-sm flex flex-col items-center"><div className="w-full font-bold mb-5">ওয়েব অর্ডার</div>{ring(webOrder, "কনফার্ম", "bg-gradient-to-br from-indigo-500 to-blue-500")}</div>
      <div className="bg-white border rounded-2xl p-6 shadow-sm flex flex-col items-center"><div className="w-full font-bold mb-5">ইনকমপ্লিট</div>{ring(incomplete, "কনফার্ম", "bg-gradient-to-br from-amber-400 to-orange-500")}</div>
    </div>

    <div className="grid sm:grid-cols-4 gap-3 mb-5"><Stat icon={Award} label="স্কোর" value={`${stats.score}/100`} color="text-amber-600" /><Stat icon={ShoppingBag} label="মোট অর্ডার" value={stats.totalOrders} color="text-indigo-600" /><Stat icon={CheckCircle2} label="ডেলিভার্ড" value={stats.delivered} color="text-green-600" /><Stat icon={Clock} label="মোট কাজের সময়" value={`${perf?.totalHours ?? stats.totalHours} ঘন্টা`} color="text-blue-600" /></div>

    <div className="bg-white border rounded-2xl overflow-hidden shadow-sm"><div className="p-4 border-b font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> অ্যাটেন্ডেন্স ও কাজের সময়</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted text-xs"><tr><th className="p-3 text-left">তারিখ</th><th className="p-3 text-left">চেক-ইন</th><th className="p-3 text-left">চেক-আউট</th><th className="p-3 text-left">কাজের সময়</th></tr></thead><tbody>{attendance.map((a) => { const i = new Date(a.check_in), o = a.check_out ? new Date(a.check_out) : null; const h = o ? ((o.getTime()-i.getTime())/3600000).toFixed(1) : "-"; return <tr key={a.id} className="border-t hover:bg-muted/30 transition-colors"><td className="p-3">{format(i,"dd MMM yyyy")}</td><td className="p-3">{format(i,"hh:mm a")}</td><td className="p-3">{o ? format(o,"hh:mm a") : <span className="text-green-600 font-semibold">এখনো অ্যাক্টিভ</span>}</td><td className="p-3 font-semibold">{h === "-" ? "চলমান" : `${h} ঘন্টা`}</td></tr>})}{!attendance.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><XCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />কোনো অ্যাটেন্ডেন্স রেকর্ড নেই</td></tr>}</tbody></table></div></div>
  </AdminLayout>;
}

function Stat({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: string | number; color: string }) { return <div className="bg-white border rounded-2xl p-4 shadow-sm hover:-translate-y-0.5 transition-transform"><div className={`flex items-center gap-2 ${color}`}><Icon className="w-4 h-4" /><span className="text-xs font-semibold">{label}</span></div><div className="text-2xl font-extrabold mt-1">{value}</div></div>; }
