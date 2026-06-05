import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDown } from "lucide-react";

export const CURRENCIES = [
  { value: "NGN", label: "₦ NGN — Nigerian Naira" },
  { value: "USD", label: "$ USD — US Dollar" },
  { value: "EUR", label: "€ EUR — Euro" },
  { value: "GBP", label: "£ GBP — British Pound" },
  { value: "GHS", label: "₵ GHS — Ghana Cedi" },
  { value: "KES", label: "KSh KES — Kenyan Shilling" },
  { value: "ZAR", label: "R ZAR — South African Rand" },
  { value: "CAD", label: "C$ CAD — Canadian Dollar" },
  { value: "AUD", label: "A$ AUD — Australian Dollar" },
  { value: "JPY", label: "¥ JPY — Japanese Yen" },
  { value: "CNY", label: "¥ CNY — Chinese Yuan" },
  { value: "INR", label: "₹ INR — Indian Rupee" },
  { value: "BRL", label: "R$ BRL — Brazilian Real" },
  { value: "MXN", label: "$ MXN — Mexican Peso" },
  { value: "CHF", label: "Fr CHF — Swiss Franc" },
  { value: "SGD", label: "S$ SGD — Singapore Dollar" },
  { value: "HKD", label: "HK$ HKD — Hong Kong Dollar" },
  { value: "SEK", label: "kr SEK — Swedish Krona" },
  { value: "NOK", label: "kr NOK — Norwegian Krone" },
  { value: "DKK", label: "kr DKK — Danish Krone" },
  { value: "NZD", label: "NZ$ NZD — New Zealand Dollar" },
  { value: "AED", label: "د.إ AED — UAE Dirham" },
  { value: "SAR", label: "﷼ SAR — Saudi Riyal" },
  { value: "QAR", label: "﷼ QAR — Qatari Riyal" },
  { value: "KWD", label: "د.ك KWD — Kuwaiti Dinar" },
  { value: "BHD", label: "BD BHD — Bahraini Dinar" },
  { value: "OMR", label: "﷼ OMR — Omani Rial" },
  { value: "JOD", label: "JD JOD — Jordanian Dinar" },
  { value: "EGP", label: "£ EGP — Egyptian Pound" },
  { value: "MAD", label: "MAD MAD — Moroccan Dirham" },
  { value: "TND", label: "DT TND — Tunisian Dinar" },
  { value: "DZD", label: "DA DZD — Algerian Dinar" },
  { value: "ETB", label: "Br ETB — Ethiopian Birr" },
  { value: "TZS", label: "TSh TZS — Tanzanian Shilling" },
  { value: "UGX", label: "USh UGX — Ugandan Shilling" },
  { value: "RWF", label: "Fr RWF — Rwandan Franc" },
  { value: "XOF", label: "Fr XOF — West African CFA Franc" },
  { value: "XAF", label: "Fr XAF — Central African CFA Franc" },
  { value: "ZMW", label: "ZK ZMW — Zambian Kwacha" },
  { value: "MWK", label: "MK MWK — Malawian Kwacha" },
  { value: "BWP", label: "P BWP — Botswana Pula" },
  { value: "NAD", label: "N$ NAD — Namibian Dollar" },
  { value: "MZN", label: "MT MZN — Mozambican Metical" },
  { value: "AOA", label: "Kz AOA — Angolan Kwanza" },
  { value: "CDF", label: "Fr CDF — Congolese Franc" },
  { value: "SLL", label: "Le SLL — Sierra Leonean Leone" },
  { value: "LRD", label: "L$ LRD — Liberian Dollar" },
  { value: "SOS", label: "Sh SOS — Somali Shilling" },
  { value: "SDG", label: "SDG SDG — Sudanese Pound" },
  { value: "PKR", label: "₨ PKR — Pakistani Rupee" },
  { value: "BDT", label: "৳ BDT — Bangladeshi Taka" },
  { value: "LKR", label: "₨ LKR — Sri Lankan Rupee" },
  { value: "NPR", label: "₨ NPR — Nepalese Rupee" },
  { value: "MMK", label: "K MMK — Myanmar Kyat" },
  { value: "THB", label: "฿ THB — Thai Baht" },
  { value: "VND", label: "₫ VND — Vietnamese Dong" },
  { value: "IDR", label: "Rp IDR — Indonesian Rupiah" },
  { value: "MYR", label: "RM MYR — Malaysian Ringgit" },
  { value: "PHP", label: "₱ PHP — Philippine Peso" },
  { value: "KRW", label: "₩ KRW — South Korean Won" },
  { value: "TWD", label: "NT$ TWD — Taiwan Dollar" },
  { value: "HUF", label: "Ft HUF — Hungarian Forint" },
  { value: "PLN", label: "zł PLN — Polish Zloty" },
  { value: "CZK", label: "Kč CZK — Czech Koruna" },
  { value: "RON", label: "lei RON — Romanian Leu" },
  { value: "BGN", label: "лв BGN — Bulgarian Lev" },
  { value: "HRK", label: "kn HRK — Croatian Kuna" },
  { value: "RSD", label: "din RSD — Serbian Dinar" },
  { value: "TRY", label: "₺ TRY — Turkish Lira" },
  { value: "UAH", label: "₴ UAH — Ukrainian Hryvnia" },
  { value: "RUB", label: "₽ RUB — Russian Ruble" },
  { value: "KZT", label: "₸ KZT — Kazakhstani Tenge" },
  { value: "GEL", label: "₾ GEL — Georgian Lari" },
  { value: "ILS", label: "₪ ILS — Israeli Shekel" },
  { value: "IRR", label: "﷼ IRR — Iranian Rial" },
  { value: "IQD", label: "ع.د IQD — Iraqi Dinar" },
  { value: "CLP", label: "$ CLP — Chilean Peso" },
  { value: "COP", label: "$ COP — Colombian Peso" },
  { value: "PEN", label: "S/ PEN — Peruvian Sol" },
  { value: "ARS", label: "$ ARS — Argentine Peso" },
  { value: "BOB", label: "Bs BOB — Bolivian Boliviano" },
  { value: "UYU", label: "$ UYU — Uruguayan Peso" },
  { value: "GTQ", label: "Q GTQ — Guatemalan Quetzal" },
  { value: "CRC", label: "₡ CRC — Costa Rican Colón" },
  { value: "DOP", label: "RD$ DOP — Dominican Peso" },
  { value: "JMD", label: "J$ JMD — Jamaican Dollar" },
  { value: "TTD", label: "TT$ TTD — Trinidad & Tobago Dollar" },
  { value: "FJD", label: "FJ$ FJD — Fijian Dollar" },
  { value: "ISK", label: "kr ISK — Icelandic Króna" },
  { value: "ZWL", label: "Z$ ZWL — Zimbabwean Dollar" },
  { value: "SZL", label: "E SZL — Swazi Lilangeni" },
  { value: "LSL", label: "L LSL — Lesotho Loti" },
];

export default function CurrencySelect({ value, onValueChange, className }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = CURRENCIES.find(c => c.value === value);
  const filtered = search
    ? CURRENCIES.filter(c => c.label.toLowerCase().includes(search.toLowerCase()) || c.value.toLowerCase().includes(search.toLowerCase()))
    : CURRENCIES;

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (currency) => {
    onValueChange(currency.value);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span>{selected ? selected.label : "Select currency"}</span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-2 border-b">
            <Input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search currency..."
              className="h-8 text-sm"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No results</div>
            )}
            {filtered.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => handleSelect(c)}
                className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${c.value === value ? "bg-accent text-accent-foreground font-medium" : ""}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}