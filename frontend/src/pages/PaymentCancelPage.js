import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useT } from "@/i18n/I18nContext";
import { XCircle } from "lucide-react";

export default function PaymentCancelPage() {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <XCircle size={44} className="mx-auto text-rose-500"/>
        <h1 className="font-serif text-4xl mt-6 text-[#0F172A]">{t("pay.cancel.title")}</h1>
        <p className="text-slate-500 mt-3">{t("pay.cancel.sub")}</p>
        <Link to="/dashboard" className="btn-pill mt-8 inline-flex">{t("pay.cancel.cta")}</Link>
      </div>
    </div>
  );
}
