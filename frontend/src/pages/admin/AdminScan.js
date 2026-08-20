import { useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { useT } from "@/i18n/I18nContext";
import { SCAN } from "@/constants/testIds";
import { UploadCloud, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminScan() {
  const { t } = useT();
  const [preview, setPreview] = useState(null);
  const [b64, setB64] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error(t("admin.scan.badformat")); return;
    }
    const reader = new FileReader();
    reader.onload = () => { setPreview(reader.result); setB64(reader.result); };
    reader.readAsDataURL(file);
  };

  const extract = async () => {
    if (!b64) return;
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post("/receipts/scan", { image_base64: b64 });
      setResult(data.raw_data);
      toast.success(t("admin.scan.success"));
    } catch (err) { toast.error(getApiErrorMessage(err, t("admin.scan.fail"))); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <p className="overline text-[#D4AF37]">{t("admin.scan.overline")}</p>
      <h1 className="font-serif text-4xl mt-2 tracking-tight">{t("admin.scan.title")}</h1>
      <p className="text-slate-400 mt-3 max-w-xl">{t("admin.scan.subtitle")}</p>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <label
          data-testid={SCAN.dropzone}
          htmlFor="scan-file"
          className="flex flex-col items-center justify-center bg-[#111827] border border-dashed border-white/10 hover:border-[#D4AF37] rounded-2xl p-10 min-h-[340px] cursor-pointer transition-colors duration-200"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}>
          {preview ? (
            <img src={preview} alt="preview" className="max-h-72 rounded-lg" />
          ) : (
            <>
              <UploadCloud size={36} className="text-[#D4AF37]" />
              <p className="mt-4 text-slate-300">{t("admin.scan.drop")}</p>
              <p className="text-xs text-slate-500 mt-1">{t("admin.scan.formats")}</p>
            </>
          )}
          <input id="scan-file" type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            data-testid={SCAN.fileInput}
            onChange={(e) => handleFile(e.target.files[0])} />
        </label>

        <div className="bg-[#111827] border border-white/5 rounded-2xl p-6 min-h-[340px]">
          <div className="flex items-center justify-between">
            <p className="overline text-slate-400">{t("admin.scan.extracted")}</p>
            <button onClick={extract} disabled={!b64 || loading} data-testid={SCAN.extractBtn}
              className="inline-flex items-center gap-2 bg-[#D4AF37] text-[#0F172A] px-4 py-2 rounded-full text-sm font-medium disabled:opacity-40 hover:bg-[#B8962E] transition-colors">
              {loading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
              {loading ? t("admin.scan.extracting") : t("admin.scan.extract")}
            </button>
          </div>

          {!result && !loading && <p className="text-slate-500 text-sm mt-6">{t("admin.scan.empty")}</p>}

          {result && (
            <div className="mt-6 space-y-3 text-sm" data-testid={SCAN.result}>
              <Row label={t("admin.scan.merchant")} value={result.merchant}/>
              <Row label={t("admin.scan.date")} value={result.date}/>
              <Row label={t("admin.scan.currency")} value={result.currency}/>
              <Row label={t("admin.scan.subtotal")} value={result.subtotal}/>
              <Row label={t("admin.scan.tax")} value={result.tax}/>
              <Row label={t("admin.scan.total")} value={result.total}/>
              {Array.isArray(result.items) && result.items.length > 0 && (
                <div className="pt-4">
                  <p className="overline text-slate-400">{t("admin.scan.items")}</p>
                  <ul className="mt-2 space-y-1">
                    {result.items.map((it, i) => (
                      <li key={`${it.name}-${it.price}-${i}`} className="flex justify-between text-slate-300">
                        <span>{it.name} × {it.qty}</span><span>{it.price}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-white/5 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value ?? "—"}</span>
    </div>
  );
}
