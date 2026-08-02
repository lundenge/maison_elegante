import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { useT } from "@/i18n/I18nContext";
import { CheckCircle2, Loader2 } from "lucide-react";

const POLL_INTERVAL = 2000;
const MAX_ATTEMPTS = 15;

export default function PaymentSuccessPage() {
  const { t } = useT();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    if (!sessionId) return;
    let attempts = 0;
    const check = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") { setStatus("paid"); return; }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[payment-success] poll failed:", err?.response?.status || err?.message);
      }
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) { setStatus("timeout"); return; }
      setTimeout(check, POLL_INTERVAL);
    };
    check();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        {status === "checking" && (
          <>
            <Loader2 size={40} className="mx-auto text-[#D4AF37] animate-spin"/>
            <h1 className="font-serif text-3xl mt-6">{t("pay.checking")}</h1>
            <p className="text-slate-500 mt-3">{t("pay.checking.sub")}</p>
          </>
        )}
        {status === "paid" && (
          <>
            <CheckCircle2 size={48} className="mx-auto text-emerald-600"/>
            <h1 className="font-serif text-4xl mt-6 text-[#0F172A]">{t("pay.paid.title")}</h1>
            <p className="text-slate-600 mt-3">{t("pay.paid.sub")}</p>
            <Link to="/dashboard" className="btn-pill mt-8 inline-flex" data-testid="success-go-dashboard">{t("pay.paid.cta")}</Link>
          </>
        )}
        {status === "timeout" && (
          <>
            <h1 className="font-serif text-3xl mt-6">{t("pay.timeout.title")}</h1>
            <p className="text-slate-500 mt-3">{t("pay.timeout.sub")}</p>
            <Link to="/dashboard" className="btn-pill mt-8 inline-flex">{t("pay.timeout.cta")}</Link>
          </>
        )}
      </div>
    </div>
  );
}
