import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { useT } from "@/i18n/I18nContext";
import { useCurrency } from "@/context/CurrencyContext";
import { BOOKING } from "@/constants/testIds";
import { toast } from "sonner";
import { CalendarDays, CreditCard, Wallet, Tag, Check, X } from "lucide-react";

export default function BookingPage() {
  const { t, lang } = useT();
  const { currency, format } = useCurrency();
  const { serviceId } = useParams();
  const nav = useNavigate();
  const [service, setService] = useState(null);
  const [form, setForm] = useState({ quantity: 1, event_date: "", notes: "", payment_method: "stripe" });
  const [submitting, setSubmitting] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState(null); // {code, percent_off, amount_off_usd}
  const [promoChecking, setPromoChecking] = useState(false);

  useEffect(() => {
    api.get("/services").then((r) => setService(r.data.find((x) => x.id === serviceId)));
  }, [serviceId]);

  if (!service) return <div className="p-10 text-center text-slate-500">{t("booking.loading")}</div>;

  const subtotalUsd = service.price * (form.quantity || 1);
  let discountUsd = 0;
  if (promo?.percent_off) discountUsd = subtotalUsd * (promo.percent_off / 100);
  else if (promo?.amount_off_usd) discountUsd = Math.min(promo.amount_off_usd, subtotalUsd);
  const totalUsd = Math.max(0, subtotalUsd - discountUsd);
  const totalDisplay = format(totalUsd);

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoChecking(true);
    try {
      const { data } = await api.post("/promo-codes/validate", { code: promoInput.trim().toUpperCase() });
      setPromo(data);
      toast.success(t("booking.promo.applied", { code: data.code }));
    } catch (err) {
      setPromo(null);
      toast.error(err?.response?.data?.detail || t("booking.promo.invalid"));
    } finally { setPromoChecking(false); }
  };

  const clearPromo = () => { setPromo(null); setPromoInput(""); };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: booking } = await api.post("/bookings", {
        service_id: service.id,
        quantity: parseInt(form.quantity, 10) || 1,
        event_date: form.event_date,
        notes: form.notes,
        payment_method: form.payment_method,
        currency,
        language: lang,
        promo_code: promo?.code || null,
      });

      if (form.payment_method === "stripe") {
        const { data: co } = await api.post("/payments/checkout", {
          booking_id: booking.id,
          origin_url: window.location.origin,
        });
        window.location.href = co.checkout_url;
      } else {
        toast.success(t("booking.cash.success"));
        nav(`/receipt/${booking.receipt_id}`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("booking.fail"));
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-5 gap-10">
        <div className="md:col-span-3">
          <p className="overline text-[#B8962E]">{t("booking.overline")}</p>
          <h1 className="font-serif text-4xl mt-3 tracking-tight text-[#0F172A]">{service.name}</h1>
          <p className="text-slate-600 mt-3 leading-relaxed">{service.description}</p>

          <form onSubmit={submit} className="mt-10 bg-white rounded-2xl border border-slate-200 p-8 space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("booking.quantity")}</label>
                <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({...form, quantity: e.target.value})} data-testid={BOOKING.quantity}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]"/>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("booking.eventdate")}</label>
                <div className="mt-2 relative">
                  <input type="date" required value={form.event_date} onChange={(e) => setForm({...form, event_date: e.target.value})} data-testid={BOOKING.eventDate}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]"/>
                  <CalendarDays size={16} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none"/>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("booking.notes")}</label>
              <textarea rows="3" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} data-testid={BOOKING.notes}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]"/>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5"><Tag size={12}/> {t("booking.promo.label")}</label>
              {promo ? (
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <Check size={16} className="text-emerald-700"/>
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-emerald-800">{promo.code}</p>
                    <p className="text-xs text-emerald-700">
                      {promo.percent_off ? `${promo.percent_off}% ${t("booking.promo.off")}` : `$${promo.amount_off_usd?.toFixed(2)} ${t("booking.promo.off")}`}
                    </p>
                  </div>
                  <button type="button" onClick={clearPromo} data-testid="booking-promo-clear" className="text-slate-400 hover:text-rose-500"><X size={16}/></button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder="AUTUMN10" data-testid={BOOKING.promoInput}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37] uppercase tracking-wider"/>
                  <button type="button" onClick={applyPromo} disabled={!promoInput.trim() || promoChecking} data-testid={BOOKING.promoApply}
                    className="btn-outline-gold" style={{ padding: "0.7rem 1.2rem", fontSize: "0.8rem" }}>
                    {promoChecking ? "…" : t("booking.promo.apply")}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("booking.payment")}</label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <PayOption active={form.payment_method === "stripe"} onClick={() => setForm({ ...form, payment_method: "stripe" })}
                  icon={<CreditCard size={18} />} title={t("booking.pay.online")} sub={t("booking.pay.online.sub")} testId={BOOKING.payStripe}/>
                <PayOption active={form.payment_method === "cash"} onClick={() => setForm({ ...form, payment_method: "cash" })}
                  icon={<Wallet size={18} />} title={t("booking.pay.office")} sub={t("booking.pay.office.sub")} testId={BOOKING.payCash}/>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-pill w-full mt-6" data-testid={BOOKING.confirm}>
              {submitting ? t("booking.processing")
                : form.payment_method === "stripe" ? t("booking.pay.securely", { amount: totalDisplay })
                : t("booking.confirm", { amount: totalDisplay })}
            </button>
          </form>
        </div>

        <div className="md:col-span-2">
          <div className="sticky top-24 bg-white rounded-2xl border border-slate-200 p-6">
            {service.image_url && <img src={service.image_url} alt={service.name} className="rounded-xl w-full h-40 object-cover"/>}
            <p className="overline text-slate-500 mt-5">{t("booking.summary")}</p>
            <div className="mt-4 space-y-3 text-sm">
              <Row label={t("booking.service")} value={service.name} />
              <Row label={t("booking.unit")} value={format(service.price)} />
              <Row label={t("booking.quantity")} value={form.quantity} />
              {promo && discountUsd > 0 && (
                <Row label={`${t("booking.promo.discount")} · ${promo.code}`} value={`− ${format(discountUsd)}`} valueClass="text-emerald-700" />
              )}
              <div className="border-t border-slate-200 pt-3 flex justify-between">
                <span className="text-slate-500">{t("booking.total")}</span>
                <span className="font-serif text-2xl text-[#0F172A]">{totalDisplay}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = "text-slate-900" }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><span className={valueClass}>{value}</span></div>;
}

function PayOption({ active, onClick, icon, title, sub, testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      className={`text-left rounded-xl border p-4 transition-all duration-200 ${
        active ? "border-[#D4AF37] bg-[#FDFBF7] ring-2 ring-[#D4AF37]/20" : "border-slate-200 bg-white hover:border-slate-300"
      }`}>
      <div className="flex items-center gap-2 text-[#0F172A]">{icon}<span className="text-sm font-medium">{title}</span></div>
      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{sub}</p>
    </button>
  );
}
