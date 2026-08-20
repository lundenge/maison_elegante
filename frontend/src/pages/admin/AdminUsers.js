import { useEffect, useState, useCallback } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n/I18nContext";
import { ADMIN } from "@/constants/testIds";
import { formatRoleLabel } from "@/lib/utils";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";

export default function AdminUsers() {
  const { t } = useT();
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", password: "" });

  const load = useCallback(() => api.get("/admin/users").then((r) => setUsers(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const createAdmin = async (e) => {
    e.preventDefault();
    try {
      await api.post("/super-admin/create-admin", form);
      toast.success(t("admin.users.created"));
      setForm({ firstName: "", lastName: "", phone: "", email: "", password: "" });
      setOpen(false);
      load();
    } catch (err) { toast.error(getApiErrorMessage(err, "Failed")); }
  };

  const remove = async (id) => {
    if (!window.confirm(t("admin.users.confirm"))) return;
    try { await api.delete(`/super-admin/users/${id}`); load(); toast.success(t("admin.users.deleted")); }
    catch (err) { toast.error(getApiErrorMessage(err, "Failed")); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="overline text-[#D4AF37]">{t("admin.users.overline")}</p>
          <h1 className="font-serif text-4xl mt-2 tracking-tight">{t("admin.users.title")}</h1>
        </div>
        {isSuper && (
          <button onClick={() => setOpen(!open)} data-testid={ADMIN.createAdmin}
            className="inline-flex items-center gap-2 bg-[#D4AF37] text-[#0F172A] px-4 py-2 rounded-full text-sm font-medium hover:bg-[#B8962E] transition-colors">
            <UserPlus size={14}/> {t("admin.users.newadmin")}
          </button>
        )}
      </div>

      {open && isSuper && (
        <form onSubmit={createAdmin} className="mt-6 bg-[#111827] border border-white/5 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input required placeholder={t("admin.users.first")} value={form.firstName} onChange={(e) => setForm({...form, firstName: e.target.value})} className="dark-input" data-testid="new-admin-first"/>
          <input required placeholder={t("admin.users.last")} value={form.lastName} onChange={(e) => setForm({...form, lastName: e.target.value})} className="dark-input" data-testid="new-admin-last"/>
          <input required placeholder={t("admin.users.phone")} value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="dark-input" data-testid="new-admin-phone"/>
          <input required type="email" placeholder={t("admin.users.email")} value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="dark-input" data-testid="new-admin-email"/>
          <input required type="password" placeholder={t("admin.users.password")} value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="dark-input md:col-span-2" data-testid="new-admin-password"/>
          <button className="btn-pill md:col-span-2" data-testid="new-admin-submit">{t("admin.users.create")}</button>
        </form>
      )}

      <div className="mt-8 bg-[#111827] border border-white/5 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.15em] text-slate-500 border-b border-white/5">
              <th className="p-4">{t("admin.users.name")}</th>
              <th className="p-4">{t("admin.users.phone")}</th>
              <th className="p-4">{t("admin.users.location")}</th>
              <th className="p-4">{t("admin.users.role")}</th>
              <th className="p-4">{t("admin.users.joined")}</th>
              {isSuper && <th className="p-4"></th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5">
                <td className="p-4">{u.firstName} {u.lastName}</td>
                <td className="p-4 text-slate-400">{u.phone}</td>
                <td className="p-4 text-slate-400 text-xs">{u.city}, {u.country}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-[0.15em] ${
                    u.role === "super_admin" ? "bg-[#D4AF37]/20 text-[#D4AF37]" :
                    u.role === "admin" ? "bg-blue-900/40 text-blue-400" : "bg-slate-800 text-slate-400"
                  }`}>{formatRoleLabel(u.role)}</span>
                </td>
                <td className="p-4 text-slate-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                {isSuper && (
                  <td className="p-4">
                    {u.role !== "super_admin" && (
                      <button onClick={() => remove(u.id)} data-testid={ADMIN.deleteUser(u.id)}
                        className="text-rose-400 hover:text-rose-300"><Trash2 size={14}/></button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`.dark-input { background: #0B0F19; border: 1px solid #1E293B; border-radius: 0.5rem; padding: 0.7rem 1rem; color: #F8FAFC; font-size: 0.85rem; outline: none; transition: border-color 200ms ease; } .dark-input:focus { border-color: #D4AF37; }`}</style>
    </div>
  );
}
