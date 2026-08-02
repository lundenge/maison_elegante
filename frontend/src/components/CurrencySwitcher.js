import { useCurrency, CURRENCIES } from "@/context/CurrencyContext";
import { Coins } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export default function CurrencySwitcher({ dark = false }) {
  const { currency, setCurrency, codes } = useCurrency();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          data-testid="currency-switcher"
          className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border transition-colors duration-200 ${
            dark
              ? "border-white/10 text-slate-300 hover:border-[#D4AF37] hover:text-[#D4AF37]"
              : "border-slate-200 text-slate-600 hover:border-[#D4AF37] hover:text-[#0F172A]"
          }`}>
          <Coins size={12} /> {currency}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end" sideOffset={8}
          className={`min-w-[160px] rounded-xl p-1 shadow-xl border z-50 ${
            dark ? "bg-[#111827] border-white/10" : "bg-white border-slate-200"
          }`}>
          {codes.map((code) => (
            <DropdownMenu.Item
              key={code}
              data-testid={`currency-${code}`}
              onSelect={() => setCurrency(code)}
              className={`text-sm px-3 py-2 rounded-lg cursor-pointer outline-none transition-colors duration-150 flex items-center justify-between ${
                dark
                  ? "text-slate-200 data-[highlighted]:bg-white/5 data-[highlighted]:text-[#D4AF37]"
                  : "text-slate-700 data-[highlighted]:bg-slate-50 data-[highlighted]:text-[#0F172A]"
              } ${code === currency ? "font-medium text-[#D4AF37]" : ""}`}>
              <span>{CURRENCIES[code].symbol} {code}</span>
              {code === currency && <span className="text-xs opacity-60">✓</span>}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
