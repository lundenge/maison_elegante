import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useT } from "@/i18n/I18nContext";
import { toast } from "sonner";
import { Plus, Trash2, TicketPercent, TrendingUp } from "lucide-react";

const EMPTY = { code: "", percent_off: "", amount_off_usd: "", max_uses: "", expires_at: "", active: true };

export default function AdminPromos() {
  const { t } = useT();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [mode, setMode] = useState("percent");

  const load = useCallback(() => api.get("/admin/promo-codes").then((r) => setItems(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    const body = {
      code: form.code.trim().toUpperCase(),
      percent_off: mode === "percent" && form.percent_off ? parseFloat(form.percent_off) : null,
      amount_off_usd: mode === "amount" && form.amount_off_usd ? parseFloat(form.amount_off_usd) : null,
      max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      active: true,
    };
    try {
      await api.post("/admin/promo-codes", body);
      toast.success(t("admin.promo.created"));
      setForm(EMPTY); setOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const remove = async (id) => {
    if (!window.confirm(t("admin.promo.confirm"))) return;
    await api.delete(`/admin/promo-codes/${id}`); load();
    toast.success(t("admin.promo.deleted"));
  };

  const totalRevenue = items.reduce((a, p) => a + (p.revenue_usd || 0), 0);
  const totalDiscount = items.reduce((a, p) => a + (p.discount_usd_total || 0), 0);
  const totalRedeems = items.reduce((a, p) => a + (p.paid_bookings || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="overline text-[#D4AF37]">{t("admin.promo.overline")}</p>
          <h1 className="font-serif text-4xl mt-2 tracking-tight">{t("admin.promo.title")}</h1>
        </div>
        <button onClick={() => setOpen(!open)} data-testid="admin-new-promo"
          className="inline-flex items-center gap-2 bg-[#D4AF37] text-[#0F172A] px-4 py-2 rounded-full text-sm font-medium hover:bg-[#B8962E] transition-colors">
          <Plus size={14}/> {t("admin.promo.new")}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatRow icon={<TrendingUp size={14}/>} label={t("admin.promo.stats.redeems")} value={totalRedeems}/>
        <StatRow icon={<TicketPercent size={14}/>} label={t("admin.promo.stats.discount")} value={`$${totalDiscount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}/>
        <StatRow icon={<TrendingUp size={14}/>} label={t("admin.promo.stats.revenue")} value={`$${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}/>
      </div>

      {open && (
        <form onSubmit={create} className="mt-6 bg-[#111827] border border-white/5 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input required placeholder={t("admin.promo.code")} value={form.code} onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})}
            className="dark-input uppercase tracking-wider" data-testid="promo-code"/>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("percent")} data-testid="promo-mode-percent"
              className={`flex-1 rounded-lg px-3 py-2 text-xs uppercase tracking-[0.15em] border ${mode === "percent" ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10" : "border-white/10 text-slate-400"}`}>
              % {t("admin.promo.percent")}
            </button>
            <button type="button" onClick={() => setMode("amount")} data-testid="promo-mode-amount"
              className={`flex-1 rounded-lg px-3 py-2 text-xs uppercase tracking-[0.15em] border ${mode === "amount" ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10" : "border-white/10 text-slate-400"}`}>
              $ {t("admin.promo.flat")}
            </button>
          </div>
          {mode === "percent" ? (
            <input required type="number" min="1" max="100" step="1" placeholder="10"
              value={form.percent_off} onChange={(e) => setForm({...form, percent_off: e.target.value})}
              className="dark-input md:col-span-2" data-testid="promo-percent"/>
          ) : (
            <input required type="number" min="0" step="0.01" placeholder="25.00"
              value={form.amount_off_usd} onChange={(e) => setForm({...form, amount_off_usd: e.target.value})}
              className="dark-input md:col-span-2" data-testid="promo-amount"/>
          )}
          <input type="number" min="1" step="1" placeholder={t("admin.promo.maxuses")}
            value={form.max_uses} onChange={(e) => setForm({...form, max_uses: e.target.value})}
            className="dark-input" data-testid="promo-maxuses"/>
          <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({...form, expires_at: e.target.value})}
            className="dark-input" data-testid="promo-expires"/>
          <button className="btn-pill md:col-span-2" data-testid="promo-submit">{t("admin.promo.create")}</button>
        </form>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.length === 0 && <p className="text-slate-500 text-sm">{t("admin.promo.none")}</p>}
        {items.map((p) => {
          const expired = p.expires_at && new Date(p.expires_at) < new Date();
          const maxed = p.max_uses !== null && p.uses >= p.max_uses;
          const disabled = expired || maxed || !p.active;
          const isWelcome = p.code?.startsWith("WELCOME-");
          return (
            <div key={p.id} className={`bg-[#111827] border rounded-2xl p-6 ${disabled ? "border-white/5 opacity-60" : "border-[#D4AF37]/20"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#D4AF37]">
                  <TicketPercent size={16}/>
                  <span className="font-mono tracking-widest text-sm">{p.code}</span>
                </div>
                <button onClick={() => remove(p.id)} data-testid={`promo-delete-${p.id}`} className="text-rose-400 hover:text-rose-300"><Trash2 size={14}/></button>
              </div>
              {isWelcome && <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-emerald-400">{t("admin.promo.welcome")}</p>}
              <p className="font-serif text-3xl mt-4">
                {p.percent_off ? `${p.percent_off}%` : `$${p.amount_off_usd?.toFixed(2)}`}
                <span className="text-xs uppercase tracking-[0.15em] text-slate-500 ml-2">{t("booking.promo.off")}</span>
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                <Metric label={t("admin.promo.stats.redeems")} value={p.paid_bookings ?? 0}/>
                <Metric label={t("admin.promo.stats.revenue")} value={`$${(p.revenue_usd ?? 0).toFixed(0)}`}/>
              </div>
              <div className="mt-4 space-y-1 text-xs text-slate-400">
                <p>{t("admin.promo.uses")}: <span className="text-slate-200">{p.uses ?? 0}{p.max_uses !== null ? ` / ${p.max_uses}` : ""}</span></p>
                {p.expires_at && <p>{t("admin.promo.expires")}: <span className="text-slate-200">{new Date(p.expires_at).toLocaleDateString()}</span></p>}
                {disabled && <p className="text-rose-400 uppercase tracking-[0.15em] mt-2">{expired ? t("admin.promo.expired") : maxed ? t("admin.promo.maxed") : t("admin.promo.inactive")}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`.dark-input { background: #0B0F19; border: 1px solid #1E293B; border-radius: 0.5rem; padding: 0.7rem 1rem; color: #F8FAFC; font-size: 0.85rem; outline: none; transition: border-color 200ms ease; } .dark-input:focus { border-color: #D4AF37; }`}</style>
    </div>
  );
}

function StatRow({ icon, label, value }) {
  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-[#D4AF37]">{icon}<span className="overline text-slate-400">{label}</span></div>
      <p className="font-serif text-3xl mt-3">{value}</p>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="font-serif text-lg mt-1 text-slate-100">{value}</p>
    </div>
  );
}
