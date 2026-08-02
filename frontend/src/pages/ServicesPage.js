import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { useT } from "@/i18n/I18nContext";
import { useCurrency } from "@/context/CurrencyContext";
import { SERVICES } from "@/constants/testIds";
import { ArrowUpRight } from "lucide-react";

export default function ServicesPage() {
  const { t } = useT();
  const { format } = useCurrency();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => { api.get("/services").then((r) => setItems(r.data)); }, []);

  const filtered = filter === "all" ? items : items.filter((i) => i.category === filter);

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <p className="overline text-[#B8962E]">{t("services.overline")}</p>
        <h1 className="font-serif text-4xl md:text-5xl mt-3 tracking-tight text-[#0F172A]">{t("services.title")}</h1>

        <div className="mt-8 flex flex-wrap gap-2">
          {["all", "rental", "party", "catering", "gift", "custom"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              data-testid={`filter-${f}`}
              className={`px-4 py-2 rounded-full text-xs uppercase tracking-[0.15em] border transition-all duration-200 ${
                filter === f
                  ? "bg-[#0F172A] text-white border-[#0F172A]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-[#D4AF37]"
              }`}>
              {f === "all" ? t("services.filter.all") : t(`cat.${f}`)}
            </button>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((s, i) => (
            <div key={s.id} data-testid={SERVICES.card(s.id)}
              className={`svc-card bg-white rounded-2xl overflow-hidden border border-slate-100 fade-up fade-up-delay-${(i % 4) + 1}`}>
              {s.image_url && (
                <div className="h-56 overflow-hidden">
                  <img src={s.image_url} alt={s.name} className="w-full h-full object-cover"/>
                </div>
              )}
              <div className="p-6">
                <p className="overline text-slate-500">{t(`cat.${s.category}`) || s.category}</p>
                <h3 className="font-serif text-2xl mt-2 tracking-tight">{s.name}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mt-3">{s.description}</p>
                <div className="mt-6 flex items-center justify-between">
                  <p className="font-serif text-2xl text-[#0F172A]">{format(s.price)}</p>
                  <Link to={`/book/${s.id}`} data-testid={SERVICES.bookBtn(s.id)}
                    className="btn-pill" style={{ padding: "0.6rem 1.3rem", fontSize: "0.85rem" }}>
                    {t("services.book")} <ArrowUpRight size={14} className="ml-1.5"/>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
