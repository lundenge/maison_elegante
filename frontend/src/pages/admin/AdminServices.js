import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useT } from "@/i18n/I18nContext";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const EMPTY = { name: "", category: "custom", description: "", price: 0, image_url: "" };

export default function AdminServices() {
  const { t } = useT();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(() => api.get("/services").then((r) => setItems(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/services", { ...form, price: parseFloat(form.price) });
      toast.success(t("admin.services.added"));
      setForm(EMPTY); setOpen(false); load();
    } catch { toast.error("Failed"); }
  };

  const remove = async (id) => {
    if (!window.confirm(t("admin.services.confirm"))) return;
    await api.delete(`/services/${id}`); load();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="overline text-[#D4AF37]">{t("admin.services.overline")}</p>
          <h1 className="font-serif text-4xl mt-2 tracking-tight">{t("admin.services.title")}</h1>
        </div>
        <button onClick={() => setOpen(!open)} data-testid="admin-new-service"
          className="inline-flex items-center gap-2 bg-[#D4AF37] text-[#0F172A] px-4 py-2 rounded-full text-sm font-medium hover:bg-[#B8962E] transition-colors">
          <Plus size={14}/> {t("admin.services.new")}
        </button>
      </div>

      {open && (
        <form onSubmit={create} className="mt-6 bg-[#111827] border border-white/5 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input required placeholder={t("admin.services.name")} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="dark-input" data-testid="svc-name"/>
          <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="dark-input" data-testid="svc-category">
            <option value="rental">{t("cat.rental")}</option>
            <option value="party">{t("cat.party")}</option>
            <option value="catering">{t("cat.catering")}</option>
            <option value="gift">{t("cat.gift")}</option>
            <option value="custom">{t("cat.custom")}</option>
          </select>
          <textarea required placeholder={t("admin.services.desc")} rows="3" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="dark-input md:col-span-2" data-testid="svc-desc"/>
          <input required type="number" step="0.01" placeholder={t("admin.services.price")} value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} className="dark-input" data-testid="svc-price"/>
          <input placeholder={t("admin.services.image")} value={form.image_url} onChange={(e) => setForm({...form, image_url: e.target.value})} className="dark-input" data-testid="svc-image"/>
          <button className="btn-pill md:col-span-2" data-testid="svc-submit">{t("admin.services.add")}</button>
        </form>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((s) => (
          <div key={s.id} className="bg-[#111827] border border-white/5 rounded-2xl overflow-hidden">
            {s.image_url && <img src={s.image_url} alt={s.name} className="w-full h-40 object-cover"/>}
            <div className="p-5">
              <p className="overline text-slate-500">{t(`cat.${s.category}`) || s.category}</p>
              <p className="font-serif text-lg mt-2">{s.name}</p>
              <p className="text-xs text-slate-400 mt-2 line-clamp-2">{s.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <p className="font-serif text-xl text-[#D4AF37]">${s.price.toFixed(2)}</p>
                <button onClick={() => remove(s.id)} className="text-rose-400 hover:text-rose-300" data-testid={`svc-delete-${s.id}`}>
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`.dark-input { background: #0B0F19; border: 1px solid #1E293B; border-radius: 0.5rem; padding: 0.7rem 1rem; color: #F8FAFC; font-size: 0.85rem; outline: none; transition: border-color 200ms ease; } .dark-input:focus { border-color: #D4AF37; }`}</style>
    </div>
  );
}
