import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { toast } from "sonner";
import { Plus, Trash2, KeyRound, UserCog, Eye, ShieldCheck } from "lucide-react";
import {
  createEmployee, updateEmployeePermissions, deleteEmployee,
  resetEmployeePassword, listEmployeesFull, updateEmployeeRole,
  type EmployeePermissions,
} from "@/lib/employee-admin.functions";

export const Route = createFileRoute("/admin/employees")({ component: Employees });

const PERM_LABELS: { key: keyof EmployeePermissions; label: string }[] = [
  { key: "orders", label: "অর্ডার" },
  { key: "web_orders", label: "ওয়েব অর্ডার" },
  { key: "new_order", label: "নিউ অর্ডার" },
  { key: "products", label: "প্রোডাক্ট" },
  { key: "categories", label: "ক্যাটাগরি" },
  { key: "customers", label: "কাস্টমার" },
  { key: "marketing", label: "মার্কেটিং (ব্যানার/কুপন)" },
  { key: "landing_pages", label: "ল্যান্ডিং পেজ" },
  { key: "all_api", label: "All API" },
  { key: "messages", label: "মেসেজ / ইনবক্স" },
  { key: "delivery", label: "ডেলিভারি" },
  { key: "reports", label: "রিপোর্ট" },
  { key: "hrm", label: "HRM / এমপ্লয়ি" },
  { key: "settings", label: "সেটিংস" },
];

const emptyPerms: EmployeePermissions = {
  orders: false, web_orders: false, new_order: false, products: false, categories: false,
  customers: false, marketing: false, delivery: false, reports: false, hrm: false,
  settings: false, landing_pages: false, all_api: false, messages: false,
};

function Employees() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmployeesFull);
  const createFn = useServerFn(createEmployee);
  const updatePermsFn = useServerFn(updateEmployeePermissions);
  const updateRoleFn = useServerFn(updateEmployeeRole);
  const deleteFn = useServerFn(deleteEmployee);
  const resetPwdFn = useServerFn(resetEmployeePassword);

  const [showForm, setShowForm] = useState(false);
  const [editingPerms, setEditingPerms] = useState<{ user_id: string; perms: EmployeePermissions; role: "super_admin" | "admin" | "employee" } | null>(null);
  const [form, setForm] = useState<{
    name: string;
    phone: string;
    email: string;
    password: string;
    position: string;
    role: "super_admin" | "admin" | "employee";
    permissions: EmployeePermissions;
  }>({
    name: "", phone: "", email: "", password: "", position: "", role: "employee",
    permissions: { ...emptyPerms, orders: true, web_orders: true } as EmployeePermissions,
  });


  const { data, isFetching } = useQuery({
    queryKey: ["admin-employees-full"],
    queryFn: () => listFn({}),
  });

  const reset = () => {
    setForm({
      name: "", phone: "", email: "", password: "", position: "", role: "employee",
      permissions: { ...emptyPerms, orders: true, web_orders: true },
    });
    setShowForm(false);
  };

  const create = async () => {
    if (!form.name || !form.phone || !form.email || !form.password) return toast.error("সব ফিল্ড দিন");
    if (form.password.length < 6) return toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর");
    try {
      await createFn({ data: form });
      toast.success("এমপ্লয়ি তৈরি হয়েছে");
      reset();
      qc.invalidateQueries({ queryKey: ["admin-employees-full"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ব্যর্থ");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("এমপ্লয়ি ডিলিট করব? auth user-ও মুছে যাবে।")) return;
    try {
      await deleteFn({ data: { employee_id: id } });
      qc.invalidateQueries({ queryKey: ["admin-employees-full"] });
      toast.success("ডিলিট হয়েছে");
    } catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); }
  };

  const savePerms = async () => {
    if (!editingPerms) return;
    try {
      await updatePermsFn({ data: { user_id: editingPerms.user_id, permissions: editingPerms.perms } });
      await updateRoleFn({ data: { user_id: editingPerms.user_id, role: editingPerms.role as any } });
      toast.success("পার্মিশন ও রোল আপডেট হয়েছে");
      setEditingPerms(null);
      qc.invalidateQueries({ queryKey: ["admin-employees-full"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); }
  };

  const resetPwd = async (uid: string) => {
    const p = prompt("নতুন পাসওয়ার্ড (কমপক্ষে ৬):");
    if (!p || p.length < 6) return;
    try {
      await resetPwdFn({ data: { user_id: uid, password: p } });
      toast.success("পাসওয়ার্ড রিসেট");
    } catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">এমপ্লয়ি ম্যানেজমেন্ট</h1>
        <button onClick={() => setShowForm((v) => !v)} className="bg-brand text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> {showForm ? "বন্ধ" : "নতুন এমপ্লয়ি"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <h2 className="font-bold mb-3">নতুন এমপ্লয়ি তৈরি</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input placeholder="পূর্ণ নাম" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded-lg px-3 py-2" />
            <input placeholder="পদবী (যেমন: Order Manager)" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="border rounded-lg px-3 py-2" />
            <input placeholder="ফোন (লগইন নাম্বার)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border rounded-lg px-3 py-2" />
            <input placeholder="ইমেইল (লগইন)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border rounded-lg px-3 py-2" />
            <input placeholder="পাসওয়ার্ড (কমপক্ষে ৬)" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="border rounded-lg px-3 py-2 sm:col-span-2" />
          </div>
          <div className="mt-4">
            <div className="text-sm font-semibold mb-2">ইউজার রোল (CEO/Employee):</div>
            <select 
              value={form.role} 
              onChange={(e) => setForm({ ...form, role: e.target.value as any })}
              className="border rounded-lg px-3 py-2 w-full max-w-xs"
            >
              <option value="employee">সাধারণ এমপ্লয়ি (Employee)</option>
              <option value="admin">অ্যাডমিন (Admin)</option>
              <option value="super_admin">CEO (Super Admin)</option>
            </select>
          </div>
          <div className="mt-4">
            <div className="text-sm font-semibold mb-2">পার্মিশন (যা যা চালাতে পারবে):</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PERM_LABELS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 text-sm border rounded-lg px-2 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.permissions[p.key]}
                    onChange={(e) => setForm({ ...form, permissions: { ...form.permissions, [p.key]: e.target.checked } })}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <button onClick={reset} className="px-4 py-2 rounded-lg border">বাতিল</button>
            <button onClick={create} className="px-5 py-2 rounded-lg bg-brand text-white font-semibold">তৈরি করুন</button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left">নাম</th>
              <th className="p-3 text-left">পদবী</th>
              <th className="p-3 text-left">ফোন</th>
              <th className="p-3 text-left">ইমেইল</th>
              <th className="p-3 text-left">রোল</th>
              <th className="p-3 text-left">পার্মিশন</th>
              <th className="p-3 text-right">একশন</th>
            </tr>
          </thead>
          <tbody>
            {isFetching && <tr><td colSpan={6} className="p-2"><BrandLoader /></td></tr>}
            {data?.map((e: any) => {
              const perms = (e.permissions ?? null) as (EmployeePermissions & { user_id: string }) | null;
              const activeCount = perms ? PERM_LABELS.filter((p) => perms[p.key]).length : 0;
              const roleLabel = e.role === "super_admin" ? "CEO" : e.role === "admin" ? "অ্যাডমিন" : "এমপ্লয়ি";
              const roleColor = e.role === "super_admin" ? "bg-purple-100 text-purple-700" : e.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700";
              return (
                <tr key={e.id} className="border-t">
                  <td className="p-3 font-semibold">{e.name}</td>
                  <td className="p-3">{e.position}</td>
                  <td className="p-3">{e.phone}</td>
                  <td className="p-3">{e.email}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor}`}>
                      {roleLabel}
                    </span>
                  </td>
                  <td className="p-3"><span className="text-xs bg-muted rounded-full px-2 py-0.5">{activeCount} active</span></td>
                  <td className="p-3 text-right space-x-1">
                    {e.user_id && (
                      <Link to="/admin/employees/$userId" params={{ userId: e.user_id }} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted">
                        <Eye className="w-3 h-3" /> প্রোফাইল
                      </Link>
                    )}
                    {e.user_id && perms && (
                      <button onClick={() => setEditingPerms({ user_id: e.user_id!, perms, role: e.role })} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted">
                        <UserCog className="w-3 h-3" /> পার্মিশন
                      </button>
                    )}
                    {e.user_id && (
                      <button onClick={() => resetPwd(e.user_id!)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted">
                        <KeyRound className="w-3 h-3" /> পাস
                      </button>
                    )}
                    <button onClick={() => remove(e.id)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!isFetching && !data?.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">কোনো এমপ্লয়ি নেই</td></tr>}
          </tbody>
        </table>
      </div>

      {editingPerms && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-5">
            <h3 className="font-bold text-lg mb-3">রোল ও পার্মিশন আপডেট</h3>
            <div className="mb-4">
              <div className="text-sm font-semibold mb-2">ইউজার রোল:</div>
              <select 
                value={editingPerms.role} 
                onChange={(e) => setEditingPerms({ ...editingPerms, role: e.target.value as any })}
                className="border rounded-lg px-3 py-2 w-full max-w-xs"
              >
                <option value="employee">সাধারণ এমপ্লয়ি (Employee)</option>
                <option value="admin">অ্যাডমিন (Admin)</option>
                <option value="super_admin">CEO (Super Admin)</option>
              </select>
            </div>
            <div className="mb-4">
              <div className="text-sm font-semibold mb-2">মডিউল পার্মিশন:</div>
              {PERM_LABELS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 text-sm border rounded-lg px-2 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPerms.perms[p.key]}
                    onChange={(e) => setEditingPerms({ ...editingPerms, perms: { ...editingPerms.perms, [p.key]: e.target.checked } })}
                  />
                  {p.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingPerms(null)} className="px-4 py-2 rounded-lg border">বাতিল</button>
              <button onClick={savePerms} className="px-5 py-2 rounded-lg bg-brand text-white font-semibold">সেভ</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
