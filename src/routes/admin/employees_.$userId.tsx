import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { getEmployeeProfile, checkInAttendance, checkOutAttendance } from "@/lib/attendance.functions";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Clock, LogIn, LogOut, XCircle } from "lucide-react";

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
    try {
      await checkIn({ data: { user_id: userId } });
      toast.success("Checked in successfully");
      qc.invalidateQueries({ queryKey: ["emp-profile", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const doCheckOut = async () => {
    try {
      await checkOut({ data: { user_id: userId } });
      toast.success("Checked out successfully");
      qc.invalidateQueries({ queryKey: ["emp-profile", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (isFetching && !data) return <AdminLayout><div className="p-8"><BrandLoader /></div></AdminLayout>;
  if (!data) return <AdminLayout><div className="p-8 text-center text-muted-foreground">Profile not found</div></AdminLayout>;

  const { profile, employee, attendance, activeAttendanceId } = data;

  return <AdminLayout>
    <div className="mb-4 flex items-center gap-3">
      <Link to="/admin/employees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Employee List
      </Link>
    </div>

    <div className="bg-white border rounded-2xl p-5 mb-5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="w-16 h-16 rounded-2xl bg-brand text-white flex items-center justify-center text-2xl font-bold shadow-sm">
          {(profile?.full_name ?? "?").charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold">{profile?.full_name ?? employee?.name}</div>
          <div className="text-sm text-muted-foreground">{employee?.position ?? "Employee"}</div>
          <div className="text-xs text-muted-foreground mt-1">📞 {employee?.phone} • ✉️ {employee?.email}</div>
        </div>
        {activeAttendanceId ? (
          <button onClick={doCheckOut} className="bg-red-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 shadow-sm">
            <LogOut className="w-4 h-4" /> Check Out
          </button>
        ) : (
          <button onClick={doCheckIn} className="bg-green-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 shadow-sm">
            <LogIn className="w-4 h-4" /> Check In
          </button>
        )}
      </div>
    </div>

    <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b font-semibold flex items-center gap-2">
        <Clock className="w-4 h-4" /> Attendance & Working Hours
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Check In</th>
              <th className="p-3 text-left">Check Out</th>
              <th className="p-3 text-left">Working Hours</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((a) => {
              const i = new Date(a.check_in);
              const o = a.check_out ? new Date(a.check_out) : null;
              const h = o ? ((o.getTime() - i.getTime()) / 3600000).toFixed(1) : "-";
              return <tr key={a.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="p-3">{format(i, "dd MMM yyyy")}</td>
                <td className="p-3">{format(i, "hh:mm a")}</td>
                <td className="p-3">{o ? format(o, "hh:mm a") : <span className="text-green-600 font-semibold">Active</span>}</td>
                <td className="p-3 font-semibold">{h === "-" ? "In Progress" : `${h} hours`}</td>
              </tr>;
            })}
            {!attendance.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><XCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />No attendance records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </AdminLayout>;
}
