import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { NAV } from "@/constants/testIds";
import { LayoutDashboard, ClipboardList, Users, Scan, ReceiptText, Sparkles, TicketPercent, LogOut } from "lucide-react";

export default function AdminLayout() {
  const { t } = useT();
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const LINKS = [
    { to: "/admin", end: true, label: t("admin.nav.overview"), icon: LayoutDashboard, testId: NAV.analytics },
    { to: "/admin/bookings", label: t("admin.nav.bookings"), icon: ClipboardList, testId: NAV.bookingsAdmin },
    { to: "/admin/receipts", label: t("admin.nav.receipts"), icon: ReceiptText, testId: NAV.receipts },
    { to: "/admin/services", label: t("admin.nav.services"), icon: Sparkles, testId: "nav-admin-services" },
    { to: "/admin/promos", label: t("admin.nav.promos"), icon: TicketPercent, testId: "nav-admin-promos" },
    { to: "/admin/scan", label: t("admin.nav.scan"), icon: Scan, testId: NAV.scan },
    { to: "/admin/users", label: t("admin.nav.people"), icon: Users, testId: NAV.users },
  ];

  return (
    <div className="dashboard-scope min-h-screen flex">
      <aside className="w-64 border-r border-white/10 py-8 px-5 sticky top-0 h-screen hidden md:flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-serif text-xl tracking-tight">Élégante<span className="text-[#D4AF37]">·</span>Suprise</p>
            <p className="overline text-slate-500 mt-1">{t("admin.console")}</p>
          </div>
          <LanguageSwitcher dark />
        </div>
        <nav className="mt-10 flex-1 space-y-1">
          {LINKS.map(({ to, end, label, icon: Icon, testId }) => (
            <NavLink key={to} to={to} end={end} data-testid={testId}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 ${
                  isActive ? "bg-[#1E293B] text-[#D4AF37]" : "text-slate-400 hover:text-slate-100 hover:bg-[#111827]"
                }`
              }>
              <Icon size={16}/> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 pt-5">
          <p className="text-xs text-slate-400">{user?.firstName} {user?.lastName}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] mt-1">{user?.role.replace("_", " ")}</p>
          <button data-testid={NAV.logout} onClick={() => { logout(); nav("/"); }}
            className="mt-4 w-full inline-flex items-center gap-2 text-xs text-slate-400 hover:text-rose-400 transition-colors">
            <LogOut size={14}/> {t("nav.signout")}
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 md:p-12 max-w-full overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}
