import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useT } from "@/i18n/I18nContext";
import { ArrowUpRight, Sparkles, Gift, Utensils, Armchair, Camera } from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1740047602722-b4993b79e4b7?crop=entropy&cs=srgb&fm=jpg&q=85&w=2000";

export default function LandingPage() {
  const { t } = useT();

  const CARDS = [
    { icon: Armchair, title: t("landing.card.rentals"), desc: t("landing.card.rentals.desc"), img: "https://images.unsplash.com/photo-1530023367847-a683933f4172?crop=entropy&cs=srgb&fm=jpg&q=85&w=800" },
    { icon: Sparkles, title: t("landing.card.party"), desc: t("landing.card.party.desc"), img: "https://images.unsplash.com/photo-1763553113391-a659bee36e06?crop=entropy&cs=srgb&fm=jpg&q=85&w=800" },
    { icon: Utensils, title: t("landing.card.catering"), desc: t("landing.card.catering.desc"), img: "https://images.unsplash.com/photo-1740047602722-b4993b79e4b7?crop=entropy&cs=srgb&fm=jpg&q=85&w=800" },
    { icon: Gift, title: t("landing.card.gifts"), desc: t("landing.card.gifts.desc"), img: "https://images.pexels.com/photos/29873585/pexels-photo-29873585.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <Navbar />

      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-20 grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-7 relative z-10">
            <p className="overline text-[#B8962E] fade-up">{t("landing.overline")}</p>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl leading-[1.02] tracking-tight text-[#0F172A] mt-6 fade-up fade-up-delay-1">
              {t("landing.hero.1")}
              <br/>
              <span className="italic">{t("landing.hero.2")}</span> {t("landing.hero.3")}
            </h1>
            <p className="mt-8 text-lg text-slate-600 max-w-xl leading-relaxed fade-up fade-up-delay-2">
              {t("landing.hero.subtitle")}
            </p>
            <div className="mt-10 flex flex-wrap gap-4 fade-up fade-up-delay-3">
              <Link to="/services" className="btn-pill" data-testid="hero-cta-services">
                {t("landing.hero.cta.explore")} <ArrowUpRight size={18} className="ml-2"/>
              </Link>
              <Link to="/register" className="btn-outline-gold" data-testid="landing-register-cta">
                {t("landing.hero.cta.register")}
              </Link>
            </div>
            <div className="mt-16 flex items-center gap-8 fade-up fade-up-delay-4">
              <Stat number="1,200+" label={t("landing.stat.events")} />
              <div className="h-8 w-px bg-slate-300" />
              <Stat number="48h" label={t("landing.stat.lead")} />
              <div className="h-8 w-px bg-slate-300" />
              <Stat number="4.9/5" label={t("landing.stat.rating")} />
            </div>
          </div>

          <div className="md:col-span-5 relative">
            <div className="relative rounded-[24px] overflow-hidden shadow-2xl grain fade-up fade-up-delay-2">
              <img src={HERO_IMG} alt="Luxury table setup" className="w-full h-[540px] object-cover"/>
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"/>
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <p className="overline">{t("landing.featured")}</p>
                <p className="font-serif text-2xl mt-2">{t("landing.featured.text")}</p>
              </div>
            </div>
            <div className="absolute -bottom-8 -left-8 hidden lg:block bg-white p-6 rounded-2xl shadow-xl border border-slate-100 max-w-[260px]">
              <p className="overline text-slate-500">{t("landing.nowavail")}</p>
              <p className="font-serif text-lg mt-2 leading-snug">{t("landing.nowavail.text")}</p>
              <Camera size={18} className="mt-3 text-[#D4AF37]"/>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-end justify-between gap-6 mb-14">
          <div>
            <p className="overline text-[#B8962E]">{t("landing.pillars.overline")}</p>
            <h2 className="font-serif text-4xl md:text-5xl mt-3 tracking-tight text-[#0F172A]">{t("landing.pillars.title")}</h2>
          </div>
          <Link to="/services" className="btn-outline-gold hidden md:inline-flex">
            {t("landing.pillars.browse")} <ArrowUpRight size={16} className="ml-2"/>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {CARDS.map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className={`svc-card bg-white rounded-2xl overflow-hidden border border-slate-100 fade-up fade-up-delay-${(i % 4) + 1}`}>
                <div className="h-48 overflow-hidden">
                  <img src={c.img} alt={c.title} className="w-full h-full object-cover" style={{ transition: "transform 900ms ease" }} onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.06)")} onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}/>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="text-[#D4AF37]"/>
                    <p className="overline text-slate-500">Service</p>
                  </div>
                  <h3 className="font-serif text-xl mt-3">{c.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mt-2">{c.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-[#0F172A] text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-4">
            <p className="overline text-[#D4AF37]">{t("landing.how.overline")}</p>
            <h2 className="font-serif text-4xl md:text-5xl mt-3 tracking-tight">{t("landing.how.title")}</h2>
            <p className="mt-6 text-slate-400 max-w-md leading-relaxed">{t("landing.how.subtitle")}</p>
          </div>
          <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n: "01", t: t("landing.step1.title"), d: t("landing.step1.desc") },
              { n: "02", t: t("landing.step2.title"), d: t("landing.step2.desc") },
              { n: "03", t: t("landing.step3.title"), d: t("landing.step3.desc") },
            ].map((s, i) => (
              <div key={s.n} className={`border border-slate-800 rounded-2xl p-8 fade-up fade-up-delay-${i + 1}`}>
                <p className="font-serif text-4xl text-[#D4AF37]">{s.n}</p>
                <p className="font-serif text-xl mt-4">{s.t}</p>
                <p className="text-sm text-slate-400 mt-3 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <p className="overline text-[#B8962E]">{t("landing.cta.overline")}</p>
        <h2 className="font-serif text-4xl md:text-5xl mt-4 tracking-tight text-[#0F172A]">
          {t("landing.cta.title")}
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link to="/register" className="btn-pill">{t("landing.cta.create")}</Link>
          <Link to="/services" className="btn-outline-gold">{t("landing.cta.catalog")}</Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#F7F3EA] py-12 text-slate-600">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid gap-8 md:grid-cols-3">
          <div>
            <p className="text-lg font-semibold text-[#0F172A]">Élégante Suprise</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed">
              {t("landing.footer")}
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Follow us</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {[
                ["Facebook", "https://facebook.com/maisonellegante"],
                ["WhatsApp", "https://wa.me/15551234567"],
                ["Instagram", "https://instagram.com/maisonellegante"],
                ["TikTok", "https://www.tiktok.com/@maisonellegante"],
                ["Telegram", "https://t.me/maisonellegante"],
                ["YouTube", "https://youtube.com/@maisonellegante"],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-300 px-3 py-1.5 transition hover:border-[#D4AF37] hover:text-[#0F172A]"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Visit us</p>
            <p className="mt-4 text-sm leading-relaxed">
              24 Av Bukavu<br />
              Uvira Sud kivu, DRCongo<br />
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Élégante Suprise. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function Stat({ number, label }) {
  return (
    <div>
      <p className="font-serif text-2xl text-[#0F172A]">{number}</p>
      <p className="overline text-slate-500 mt-1">{label}</p>
    </div>
  );
}
