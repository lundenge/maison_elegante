import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n/I18nContext";
import { AUTH } from "@/constants/testIds";
import { toast } from "sonner";

const CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania", "Antarctica"];

export default function RegisterPage() {
  const { t } = useT();
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    firstName: "", lastName: "", phone: "", email: "",
    address: "", city: "", country: "", continent: "Africa",
  });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      login(data.token, data.user);
      toast.success(t("register.success"));
      nav("/services");
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("register.fail")));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <p className="overline text-[#B8962E]">{t("register.overline")}</p>
        <h1 className="font-serif text-4xl md:text-5xl mt-3 tracking-tight text-[#0F172A]">{t("register.title")}</h1>
        <p className="mt-3 text-slate-600 max-w-lg">{t("register.subtitle")}</p>

        <form onSubmit={submit} className="mt-10 bg-white rounded-2xl border border-slate-200 p-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label={t("register.first")} value={form.firstName} onChange={set("firstName")} testId="reg-first" required />
          <Field label={t("register.last")} value={form.lastName} onChange={set("lastName")} testId="reg-last" required />
          <Field label={t("register.phone")} value={form.phone} onChange={set("phone")} testId="reg-phone" required placeholder="+1 555 000 0000" />
          <Field label={t("register.email")} value={form.email} onChange={set("email")} testId="reg-email" type="email" />
          <Field className="md:col-span-2" label={t("register.address")} value={form.address} onChange={set("address")} testId="reg-address" required />
          <Field label={t("register.city")} value={form.city} onChange={set("city")} testId="reg-city" required />
          <Field label={t("register.country")} value={form.country} onChange={set("country")} testId="reg-country" required />
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("register.continent")}</label>
            <select value={form.continent} onChange={set("continent")} data-testid="reg-continent"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]">
              {CONTINENTS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-pill md:col-span-2 mt-4" data-testid={AUTH.registerButton}>
            {loading ? t("register.creating") : t("register.submit")}
          </button>
          <p className="md:col-span-2 text-sm text-slate-500 text-center">
            {t("register.have")} <Link to="/login" className="text-[#0F172A] underline">{t("register.signin")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, testId, className = "", required, type = "text", placeholder }) {
  return (
    <div className={className}>
      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</label>
      <input type={type} value={value} onChange={onChange} required={required} placeholder={placeholder} data-testid={testId}
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]"/>
    </div>
  );
}
