import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { useT } from "@/i18n/I18nContext";
import { formatMoney } from "@/context/CurrencyContext";
import { RECEIPT } from "@/constants/testIds";
import { Download, Share2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";

export default function ReceiptPage() {
  const { t } = useT();
  const { id } = useParams();
  const [r, setR] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const printRef = useRef(null);

  useEffect(() => {
    api.get(`/receipts/${id}`).then((res) => setR(res.data)).catch(() => toast.error(t("receipt.notfound")));
  }, [id, t]);

  useEffect(() => {
    if (!r) return;
    QRCode.toDataURL(window.location.href, {
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#0F172A", light: "#FFFFFF" },
      width: 180,
    }).then(setQrDataUrl).catch(() => {});
  }, [r]);

  const download = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, "PNG", 0, 0, w, h);
    pdf.save(`${r.number}.pdf`);
  };

  const share = async () => {
    const url = window.location.href;
    const shareData = { title: `Receipt ${r.number}`, text: `Maison Élégante — ${r.service_name}`, url };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User dismissed share sheet — not an error worth surfacing, but log for debugging
        // eslint-disable-next-line no-console
        console.debug("[receipt] share cancelled:", err?.name);
      }
    }
    else { await navigator.clipboard.writeText(url); toast.success(t("receipt.copied")); }
  };

  if (!r) return <div className="p-10 text-center text-slate-500">{t("receipt.loading")}</div>;

  const ccy = r.currency || "USD";
  const unitStr = formatMoney(r.unit_price, ccy);
  const subtotalStr = formatMoney(r.subtotal ?? r.total, ccy);
  const totalStr = formatMoney(r.total, ccy);
  const discountStr = r.discount_usd > 0 ? formatMoney(r.discount_usd, ccy) : null;

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/dashboard" className="text-sm text-slate-500 hover:text-[#0F172A] inline-flex items-center gap-1">
          <ArrowLeft size={14}/> {t("receipt.back")}
        </Link>

        <div className="mt-6 flex flex-wrap justify-between items-end gap-4">
          <div>
            <p className="overline text-[#B8962E]">{t("receipt.overline")}</p>
            <h1 className="font-serif text-4xl mt-2 tracking-tight text-[#0F172A]">{r.number}</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={download} className="btn-outline-gold" data-testid={RECEIPT.downloadPdf}>
              <Download size={14} className="mr-2"/> {t("receipt.pdf")}
            </button>
            <button onClick={share} className="btn-pill" data-testid={RECEIPT.share}
              style={{ padding: "0.5rem 1.2rem", fontSize: "0.85rem" }}>
              <Share2 size={14} className="mr-2"/> {t("receipt.share")}
            </button>
          </div>
        </div>

        <div ref={printRef} className="mt-8 bg-white rounded-2xl border border-slate-200 p-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-3xl">Maison<span className="text-[#D4AF37]">·</span>Élégante</p>
              <p className="overline text-slate-500 mt-2">{t("receipt.digital")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("receipt.status")}</p>
              <p className={`font-serif text-xl mt-1 ${r.status === "paid" ? "text-emerald-700" : "text-amber-700"}`}>
                {r.status.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
            <Info label={t("receipt.number")} value={r.number}/>
            <Info label={t("receipt.issued")} value={new Date(r.created_at).toLocaleString()}/>
            <Info label={t("receipt.client")} value={r.user_name}/>
            <Info label={t("receipt.clientphone")} value={r.user_phone}/>
            <Info label={t("receipt.eventdate")} value={r.event_date}/>
            <Info label={t("receipt.payment")} value={r.payment_method}/>
          </div>

          <table className="mt-10 w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr className="text-left text-xs uppercase tracking-[0.15em] text-slate-500">
                <th className="py-3">{t("receipt.desc")}</th>
                <th className="py-3 text-right">{t("receipt.unit")}</th>
                <th className="py-3 text-right">{t("receipt.qty")}</th>
                <th className="py-3 text-right">{t("receipt.total")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-4">
                  <p className="font-medium">{r.service_name}</p>
                  <p className="text-xs text-slate-500 mt-1">{r.service_category}</p>
                </td>
                <td className="py-4 text-right">{unitStr}</td>
                <td className="py-4 text-right">{r.quantity}</td>
                <td className="py-4 text-right font-medium">{subtotalStr}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-6 flex justify-between items-end gap-6">
            {qrDataUrl ? (
              <div className="text-center">
                <img src={qrDataUrl} alt="Receipt QR" className="w-28 h-28 border border-slate-200 rounded-lg p-2 bg-white"/>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mt-2">{t("receipt.verify")}</p>
              </div>
            ) : <div/>}
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t("receipt.subtotal")}</span>
                <span>{subtotalStr}</span>
              </div>
              {discountStr && (
                <div className="flex justify-between text-emerald-700">
                  <span>{t("receipt.discount")}{r.promo_code ? ` · ${r.promo_code}` : ""}</span>
                  <span>− {discountStr}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-3 flex justify-between">
                <span className="font-serif text-lg">{t("receipt.total")}</span>
                <span className="font-serif text-xl">{totalStr} {ccy}</span>
              </div>
            </div>
          </div>

          <p className="mt-14 text-center text-xs text-slate-400 border-t border-slate-100 pt-6">
            {t("receipt.thanks")}
          </p>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 text-slate-900">{value}</p>
    </div>
  );
}
