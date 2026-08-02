import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n/I18nContext";
import { formatMoney } from "@/context/CurrencyContext";
import { ReceiptText, Calendar, ArrowUpRight, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";

export default function UserDashboard() {
  const { t } = useT();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [receipts, setReceipts] = useState([]);

  useEffect(() => {
    api.get("/bookings").then((r) => setBookings(r.data));
    api.get("/receipts").then((r) => setReceipts(r.data));
  }, []);

  const welcomeUsed = bookings.some((b) => b.promo_code === user?.welcome_promo_code);

  const copyCode = async (code) => {
    await navigator.clipboard.writeText(code);
    toast.success(t("dash.welcome.copied"));
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-14">
        <p className="overline text-[#B8962E]">{t("dash.overline")}</p>
        <h1 className="font-serif text-4xl mt-3 tracking-tight text-[#0F172A]">{t("dash.hello", { name: user?.firstName })}</h1>

        {user?.welcome_promo_code && !welcomeUsed && (
          <div className="mt-8 rounded-2xl p-6 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}>
            <div className="absolute -right-6 -top-6 opacity-10">
              <Sparkles size={140} className="text-[#D4AF37]"/>
            </div>
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="overline text-[#D4AF37]">{t("dash.welcome.overline")}</p>
                <p className="font-serif text-2xl md:text-3xl text-white mt-2">{t("dash.welcome.title")}</p>
                <p className="text-sm text-slate-300 mt-2 max-w-md">{t("dash.welcome.subtitle")}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white/10 border border-[#D4AF37]/30 rounded-xl px-5 py-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#D4AF37]">{t("dash.welcome.code")}</p>
                  <p className="font-mono text-xl text-white mt-1 tracking-widest" data-testid="welcome-promo-code">{user.welcome_promo_code}</p>
                </div>
                <button onClick={() => copyCode(user.welcome_promo_code)} data-testid="welcome-promo-copy"
                  className="p-3 rounded-xl bg-[#D4AF37] text-[#0F172A] hover:bg-[#B8962E] transition-colors">
                  <Copy size={18}/>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl">{t("dash.bookings")}</h2>
              <Link to="/services" className="btn-outline-gold" style={{ padding: "0.4rem 0.9rem", fontSize: "0.75rem" }}>{t("dash.newbooking")}</Link>
            </div>
            <div className="mt-6 space-y-3">
              {bookings.length === 0 && <p className="text-slate-500 text-sm">{t("dash.nobookings")}</p>}
              {bookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-[#D4AF37] transition-colors duration-200">
                  <div>
                    <p className="font-medium text-slate-900">{b.service_name}</p>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <Calendar size={12}/> {b.event_date} · {t("dash.qty")} {b.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-lg">{formatMoney(b.total, b.currency || "USD")}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${b.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {b.paid ? t("dash.status.paid") : b.payment_method === "cash" ? t("dash.status.cash") : t("dash.status.pending")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-serif text-2xl">{t("dash.receipts")}</h2>
            <div className="mt-6 space-y-3">
              {receipts.length === 0 && <p className="text-slate-500 text-sm">{t("dash.noreceipts")}</p>}
              {receipts.map((r) => (
                <Link key={r.id} to={`/receipt/${r.id}`} data-testid={`receipt-link-${r.id}`}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-[#D4AF37] transition-colors duration-200 group">
                  <div className="flex items-center gap-3">
                    <ReceiptText size={18} className="text-[#D4AF37]"/>
                    <div>
                      <p className="font-medium text-sm">{r.number}</p>
                      <p className="text-xs text-slate-500">{r.service_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {r.status}
                    </span>
                    <ArrowUpRight size={16} className="text-slate-400 group-hover:text-[#D4AF37] transition-colors"/>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
