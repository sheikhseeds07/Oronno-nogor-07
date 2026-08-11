import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { listAttendanceOverview, checkInAttendance, checkOutAttendance } from "@/lib/attendance.functions";
import { toast } from "sonner";
import { format } from "date-fns";
import { Clock, LogIn, LogOut, Eye, Users, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/attendance")({ component: AttendancePage });

function AttendancePage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listAttendanceOverview);
  const checkIn = useServerFn(checkInAttendance);
  const checkOut = useServerFn(checkOutAttendance);

  const { data, isFetching } = useQuery({
    queryKey: ["admin-attendance"],
    queryFn: () => fetchList({ data: { days: 30 } }),
    refetchInterval: 30_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-attendance"] });

  const handleIn = async (uid: string | null) => {
    if (!uid) return toast.error("ইউজার আইডি নেই");
    try { await checkIn({ data: { user_id: uid } }); toast.success("চেক-ইন হয়েছে"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); }
  };
  const handleOut = async (uid: string | null) => {
    if (!uid) return toast.error("ইউজার আইডি নেই");
    try { await checkOut({ data: { user_id: uid } }); toast.success("চেক-আউট হয়েছে"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); }
  };

  const employees = data?.employees ?? [];
  const presentToday = employees.filter((e) => e.todayCheckIn).length;
  const activeNow = employees.filter((e) => e.activeAttendanceId).length;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Clock className="w-6 h-6" /> হাজিরা / Attendance</h1>
        <div className="text-xs text-muted-foreground">গত ৩০ দিন</div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <StatCard icon={Users} label="মোট এমপ্লয়ি" value={employees.length} color="text-indigo-600" />
        <StatCard icon={CheckCircle2} label="আজ উপস্থিত" value={presentToday} color="text-green-600" />
        <StatCard icon={Clock} label="এখন অ্যাক্টিভ" value={activeNow} color="text-amber-600" />
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs">
              <tr>
                <th className="p-3 text-left">নাম</th>
                <th className="p-3 text-left">পদবী</th>
                <th className="p-3 text-left">আজ চেক-ইন</th>
                <th className="p-3 text-left">আজ চেক-আউট</th>
                <th className="p-3 text-left">উপস্থিত দিন</th>
                <th className="p-3 text-left">মোট ঘন্টা</th>
                <th className="p-3 text-right">একশন</th>
              </tr>
            </thead>
            <tbody>
              {isFetching && !data && <tr><td colSpan={7} className="p-2"><BrandLoader /></td></tr>}
              {employees.map((e) => (
                <tr key={e.employee_id} className="border-t">
                  <td className="p-3 font-semibold">{e.name}</td>
                  <td className="p-3">{e.position ?? "-"}</td>
                  <td className="p-3">{e.todayCheckIn ? format(new Date(e.todayCheckIn), "hh:mm a") : <span className="text-muted-foreground">-</span>}</td>
                  <td className="p-3">{e.todayCheckOut ? format(new Date(e.todayCheckOut), "hh:mm a") : (e.activeAttendanceId ? <span className="text-green-600 font-semibold">অ্যাক্টিভ</span> : <span className="text-muted-foreground">-</span>)}</td>
                  <td className="p-3">{e.presentDays}</td>
                  <td className="p-3">{e.totalHours}h</td>
                  <td className="p-3 text-right space-x-1 whitespace-nowrap">
                    {e.activeAttendanceId ? (
                      <button onClick={() => handleOut(e.user_id)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-600 text-white">
                        <LogOut className="w-3 h-3" /> চেক-আউট
                      </button>
                    ) : (
                      <button onClick={() => handleIn(e.user_id)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-600 text-white">
                        <LogIn className="w-3 h-3" /> চেক-ইন
                      </button>
                    )}
                    {e.user_id && (
                      <Link to="/admin/employees/$userId" params={{ userId: e.user_id }} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted">
                        <Eye className="w-3 h-3" /> বিস্তারিত
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {!isFetching && !employees.length && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">কোনো অ্যাক্টিভ এমপ্লয়ি নেই</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: number; color: string }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className={`flex items-center gap-2 ${color}`}><Icon className="w-4 h-4" /><span className="text-xs font-semibold">{label}</span></div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}
