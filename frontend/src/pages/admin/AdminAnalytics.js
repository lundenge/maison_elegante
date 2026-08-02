import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/i18n/I18nContext";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Users, ReceiptText, Wallet, Coins } from "lucide-react";

const COLORS = ["#D4AF37", "#059669", "#E11D48", "#6366F1", "#F59E0B"];

export default function AdminAnalytics() {
  const { t } = useT();
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/analytics").then((r) => setData(r.data)); }, []);
  if (!data) return <p className="text-slate-400">{t("admin.loading")}</p>;

  return (
    <div>
      <p className="overline text-[#D4AF37]">{t("admin.overview.overline")}</p>
      <h1 className="font-serif text-4xl mt-2 tracking-tight">{t("admin.overview.title")}</h1>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={<Wallet size={16}/>} label={t("admin.stat.revenue")} value={`$${data.total_revenue.toLocaleString()}`}/>
        <Stat icon={<TrendingUp size={16}/>} label={t("admin.stat.pending")} value={`$${data.pending_revenue.toLocaleString()}`}/>
        <Stat icon={<ReceiptText size={16}/>} label={t("admin.stat.bookings")} value={`${data.paid_bookings}/${data.total_bookings}`}/>
        <Stat icon={<Users size={16}/>} label={t("admin.stat.clients")} value={data.total_users}/>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#111827] border border-white/5 rounded-2xl p-6">
          <p className="overline text-slate-400">{t("admin.revenue.title")}</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthly}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11}/>
                <YAxis stroke="#94A3B8" fontSize={11}/>
                <Tooltip contentStyle={{ background: "#0B0F19", border: "1px solid #1E293B" }}/>
                <Line type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
          <p className="overline text-slate-400">{t("admin.category.title")}</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.by_category} dataKey="revenue" nameKey="category" innerRadius={40} outerRadius={80} paddingAngle={2}>
                  {data.by_category.map((entry, i) => <Cell key={entry.category} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0B0F19", border: "1px solid #1E293B" }}/>
                <Legend wrapperStyle={{ fontSize: 11, color: "#94A3B8" }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-[#111827] border border-white/5 rounded-2xl p-6">
        <p className="overline text-slate-400">{t("admin.volume.title")}</p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthly}>
              <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#94A3B8" fontSize={11}/>
              <YAxis stroke="#94A3B8" fontSize={11}/>
              <Tooltip contentStyle={{ background: "#0B0F19", border: "1px solid #1E293B" }}/>
              <Bar dataKey="count" fill="#D4AF37" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {data.by_currency && data.by_currency.length > 0 && (
        <div className="mt-8 bg-[#111827] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-[#D4AF37]">
            <Coins size={16}/><p className="overline text-slate-400">{t("admin.currency.title")}</p>
          </div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.by_currency.map((c) => (
              <div key={c.currency} data-testid={`ccy-card-${c.currency}`}
                className="rounded-xl border border-white/5 bg-[#0B0F19] p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#D4AF37]">{c.currency}</span>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{c.count} · bookings</span>
                </div>
                <p className="font-serif text-3xl mt-4 text-slate-100">
                  {c.symbol}{c.paid_local.toLocaleString(undefined, { maximumFractionDigits: c.currency === "TZS" ? 0 : 2 })}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {t("admin.stat.pending")}: {c.symbol}{c.pending_local.toLocaleString(undefined, { maximumFractionDigits: c.currency === "TZS" ? 0 : 2 })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-[#D4AF37]">{icon}<span className="overline text-slate-400">{label}</span></div>
      <p className="font-serif text-3xl mt-4">{value}</p>
    </div>
  );
}
