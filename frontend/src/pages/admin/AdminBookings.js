import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useT } from "@/i18n/I18nContext";
import { ADMIN } from "@/constants/testIds";
import { toast } from "sonner";

export default function AdminBookings() {
  const { t } = useT();
  const [items, setItems] = useState([]);
  const load = useCallback(() => api.get("/admin/bookings").then((r) => setItems(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const markPaid = async (id) => {
    try {
      await api.put(`/admin/bookings/${id}/mark-paid`);
      toast.success(t("admin.bookings.marked"));
      load();
    } catch { toast.error("Failed"); }
  };

  return (
    <div>
      <p className="overline text-[#D4AF37]">{t("admin.bookings.overline")}</p>
      <h1 className="font-serif text-4xl mt-2 tracking-tight">{t("admin.bookings.title")}</h1>

      <div className="mt-8 bg-[#111827] border border-white/5 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.15em] text-slate-500 border-b border-white/5">
              <th className="p-4">{t("admin.bookings.client")}</th>
              <th className="p-4">{t("admin.bookings.service")}</th>
              <th className="p-4">{t("admin.bookings.event")}</th>
              <th className="p-4">{t("admin.bookings.amount")}</th>
              <th className="p-4">{t("admin.bookings.method")}</th>
              <th className="p-4">{t("admin.bookings.status")}</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="p-4">
                  <p className="text-slate-100">{b.user_name}</p>
                  <p className="text-xs text-slate-500">{b.user_phone}</p>
                </td>
                <td className="p-4">{b.service_name}</td>
                <td className="p-4 text-slate-400">{b.event_date}</td>
                <td className="p-4 font-serif text-lg">${b.total.toFixed(2)}</td>
                <td className="p-4 uppercase text-xs text-slate-400 tracking-[0.15em]">{b.payment_method}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.paid ? "bg-emerald-900/40 text-emerald-400" : "bg-amber-900/40 text-amber-400"}`}>
                    {b.paid ? "paid" : b.status}
                  </span>
                </td>
                <td className="p-4">
                  {!b.paid && b.payment_method === "cash" && (
                    <button data-testid={ADMIN.markPaid(b.id)} onClick={() => markPaid(b.id)}
                      className="text-xs text-[#D4AF37] hover:underline">
                      {t("admin.bookings.markpaid")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan="7" className="p-8 text-center text-slate-500">{t("admin.bookings.none")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
