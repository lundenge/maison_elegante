import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

// Base currency in DB is USD. Rates are USD -> target (approximate).
export const CURRENCIES = {
  USD: { code: "USD", symbol: "$", rate: 1, decimals: 2 },
  EUR: { code: "EUR", symbol: "€", rate: 0.92, decimals: 2 },
  TZS: { code: "TZS", symbol: "TSh", rate: 2600, decimals: 0 },
};

const EUR_COUNTRIES = /(france|deutschland|germany|italia|italy|españa|spain|belgi|nederland|netherlands|portugal|ireland|luxembourg|austria|österreich|finland|greece|ellada|slovenia|slovakia|estonia|latvia|lithuania|malta|cyprus|croatia|hrvatska)/i;
const TZS_COUNTRIES = /(tanzania|tanzanie|kenya|uganda|rwanda|burundi|zanzibar|congo)/i;

export function currencyForCountry(country = "") {
  if (EUR_COUNTRIES.test(country)) return "EUR";
  if (TZS_COUNTRIES.test(country)) return "TZS";
  return "USD";
}

export function convert(usdAmount, code) {
  const c = CURRENCIES[code] || CURRENCIES.USD;
  return usdAmount * c.rate;
}

export function formatMoney(usdAmount, code) {
  const c = CURRENCIES[code] || CURRENCIES.USD;
  const value = convert(usdAmount, code);
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  });
  return `${c.symbol}${formatted}`;
}

const STORAGE_KEY = "maison_currency";
const CurrencyCtx = createContext(null);

export function CurrencyProvider({ children }) {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || "USD";
  });
  const [manual, setManual] = useState(() => !!localStorage.getItem(STORAGE_KEY));

  // On user login, auto-select from country unless user manually chose
  useEffect(() => {
    if (!manual && user?.country) {
      const auto = currencyForCountry(user.country);
      setCurrencyState(auto);
    }
  }, [user?.country, manual]);

  const setCurrency = useCallback((code) => {
    setCurrencyState(code);
    setManual(true);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const value = useMemo(() => ({
    currency,
    setCurrency,
    format: (usd) => formatMoney(usd, currency),
    convert: (usd) => convert(usd, currency),
    decimals: CURRENCIES[currency]?.decimals ?? 2,
    symbol: CURRENCIES[currency]?.symbol ?? "$",
    rate: CURRENCIES[currency]?.rate ?? 1,
    codes: Object.keys(CURRENCIES),
  }), [currency, setCurrency]);

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export const useCurrency = () => useContext(CurrencyCtx);
