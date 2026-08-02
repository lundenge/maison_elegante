import { useT } from "@/i18n/I18nContext";
import { Globe } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export default function LanguageSwitcher({ dark = false }) {
  const { lang, setLang, langs } = useT();
  const current = langs.find((l) => l.code === lang) || langs[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          data-testid="lang-switcher"
          className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border transition-colors duration-200 ${
            dark
              ? "border-white/10 text-slate-300 hover:border-[#D4AF37] hover:text-[#D4AF37]"
              : "border-slate-200 text-slate-600 hover:border-[#D4AF37] hover:text-[#0F172A]"
          }`}>
          <Globe size={12} /> {current.flag}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end" sideOffset={8}
          className={`min-w-[160px] rounded-xl p-1 shadow-xl border z-50 ${
            dark ? "bg-[#111827] border-white/10" : "bg-white border-slate-200"
          }`}>
          {langs.map((l) => (
            <DropdownMenu.Item
              key={l.code}
              data-testid={`lang-${l.code}`}
              onSelect={() => setLang(l.code)}
              className={`text-sm px-3 py-2 rounded-lg cursor-pointer outline-none transition-colors duration-150 ${
                dark
                  ? "text-slate-200 data-[highlighted]:bg-white/5 data-[highlighted]:text-[#D4AF37]"
                  : "text-slate-700 data-[highlighted]:bg-slate-50 data-[highlighted]:text-[#0F172A]"
              } ${l.code === lang ? "font-medium text-[#D4AF37]" : ""}`}>
              {l.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
