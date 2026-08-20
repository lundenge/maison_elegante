import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n/I18nContext";
import { AUTH } from "@/constants/testIds";
import { toast } from "sonner";

export default function UserLoginPage() {
  const { t } = useT();
  const { login } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/user/login", { phone });
      login(data.token, data.user);
      toast.success(`${t("login.user.welcome")}, ${data.user.firstName}`);
      nav("/services");
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("login.user.fail")));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <Navbar />
      <div className="max-w-md mx-auto px-6 py-20">
        <p className="overline text-[#B8962E]">{t("login.user.overline")}</p>
        <h1 className="font-serif text-4xl mt-3 tracking-tight text-[#0F172A]">{t("login.user.title")}</h1>
        <p className="mt-3 text-slate-600">{t("login.user.subtitle")}</p>

        <form onSubmit={submit} className="mt-8 bg-white rounded-2xl border border-slate-200 p-8 space-y-5">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("login.user.phone")}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="login-phone"
              placeholder="+1 555 000 0000" required
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]"/>
          </div>
          <button type="submit" disabled={loading} className="btn-pill w-full" data-testid={AUTH.userLoginButton}>
            {loading ? t("login.user.signing") : t("login.user.submit")}
          </button>
          <p className="text-sm text-slate-500 text-center">
            {t("login.user.no")} <Link to="/register" className="text-[#0F172A] underline" data-testid={AUTH.goToRegister}>{t("login.user.register")}</Link>
          </p>
          <p className="text-xs text-slate-400 text-center">
            {t("login.user.staff")} <Link to="/admin/login" className="underline" data-testid={AUTH.goToAdminLogin}>{t("login.user.adminlink")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
