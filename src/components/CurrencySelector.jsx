import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

const CURRENCIES = [
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
  { value: "UZS", label: "soʻm UZS — Uzbekistani Som" },
  { value: "GEL", label: "₾ GEL — Georgian Lari" },
  { value: "AMD", label: "֏ AMD — Armenian Dram" },
  { value: "AZN", label: "₼ AZN — Azerbaijani Manat" },
  { value: "ILS", label: "₪ ILS — Israeli Shekel" },
  { value: "IRR", label: "﷼ IRR — Iranian Rial" },
  { value: "IQD", label: "ع.د IQD — Iraqi Dinar" },
  { value: "LBP", label: "L£ LBP — Lebanese Pound" },
  { value: "SYP", label: "£ SYP — Syrian Pound" },
  { value: "YER", label: "﷼ YER — Yemeni Rial" },
  { value: "AFN", label: "؋ AFN — Afghan Afghani" },
  { value: "CLP", label: "$ CLP — Chilean Peso" },
  { value: "COP", label: "$ COP — Colombian Peso" },
  { value: "PEN", label: "S/ PEN — Peruvian Sol" },
  { value: "ARS", label: "$ ARS — Argentine Peso" },
  { value: "BOB", label: "Bs BOB — Bolivian Boliviano" },
  { value: "PYG", label: "₲ PYG — Paraguayan Guaraní" },
  { value: "UYU", label: "$ UYU — Uruguayan Peso" },
  { value: "VES", label: "Bs.S VES — Venezuelan Bolívar" },
  { value: "GTQ", label: "Q GTQ — Guatemalan Quetzal" },
  { value: "HNL", label: "L HNL — Honduran Lempira" },
  { value: "NIO", label: "C$ NIO — Nicaraguan Córdoba" },
  { value: "CRC", label: "₡ CRC — Costa Rican Colón" },
  { value: "PAB", label: "B/. PAB — Panamanian Balboa" },
  { value: "DOP", label: "RD$ DOP — Dominican Peso" },
  { value: "HTG", label: "G HTG — Haitian Gourde" },
  { value: "JMD", label: "J$ JMD — Jamaican Dollar" },
  { value: "TTD", label: "TT$ TTD — Trinidad & Tobago Dollar" },
  { value: "BBD", label: "Bds$ BBD — Barbadian Dollar" },
  { value: "BSD", label: "B$ BSD — Bahamian Dollar" },
  { value: "BZD", label: "BZ$ BZD — Belize Dollar" },
  { value: "GYD", label: "G$ GYD — Guyanese Dollar" },
  { value: "SRD", label: "Sr$ SRD — Surinamese Dollar" },
  { value: "FJD", label: "FJ$ FJD — Fijian Dollar" },
  { value: "PGK", label: "K PGK — Papua New Guinean Kina" },
  { value: "WST", label: "T WST — Samoan Tālā" },
  { value: "TOP", label: "T$ TOP — Tongan Paʻanga" },
  { value: "SBD", label: "SI$ SBD — Solomon Islands Dollar" },
  { value: "VUV", label: "Vt VUV — Vanuatu Vatu" },
  { value: "KYD", label: "CI$ KYD — Cayman Islands Dollar" },
  { value: "BMD", label: "BD$ BMD — Bermudian Dollar" },
  { value: "XCD", label: "EC$ XCD — East Caribbean Dollar" },
  { value: "AWG", label: "Afl AWG — Aruban Florin" },
  { value: "ISK", label: "kr ISK — Icelandic Króna" },
  { value: "MKD", label: "ден MKD — Macedonian Denar" },
  { value: "ALL", label: "L ALL — Albanian Lek" },
  { value: "MDL", label: "L MDL — Moldovan Leu" },
  { value: "BAM", label: "KM BAM — Bosnia & Herzegovina Mark" },
  { value: "MNT", label: "₮ MNT — Mongolian Tögrög" },
  { value: "KHR", label: "₭ KHR — Cambodian Riel" },
  { value: "LAK", label: "₭ LAK — Lao Kip" },
  { value: "MOP", label: "P MOP — Macanese Pataca" },
  { value: "BTN", label: "Nu BTN — Bhutanese Ngultrum" },
  { value: "MVR", label: "Rf MVR — Maldivian Rufiyaa" },
  { value: "SCR", label: "₨ SCR — Seychellois Rupee" },
  { value: "MUR", label: "₨ MUR — Mauritian Rupee" },
  { value: "MGA", label: "Ar MGA — Malagasy Ariary" },
  { value: "KMF", label: "Fr KMF — Comorian Franc" },
  { value: "DJF", label: "Fr DJF — Djiboutian Franc" },
  { value: "ERN", label: "Nfk ERN — Eritrean Nakfa" },
  { value: "STN", label: "Db STN — São Tomé & Príncipe Dobra" },
  { value: "CVE", label: "Esc CVE — Cape Verdean Escudo" },
  { value: "GMD", label: "D GMD — Gambian Dalasi" },
  { value: "SZL", label: "E SZL — Swazi Lilangeni" },
  { value: "LSL", label: "L LSL — Lesotho Loti" },
  { value: "ZWL", label: "Z$ ZWL — Zimbabwean Dollar" },
];

export { CURRENCIES };

export default function CurrencySelector({ value, onValueChange, className = "" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const selected = CURRENCIES.find(c => c.value === value);
  const filtered = CURRENCIES.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.value.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

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

  const handleSelect = (val) => {
    onValueChange(val);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span className="truncate">{selected ? selected.label : "Select currency"}</span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-md border border-input bg-popover shadow-md">
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search currency…"
              className="w-full text-sm px-2 py-1.5 rounded border border-input bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="overflow-y-auto max-h-56">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">No currency found</div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleSelect(c.value)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                >
                  <Check className={`h-3.5 w-3.5 shrink-0 ${value === c.value ? "opacity-100 text-primary" : "opacity-0"}`} />
                  {c.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}