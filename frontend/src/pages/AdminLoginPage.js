import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n/I18nContext";
import { AUTH } from "@/constants/testIds";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const { t } = useT();
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/admin/login", form);
      login(data.token, data.user);
      toast.success(`${t("login.admin.welcome")}, ${data.user.firstName}`);
      nav("/admin");
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("login.admin.fail"));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <Navbar />
      <div className="max-w-md mx-auto px-6 py-20">
        <p className="overline text-[#B8962E]">{t("login.admin.overline")}</p>
        <h1 className="font-serif text-4xl mt-3 tracking-tight text-[#0F172A]">{t("login.admin.title")}</h1>

        <form onSubmit={submit} className="mt-8 bg-white rounded-2xl border border-slate-200 p-8 space-y-5">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("login.admin.phone")}</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="admin-phone"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]" required/>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("login.admin.password")}</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="admin-password"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]" required/>
          </div>
          <button type="submit" disabled={loading} className="btn-pill w-full" data-testid={AUTH.adminLoginButton}>
            {loading ? t("login.admin.signing") : t("login.admin.submit")}
          </button>
          <p className="text-xs text-slate-400 text-center">
            {t("login.admin.client")} <Link to="/login" className="underline">{t("login.admin.clientlink")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
