import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { NAV, AUTH } from "@/constants/testIds";
import { LogOut, User } from "lucide-react";

export default function Navbar({ variant = "light" }) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const nav = useNavigate();
  const dark = variant === "dark";

  const linkCls = dark
    ? "text-sm text-slate-300 hover:text-[#D4AF37] transition-colors duration-200"
    : "text-sm text-slate-700 hover:text-[#0F172A] transition-colors duration-200";

  return (
    <header className={`glass-header sticky top-0 z-40 ${dark ? "dashboard-scope" : ""}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link to="/" data-testid={NAV.brand} className="flex items-center gap-2">
          <span className="font-serif text-2xl tracking-tight" style={{ color: dark ? "#F8FAFC" : "#0F172A" }}>
            Élégante<span className="text-[#D4AF37]">·</span>Suprise
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link to="/services" data-testid={NAV.services} className={linkCls}>{t("nav.services")}</Link>
          {user && (
            <Link to="/dashboard" data-testid={NAV.bookings} className={linkCls}>{t("nav.bookings")}</Link>
          )}
          {user && (user.role === "admin" || user.role === "super_admin") && (
            <Link to="/admin" data-testid={NAV.admin} className={linkCls}>{t("nav.admin")}</Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <CurrencySwitcher dark={dark} />
          <LanguageSwitcher dark={dark} />
          {!user ? (
            <>
              <Link to="/login" data-testid={AUTH.goToUserLogin} className={linkCls}>{t("nav.signin")}</Link>
              <Link to="/register" className="btn-pill" style={{ padding: "0.5rem 1.2rem", fontSize: "0.85rem" }}>
                {t("nav.getstarted")}
              </Link>
            </>
          ) : (
            <>
              <span className={`hidden sm:flex items-center gap-2 text-sm ${dark ? "text-slate-300" : "text-slate-700"}`}>
                <User size={16} /> {user.firstName}
              </span>
              <button
                data-testid={NAV.logout}
                onClick={() => { logout(); nav("/"); }}
                className="btn-outline-gold"
                style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>
                <LogOut size={14} className="mr-2"/> {t("nav.signout")}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
