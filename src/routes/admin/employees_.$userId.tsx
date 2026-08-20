import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { getEmployeeProfile, checkInAttendance, checkOutAttendance } from "@/lib/attendance.functions";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Clock, LogIn, LogOut, XCircle, Pencil, Upload, UserRound, X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { uploadToBucket, safeFileName } from "@/lib/storage-upload";

export const Route = createFileRoute("/admin/employees_/$userId")({ component: Profile });

function Profile() {
  const { userId } = useParams({ from: "/admin/employees_/$userId" });
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getEmployeeProfile);
  const checkIn = useServerFn(checkInAttendance);
  const checkOut = useServerFn(checkOutAttendance);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", join_date: "", salary: "", avatar_url: "" });

  const { data, isFetching } = useQuery({
    queryKey: ["emp-profile", userId],
    queryFn: () => fetchProfile({ data: { user_id: userId } }),
  });

  const openEditor = () => {
    setForm({
      name: data?.profile?.full_name ?? data?.employee?.name ?? "",
      phone: data?.profile?.phone ?? data?.employee?.phone ?? "",
      address: data?.profile?.address ?? "",
      join_date: data?.employee?.join_date ?? "",
      salary: data?.employee?.salary != null ? String(data.employee.salary) : "",
      avatar_url: data?.profile?.avatar_url ?? "",
    });
    setEditing(true);
  };

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("শুধু image file দিন");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image সর্বোচ্চ 5MB হতে পারবে");
    setAvatarUploading(true);
    try {
      const url = await uploadToBucket("site-assets", `employee-avatars/${userId}-${safeFileName(file.name)}`, file);
      setForm((v) => ({ ...v, avatar_url: url }));
      toast.success("Avatar আপলোড হয়েছে");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Avatar আপলোড হয়নি");
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!form.name.trim()) return toast.error("নাম দিন");
    if (!form.phone.trim()) return toast.error("নাম্বার দিন");
    const salary = form.salary.trim() === "" ? null : Number(form.salary);
    if (salary !== null && (!Number.isFinite(salary) || salary < 0)) return toast.error("সঠিক salary দিন");
    setSaving(true);
    try {
      const [{ error: profileError }, { error: employeeError }] = await Promise.all([
        supabase.from("profiles").update({ full_name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() || null, avatar_url: form.avatar_url || null }).eq("id", userId),
        supabase.from("employees").update({ name: form.name.trim(), phone: form.phone.trim(), join_date: form.join_date || null, salary } as any).eq("user_id", userId),
      ]);
      if (profileError) throw new Error(profileError.message);
      if (employeeError) throw new Error(employeeError.message);
      toast.success("Employee profile updated");
      setEditing(false);
      await qc.invalidateQueries({ queryKey: ["emp-profile", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Profile update failed");
    } finally {
      setSaving(false);
    }
  };

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
  const displayName = profile?.full_name ?? employee?.name ?? "Employee";
  const avatar = profile?.avatar_url;

  return <AdminLayout>
    <div className="mb-4 flex items-center gap-3">
      <Link to="/admin/employees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Employee List
      </Link>
    </div>

    <div className="bg-white border rounded-2xl p-5 mb-5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-brand text-white flex items-center justify-center text-2xl font-bold shadow-sm shrink-0">
          {avatar ? <img src={avatar} alt={displayName} className="w-full h-full object-cover" /> : <span>{displayName.charAt(0)}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold">{displayName}</div>
          <div className="text-sm text-muted-foreground">{employee?.position ?? "Employee"}</div>
          <div className="text-xs text-muted-foreground mt-1">📞 {employee?.phone ?? profile?.phone ?? "—"} • ✉️ {employee?.email ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">📍 {profile?.address || "Address not added"}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={openEditor} className="border px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-muted">
            <Pencil className="w-4 h-4" /> Edit Profile
          </button>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t">
        <div className="rounded-xl bg-muted/40 p-3"><div className="text-xs text-muted-foreground">Join Date</div><div className="font-semibold mt-1">{employee?.join_date ? format(new Date(`${employee.join_date}T00:00:00`), "dd MMM yyyy") : "Not added"}</div></div>
        <div className="rounded-xl bg-muted/40 p-3"><div className="text-xs text-muted-foreground">Salary</div><div className="font-semibold mt-1">{employee?.salary != null ? `৳${Number(employee.salary).toLocaleString("en-BD")}` : "Not added"}</div></div>
        <div className="rounded-xl bg-muted/40 p-3"><div className="text-xs text-muted-foreground">Position</div><div className="font-semibold mt-1">{employee?.position || "Employee"}</div></div>
        <div className="rounded-xl bg-muted/40 p-3"><div className="text-xs text-muted-foreground">Status</div><div className="font-semibold mt-1 text-green-600">{employee?.is_active ? "Active" : "Inactive"}</div></div>
      </div>
    </div>

    {editing && (
      <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && !saving && setEditing(false)}>
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="p-5 border-b flex items-center justify-between">
            <div><h2 className="text-lg font-bold">Edit Employee Profile</h2><p className="text-xs text-muted-foreground mt-1">Employee information update করুন</p></div>
            <button onClick={() => setEditing(false)} disabled={saving} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-brand text-white flex items-center justify-center text-2xl font-bold shrink-0">
                {form.avatar_url ? <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : <UserRound className="w-9 h-9" />}
              </div>
              <div>
                <label className="inline-flex items-center gap-2 border px-3 py-2 rounded-xl font-semibold cursor-pointer hover:bg-muted">
                  <Upload className="w-4 h-4" /> {avatarUploading ? "Uploading..." : "Change Image / Avatar"}
                  <input type="file" accept="image/*" className="hidden" disabled={avatarUploading || saving} onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
                </label>
                <div className="text-xs text-muted-foreground mt-1">JPG/PNG/WebP • max 5MB</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1"><span className="text-sm font-medium">Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-xl px-3 py-2.5" /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Phone Number</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border rounded-xl px-3 py-2.5" /></label>
              <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium">Address</span><textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="w-full border rounded-xl px-3 py-2.5 resize-none" /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Join Date</span><input type="date" value={form.join_date} onChange={(e) => setForm({ ...form, join_date: e.target.value })} className="w-full border rounded-xl px-3 py-2.5" /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Salary (৳)</span><input type="number" min="0" step="1" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="w-full border rounded-xl px-3 py-2.5" placeholder="e.g. 15000" /></label>
            </div>
          </div>
          <div className="p-5 border-t flex justify-end gap-2">
            <button onClick={() => setEditing(false)} disabled={saving} className="border px-4 py-2 rounded-xl font-semibold">Cancel</button>
            <button onClick={saveProfile} disabled={saving || avatarUploading} className="bg-brand text-white px-5 py-2 rounded-xl font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button>
          </div>
        </div>
      </div>
    )}

    <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b font-semibold flex items-center gap-2">
        <Clock className="w-4 h-4" /> Attendance & Working Hours
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs">
            <tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Check In</th><th className="p-3 text-left">Check Out</th><th className="p-3 text-left">Working Hours</th></tr>
          </thead>
          <tbody>
            {attendance.map((a) => {
              const i = new Date(a.check_in); const o = a.check_out ? new Date(a.check_out) : null; const h = o ? ((o.getTime() - i.getTime()) / 3600000).toFixed(1) : "-";
              return <tr key={a.id} className="border-t hover:bg-muted/30 transition-colors"><td className="p-3">{format(i, "dd MMM yyyy")}</td><td className="p-3">{format(i, "hh:mm a")}</td><td className="p-3">{o ? format(o, "hh:mm a") : <span className="text-green-600 font-semibold">Active</span>}</td><td className="p-3 font-semibold">{h === "-" ? "In Progress" : `${h} hours`}</td></tr>;
            })}
            {!attendance.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><XCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />No attendance records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </AdminLayout>;
}
