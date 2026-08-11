import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { getEmployeeProfile, checkInAttendance, checkOutAttendance } from "@/lib/attendance.functions";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Clock, Award, ShoppingBag, CheckCircle2, XCircle, LogIn, LogOut } from "lucide-react";

export const Route = createFileRoute("/admin/employees_/$userId")({ component: Profile });

function Profile() {
  const { userId } = useParams({ from: "/admin/employees_/$userId" });
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getEmployeeProfile);
  const checkIn = useServerFn(checkInAttendance);
  const checkOut = useServerFn(checkOutAttendance);

  const { data, isFetching } = useQuery({
    queryKey: ["emp-profile", userId],
    queryFn: () => fetchProfile({ data: { user_id: userId } }),
  });

  const doCheckIn = async () => {
    try { await checkIn({ data: { user_id: userId } }); toast.success("চেক-ইন হয়েছে"); qc.invalidateQueries({ queryKey: ["emp-profile", userId] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); }
  };
  const doCheckOut = async () => {
    try { await checkOut({ data: { user_id: userId } }); toast.success("চেক-আউট হয়েছে"); qc.invalidateQueries({ queryKey: ["emp-profile", userId] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); }
  };

  if (isFetching && !data) return <AdminLayout><div className="p-8"><BrandLoader /></div></AdminLayout>;
  if (!data) return <AdminLayout><div className="p-8 text-center text-muted-foreground">প্রোফাইল পাওয়া যায়নি</div></AdminLayout>;

  const { profile, employee, attendance, activeAttendanceId, stats } = data;

  return (
    <AdminLayout>
      <div className="mb-4 flex items-center gap-3">
        <Link to="/admin/employees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> এমপ্লয়ি লিস্ট
        </Link>
      </div>

      <div className="bg-white border rounded-xl p-5 mb-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="w-16 h-16 rounded-full bg-brand text-white flex items-center justify-center text-2xl font-bold">
            {(profile?.full_name ?? "?").charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-bold">{profile?.full_name ?? employee?.name}</div>
            <div className="text-sm text-muted-foreground">{employee?.position ?? "Employee"}</div>
            <div className="text-xs text-muted-foreground mt-1">📞 {employee?.phone} • ✉️ {employee?.email}</div>
          </div>
          <div className="flex gap-2">
            {activeAttendanceId ? (
              <button onClick={doCheckOut} className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                <LogOut className="w-4 h-4" /> চেক-আউট
              </button>
            ) : (
              <button onClick={doCheckIn} className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                <LogIn className="w-4 h-4" /> চেক-ইন
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <Stat icon={Award} label="স্কোর" value={`${stats.score}/100`} color="text-amber-600" />
        <Stat icon={ShoppingBag} label="মোট অর্ডার" value={stats.totalOrders} color="text-indigo-600" />
        <Stat icon={CheckCircle2} label="ডেলিভার্ড" value={stats.delivered} color="text-green-600" />
        <Stat icon={Clock} label="ঘন্টা" value={`${stats.totalHours}h`} color="text-blue-600" />
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="p-3 border-b font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" /> অ্যাটেন্ডেন্স (গত ৩০ দিন)
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs">
            <tr>
              <th className="p-3 text-left">তারিখ</th>
              <th className="p-3 text-left">চেক-ইন</th>
              <th className="p-3 text-left">চেক-আউট</th>
              <th className="p-3 text-left">ঘন্টা</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((a) => {
              const inTime = new Date(a.check_in);
              const outTime = a.check_out ? new Date(a.check_out) : null;
              const hours = outTime ? ((outTime.getTime() - inTime.getTime()) / 3_600_000).toFixed(1) : "-";
              return (
                <tr key={a.id} className="border-t">
                  <td className="p-3">{format(inTime, "dd MMM yyyy")}</td>
                  <td className="p-3">{format(inTime, "hh:mm a")}</td>
                  <td className="p-3">{outTime ? format(outTime, "hh:mm a") : <span className="text-green-600 font-semibold">এখনো অ্যাক্টিভ</span>}</td>
                  <td className="p-3">{hours}</td>
                </tr>
              );
            })}
            {!attendance.length && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><XCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />কোনো অ্যাটেন্ডেন্স রেকর্ড নেই</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className={`flex items-center gap-2 ${color}`}><Icon className="w-4 h-4" /><span className="text-xs font-semibold">{label}</span></div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}
