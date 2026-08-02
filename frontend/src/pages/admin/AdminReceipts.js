import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useT } from "@/i18n/I18nContext";
import { ExternalLink } from "lucide-react";

export default function AdminReceipts() {
  const { t } = useT();
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/admin/receipts").then((r) => setItems(r.data)); }, []);

  return (
    <div>
      <p className="overline text-[#D4AF37]">{t("admin.receipts.overline")}</p>
      <h1 className="font-serif text-4xl mt-2 tracking-tight">{t("admin.receipts.title")}</h1>

      <div className="mt-8 bg-[#111827] border border-white/5 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.15em] text-slate-500 border-b border-white/5">
              <th className="p-4">{t("admin.receipts.number")}</th>
              <th className="p-4">{t("admin.bookings.client")}</th>
              <th className="p-4">{t("admin.bookings.service")}</th>
              <th className="p-4">{t("admin.bookings.amount")}</th>
              <th className="p-4">{t("admin.bookings.status")}</th>
              <th className="p-4">{t("admin.receipts.date")}</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="p-4 font-mono text-xs">{r.number}</td>
                <td className="p-4">{r.user_name}</td>
                <td className="p-4 text-slate-400">{r.service_name}</td>
                <td className="p-4 font-serif text-lg">${r.total.toFixed(2)}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "paid" ? "bg-emerald-900/40 text-emerald-400" : "bg-amber-900/40 text-amber-400"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="p-4 text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="p-4">
                  <Link to={`/receipt/${r.id}`} className="text-[#D4AF37] hover:underline inline-flex items-center gap-1">
                    {t("admin.receipts.view")} <ExternalLink size={12}/>
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan="7" className="p-8 text-center text-slate-500">{t("admin.receipts.none")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
