import { useState, useEffect, useMemo, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ArrowLeft, Settings2, FileDown, Upload, GripVertical, PenLine, Printer, CheckCircle2, ImagePlus, X, Palette } from "lucide-react";
import { COLOR_SCHEMES, LAYOUTS, LayoutThumb } from "../components/TemplateSelector";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CustomerForm from "../components/CustomerForm";
import CustomerSelect from "../components/CustomerSelect";
import BankDetailsFields from "../components/BankDetailsFields";
import CurrencySelect, { CURRENCIES } from "../components/CurrencySelect";
import SignaturePad from "../components/SignaturePad";
import DocumentPreview from "../components/DocumentPreview";
import { toast } from "sonner";

const typeLabels = {
  invoice: "Invoice", quotation: "Quotation", receipt: "Receipt", waybill: "Waybill",
};

const TYPE_THEMES = {
  invoice:   { gradient: "linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)", glow: "rgba(59,130,246,0.25)",  accent: "#3b82f6",  light: "#eff6ff",  border: "#bfdbfe", badge: "bg-blue-100 text-blue-700",   icon: "📄", emoji: "💼" },
  quotation: { gradient: "linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%)", glow: "rgba(139,92,246,0.25)", accent: "#8b5cf6",  light: "#f5f3ff",  border: "#ddd6fe", badge: "bg-purple-100 text-purple-700", icon: "📋", emoji: "📋" },
  receipt:   { gradient: "linear-gradient(135deg,#10b981 0%,#047857 100%)", glow: "rgba(16,185,129,0.25)",  accent: "#10b981",  light: "#ecfdf5",  border: "#a7f3d0", badge: "bg-emerald-100 text-emerald-700",icon: "🧾", emoji: "🧾" },
  waybill:   { gradient: "linear-gradient(135deg,#f59e0b 0%,#b45309 100%)", glow: "rgba(245,158,11,0.25)",  accent: "#f59e0b",  light: "#fffbeb",  border: "#fde68a", badge: "bg-amber-100 text-amber-700",   icon: "🚚", emoji: "🚚" },
};

const DOC_LABELS = {
  invoice:   { number: "Invoice Number",   issueDate: "Invoice Date",  dueDate: "Due Date",      customer: "Bill To",       items: "Line Items",                itemDesc: "Item Description",      itemQty: "Quantity",    notes: "Notes to Customer",     sig: "Authorized Signature",    sigDesc: "Sign to authorize this invoice.",                                    showTax: true,  showDisc: true,  showDue: true,  showPrices: true  },
  quotation: { number: "Quotation Number", issueDate: "Issue Date",    dueDate: "Expiry Date",   customer: "Prepared For",  items: "Proposed Items / Services", itemDesc: "Item / Service",         itemQty: "Est. Qty",    notes: "Notes",                 sig: "Prepared By (Signature)", sigDesc: "Sign to authorize this quotation.",                                  showTax: true,  showDisc: true,  showDue: true,  showPrices: true  },
  receipt:   { number: "Receipt Number",   issueDate: "Payment Date",  dueDate: null,            customer: "Received From", items: "Payment For",               itemDesc: "Description of Payment", itemQty: "Quantity",    notes: "Notes",                 sig: "Manager's Signature",     sigDesc: "Sign to confirm this receipt.",                                      showTax: true,  showDisc: false, showDue: false, showPrices: true  },
  waybill:   { number: "Waybill Number",   issueDate: "Dispatch Date", dueDate: "Delivery Date", customer: "Receiver",      items: "Goods Description",         itemDesc: "Goods / Items",          itemQty: "Qty Shipped", notes: "Delivery Instructions", sig: "Manager's Signature",     sigDesc: "Sign as the dispatcher/manager authorizing this waybill.",           showTax: false, showDisc: false, showDue: true,  showPrices: false },
};

const DEFAULT_PREFIXES = { invoice: "INV", quotation: "QUO", receipt: "REC", waybill: "WB" };

const _PLACEHOLDER_START = [
  { value: "USD_PLACEHOLDER", label: "placeholder" },
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
  { value: "GNF", label: "Fr GNF — Guinean Franc" },
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
  { value: "ANG", label: "ƒ ANG — Netherlands Antillean Guilder" },
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
  { value: "GNF", label: "Fr GNF — Guinean Franc" },
  { value: "SZL", label: "E SZL — Swazi Lilangeni" },
  { value: "LSL", label: "L LSL — Lesotho Loti" },
  { value: "ZWL", label: "Z$ ZWL — Zimbabwean Dollar" },
];

export default function CreateDocument() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("edit") || null;
  const docType = params.get("type") || "invoice";
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [managerSig, setManagerSig] = useState(null);
  const [savedManagerSig, setSavedManagerSig] = useState(null);
  const [savingDefaultSig, setSavingDefaultSig] = useState(false);
  const [savedBankDetails, setSavedBankDetails] = useState(null);
  const [savingBankDetails, setSavingBankDetails] = useState(false);
  const [savedTaxNumber, setSavedTaxNumber] = useState("");
  const [savingTaxNumber, setSavingTaxNumber] = useState(false);
  const [customerSig, setCustomerSig] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [typePrefix, setTypePrefix] = useState(DEFAULT_PREFIXES[docType] || "DOC");
  const [companyAbbr, setCompanyAbbr] = useState("");
  const [numSeq, setNumSeq] = useState("");
  const [numOpen, setNumOpen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("");

  const draftIdRef = useRef(editId || null);
  const autoSaveTimerRef = useRef(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [uploadingItemImg, setUploadingItemImg] = useState({});

  useEffect(() => {
    const handler = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Intercept mobile hardware back button via popstate
  useEffect(() => {
    if (!isDirty) return;
    // Push a dummy state so pressing back fires popstate instead of navigating away
    window.history.pushState({ interceptBack: true }, "");
    const handler = (e) => {
      if (isDirty) {
        // Push the state again so repeated back presses keep getting caught
        window.history.pushState({ interceptBack: true }, "");
        setShowLeaveModal(true);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [isDirty]);

  const [pendingNav, setPendingNav] = useState(null);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      const anchor = e.target.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNav(href);
      setShowLeaveModal(true);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [isDirty]);

  const [form, setForm] = useState({
    type: docType,
    number: "",
    customer_id: "",
    customer_name: "",
    customer_company: "",
    customer_email: "",
    customer_address: "",
    tax_number: "",
    lpo_number: "",
    currency: "NGN",
    tax_rate: "",
    shipping: "",
    notes: "",
    terms: "",
    terms_label: "Due on Receipt",
    global_discount_rate: "",
    withholding_vat_rate: "",
    manager_name: "",
    manager_title: "",
    payment_instructions: "",
    payment_method: "",
    bank_name: "",
    account_number: "",
    account_holder_name: "",
    transaction_id: "",
    reference_number: "",
    driver_name: "",
    vehicle_number: "",
    tracking_number: "",
    due_date: "",
    issue_date: new Date().toISOString().split("T")[0],
    logo_url: "",
    company_name: "",
    company_email: "",
    company_phone: "",
    company_address: "",
    company_website: "",
  });
  const [items, setItems] = useState([{ description: "", quantity: "", unit_price: "", discount: "" }]);

  useEffect(() => { setIsDirty(true); }, [form, items]);

  useEffect(() => {
    (async () => {
      const user = await base44.auth.me();
      if (!user) return;

      base44.entities.Customer.filter({ created_by: user.email }, "-created_date", 100).then(setCustomers);

      const tPrefix = (user[`prefix_${docType}`] || DEFAULT_PREFIXES[docType] || "DOC").toUpperCase();
      const cAbbr = (user.company_abbreviation || "").toUpperCase();
      setTypePrefix(tPrefix);
      setCompanyAbbr(cAbbr);

      if (user.manager_signature) {
        setSavedManagerSig(user.manager_signature);
        setManagerSig(user.manager_signature);
      }

      if (user.default_bank_name || user.default_account_number) {
        const saved = { bank_name: user.default_bank_name || "", account_number: user.default_account_number || "", account_holder_name: user.default_account_holder_name || "" };
        setSavedBankDetails(saved);
        setForm(f => ({ ...f, bank_name: saved.bank_name, account_number: saved.account_number, account_holder_name: saved.account_holder_name, reference_number: user.default_bank_reference || f.reference_number, transaction_id: user.default_bank_swift || f.transaction_id }));
      }

      setForm(f => ({
        ...f,
        company_name: user.company_name || user.full_name || "",
        company_email: user.company_email || user.email || "",
        company_phone: user.company_phone || "",
        company_address: user.company_address || "",
        company_website: user.company_website || "",
        logo_url: user.logo_url || "",
        currency: user.default_currency || "NGN",
        tax_rate: user.default_tax_rate ?? "",
        terms: user.default_terms || "",
        payment_instructions: user.default_payment_instructions || "",
        manager_name: user.manager_name || user.full_name || "",
        manager_title: user.manager_title || "",
        tax_number: user.default_tax_number || "",
      }));

      if (user.default_tax_number) {
        setSavedTaxNumber(user.default_tax_number);
      }

      // Apply saved document design settings (only for new documents)
      if (!editId) {
        if (user.doc_design_template) setTemplate(user.doc_design_template);
        if (user.doc_design_color) setTemplateColor(user.doc_design_color);
        if (user.doc_design_font) setTemplateFont(user.doc_design_font);
      }

      if (!editId) {
        // Check for AI prefill
        const aiPrefillRaw = sessionStorage.getItem("ai_prefill");
        if (aiPrefillRaw) {
          sessionStorage.removeItem("ai_prefill");
          const prefill = JSON.parse(aiPrefillRaw);
          if (prefill.items?.length > 0) setItems(prefill.items.map(it => ({ description: it.description || "", quantity: String(it.quantity ?? 1), unit_price: String(it.unit_price ?? 0), discount: "" })));
          if (prefill.notes) setForm(f => ({ ...f, notes: prefill.notes }));
          if (prefill.customer_id || prefill.customer_name) {
            setForm(f => ({
              ...f,
              customer_id: prefill.customer_id || "",
              customer_name: prefill.customer_name || "",
              customer_company: prefill.customer_company || "",
              customer_email: prefill.customer_email || "",
              customer_address: prefill.customer_address || "",
            }));
          }
        }
        // Filter by user to get accurate next sequence number
        const docs = await base44.entities.Document.filter({ type: docType, created_by: user.email }, "-created_date", 1);
        const num = docs.length > 0 ? parseInt((docs[0].number || "0").replace(/\D/g, "") || "0") + 1 : 1;
        const seq = String(num).padStart(4, "0");
        setNumSeq(seq);
        const fullNumber = cAbbr ? `${cAbbr}-${tPrefix}-${seq}` : `${tPrefix}-${seq}`;
        setForm(f => ({ ...f, number: fullNumber }));
      } else {
        const doc = await base44.entities.Document.get(editId);
        // Ownership check — only the creator (or admin) may edit this document
        if (doc && doc.created_by !== user.email && user.role !== "admin") {
          navigate("/documents");
          return;
        }
        if (doc) {
          setForm(f => ({ ...f, ...doc, issue_date: doc.issue_date ? doc.issue_date.split("T")[0] : f.issue_date, due_date: doc.due_date ? doc.due_date.split("T")[0] : "" }));
          if (doc.items) setItems(doc.items);
          if (doc.manager_signature) setManagerSig(doc.manager_signature);
          if (doc.customer_signature) setCustomerSig(doc.customer_signature);
          if (doc.template) setTemplate(doc.template);
          if (doc.template_color) setTemplateColor(doc.template_color);
          if (doc.template_font) setTemplateFont(doc.template_font);
        }
      }
    })();
  }, [docType, editId]);

  const selectCustomer = (id) => {
    if (id === "__add_new__") { setShowAddCustomer(true); return; }
    const c = customers.find(x => x.id === id);
    if (c) setForm(f => ({ ...f, customer_id: id, customer_name: c.full_name, customer_company: c.company_name || "", customer_email: c.email || "", customer_address: c.billing_address || "", currency: (c.currency && c.currency !== "USD") ? c.currency : f.currency }));
  };

  const handleAddCustomer = async (data) => {
    setSavingCustomer(true);
    const created = await base44.entities.Customer.create(data);
    setCustomers(prev => [created, ...prev]);
    selectCustomer(created.id);
    setSavingCustomer(false);
    setShowAddCustomer(false);
  };

  const updateItem = (i, key, val) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const numericOnly = (e) => {
    if (["Backspace","Delete","Tab","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key)) return;
    if (e.key === "." && !e.currentTarget.value.includes(".")) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  };

  // Strips non-numeric chars (except a single decimal point) — covers mobile paste/autocomplete
  const sanitizeNumeric = (val) => {
    const parts = val.replace(/[^\d.]/g, "").split(".");
    return parts.length > 1 ? parts[0] + "." + parts.slice(1).join("") : parts[0];
  };

  const handleItemImageUpload = async (i, file) => {
    setUploadingItemImg(prev => ({ ...prev, [i]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateItem(i, "image_url", file_url);
    setUploadingItemImg(prev => ({ ...prev, [i]: false }));
  };

  const calcs = useMemo(() => {
    const lineItems = items.map(it => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unit_price) || 0;
      const disc = parseFloat(it.discount) || 0;
      const amt = qty * price;
      const discAmt = amt * (disc / 100);
      return { ...it, quantity: qty, unit_price: price, discount: disc, amount: amt - discAmt };
    });
    const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
    const globalDiscAmt = subtotal * ((parseFloat(form.global_discount_rate) || 0) / 100);
    const discountedSubtotal = subtotal - globalDiscAmt;
    const taxAmt = discountedSubtotal * ((parseFloat(form.tax_rate) || 0) / 100);
    const withholdingTaxAmt = discountedSubtotal * ((parseFloat(form.withholding_vat_rate) || 0) / 100);
    const total = discountedSubtotal + taxAmt + (parseFloat(form.shipping) || 0);
    const netPayable = total - withholdingTaxAmt;
    return { lineItems, subtotal, globalDiscAmt, taxAmt, withholdingVatAmt: withholdingTaxAmt, withholdingTaxAmt, netPayable, total };
  }, [items, form.tax_rate, form.shipping, form.global_discount_rate, form.withholding_vat_rate]);

  const handleBackClick = (e) => {
    if (isDirty) { e.preventDefault(); setShowLeaveModal(true); }
    else navigate(-1);
  };

  const buildDocPayload = (status) => ({
    type: form.type || docType,
    number: form.number,
    status,
    template: template,
    template_color: templateColor,
    template_font: templateFont,
    customer_id: form.customer_id || "",
    customer_name: form.customer_name || "",
    customer_company: form.customer_company || "",
    customer_email: form.customer_email || "",
    customer_address: form.customer_address || "",
    tax_number: form.tax_number || "",
    lpo_number: form.lpo_number || "",
    currency: form.currency || "NGN",
    tax_rate: parseFloat(form.tax_rate) || 0,
    tax_amount: calcs.taxAmt,
    subtotal: calcs.subtotal,
    global_discount_rate: parseFloat(form.global_discount_rate) || 0,
    global_discount_amount: calcs.globalDiscAmt,
    discount_total: calcs.globalDiscAmt,
    shipping: parseFloat(form.shipping) || 0,
    withholding_vat_rate: parseFloat(form.withholding_vat_rate) || 0,
    withholding_vat_amount: calcs.withholdingVatAmt || 0,
    total: calcs.total,
    balance_due: calcs.netPayable ?? calcs.total,
    notes: form.notes || "",
    terms: form.terms || "",
    terms_label: form.terms_label || "Due on Receipt",
    payment_instructions: form.payment_instructions || "",
    payment_method: form.payment_method || "",
    bank_name: form.bank_name || "",
    account_number: form.account_number || "",
    account_holder_name: form.account_holder_name || "",
    transaction_id: form.transaction_id || "",
    reference_number: form.reference_number || "",
    driver_name: form.driver_name || "",
    vehicle_number: form.vehicle_number || "",
    tracking_number: form.tracking_number || "",
    issue_date: form.issue_date ? new Date(form.issue_date).toISOString() : new Date().toISOString(),
    due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
    logo_url: form.logo_url || "",
    company_name: form.company_name || "",
    company_email: form.company_email || "",
    company_phone: form.company_phone || "",
    company_address: form.company_address || "",
    company_website: form.company_website || "",
    manager_name: form.manager_name || "",
    manager_title: form.manager_title || "",
    manager_signature: managerSig || "",
    items: calcs.lineItems,
  });

  const handleSave = async (status = "draft") => {
    const resolvedStatus = (form.type || docType) === "waybill" && status === "draft" ? "pending" : status;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaving(true);
    const doc = buildDocPayload(resolvedStatus);
    const targetId = draftIdRef.current || editId;
    if (targetId) {
      await base44.entities.Document.update(targetId, doc);
      navigate(`/documents/${targetId}`);
    } else {
      doc.customer_signature = customerSig || "";
      doc.paid_amount = 0;
      const created = await base44.entities.Document.create(doc);
      navigate(`/documents/${created.id}`);
    }
  };

  const hasMeaningfulData = form.customer_name || items.some(it => it.description);
  useEffect(() => {
    if (!hasMeaningfulData) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus("saving");
      const docData = buildDocPayload((form.type || docType) === "waybill" ? "pending" : "draft");
      if (draftIdRef.current) {
        await base44.entities.Document.update(draftIdRef.current, docData);
      } else {
        docData.customer_signature = customerSig || "";
        docData.paid_amount = 0;
        const created = await base44.entities.Document.create(docData);
        draftIdRef.current = created.id;
      }
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus(""), 3000);
    }, 6000);
    return () => clearTimeout(autoSaveTimerRef.current);
  }, [form, items, managerSig, customerSig]);

  const sym = CURRENCIES.find(c => c.value === form.currency)?.label.split(" ")[0] || form.currency || "₦";

  const pdfRef = useRef(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showInlineSigPad, setShowInlineSigPad] = useState(false);
  const [sigStep, setSigStep] = useState("info");
  const [receiverName, setReceiverName] = useState("");
  const [pdfMode, setPdfMode] = useState("soft");
  const [template, setTemplate] = useState("classic");
  const [templateColor, setTemplateColor] = useState("slate");
  const [templateFont, setTemplateFont] = useState("");

  const generatePdfBlob = async () => {
    const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff", width: 794, windowWidth: 794 });
    const imgData = canvas.toDataURL("image/jpeg", 0.88);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();
    const imgHeightMm = (canvas.height / canvas.width) * pageWidthMm;
    let remaining = imgHeightMm;
    let yPos = 0;
    pdf.addImage(imgData, "JPEG", 0, yPos, pageWidthMm, imgHeightMm);
    remaining -= pageHeightMm;
    while (remaining > 30) {
      yPos -= pageHeightMm;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, yPos, pageWidthMm, imgHeightMm);
      remaining -= pageHeightMm;
    }
    return pdf.output("blob");
  };

  const handleDownloadPdf = async () => {
    if (!pdfRef.current) return;
    setGeneratingPdf(true);
    const blob = await generatePdfBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${form.number || "document"}.pdf`;
    a.click(); URL.revokeObjectURL(url);
    setGeneratingPdf(false);
  };

  const handleSharePdf = async () => {
    if (!pdfRef.current) return;
    setGeneratingPdf(true);
    const blob = await generatePdfBlob();
    const file = new File([blob], `${form.number || "document"}.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: form.number, text: `${form.number} — ${form.customer_name}` });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${form.number || "document"}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    }
    setGeneratingPdf(false);
  };

  const downloadInMode = async (mode) => {
    if (!pdfRef.current) return;
    setPdfMode(mode);
    setGeneratingPdf(true);
    await new Promise(r => setTimeout(r, 150));
    const blob = await generatePdfBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.number || "waybill"}-${mode === "paper" ? "paper" : "signed"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setGeneratingPdf(false);
  };

  const uploadSig = async (dataUrl) => {
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const file = new File([arr], 'signature.png', { type: mime });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  const handleManagerSigSave = async (dataUrl) => {
    const url = await uploadSig(dataUrl);
    setManagerSig(url);
  };

  const handleSoftSigSave = async (sig) => {
    const now = new Date();
    const receiverDate = now.toISOString().split("T")[0];
    const receiverTime = now.toTimeString().slice(0, 5);
    const sigUrl = await uploadSig(sig);
    setForm(f => ({ ...f, receiver_name: receiverName, receiver_date: receiverDate, receiver_time: receiverTime, delivery_signed_at: now.toISOString() }));
    setCustomerSig(sigUrl);
    const signedPayload = { ...buildDocPayload("delivered"), receiver_date: receiverDate, receiver_time: receiverTime, delivery_signed_at: now.toISOString(), customer_signature: sigUrl, manager_signature: managerSig || "" };
    if (draftIdRef.current) {
      await base44.entities.Document.update(draftIdRef.current, signedPayload);
    } else {
      signedPayload.paid_amount = 0;
      const created = await base44.entities.Document.create(signedPayload);
      draftIdRef.current = created.id;
    }
    setShowInlineSigPad(false);
    setPdfMode("soft");
    toast.success("Signature captured — preparing signed PDF…");
    await new Promise(r => setTimeout(r, 400));
    setGeneratingPdf(true);
    const blob = await generatePdfBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.number || "waybill"}-signed.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setGeneratingPdf(false);
    toast.success("Signed PDF downloaded — signature locked into document.");
  };

  const handleSoftSignage = async () => {
    const status = customerSig ? "draft" : "to_be_delivered";
    const doc = buildDocPayload(status);
    const targetId = draftIdRef.current || editId;
    if (targetId) {
      await base44.entities.Document.update(targetId, doc);
    } else {
      doc.manager_signature = managerSig || "";
      doc.customer_signature = customerSig || "";
      doc.paid_amount = 0;
      await base44.entities.Document.create(doc);
    }
    toast.success("Waybill saved.");
    navigate("/documents?type=waybill");
  };

  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  useEffect(() => {
    const onResize = () => { setViewportWidth(window.innerWidth); setViewportHeight(window.innerHeight); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // For the editor scroll area (not modal)
  const previewScale = Math.min(1, (Math.min(viewportWidth, 826) - 32) / 794);
  // Scale PDF to fill the available width exactly (height scrolls if needed)
  const MODAL_LEFT_W = 190;
  const pdfModalScale = Math.min((viewportWidth - MODAL_LEFT_W) / 794, 1);

  const L = DOC_LABELS[docType] || DOC_LABELS.invoice;

  const theme = TYPE_THEMES[docType] || TYPE_THEMES.invoice;

  return (
    <div className="max-w-5xl mx-auto pb-32 md:pb-0">
      {/* Themed header banner */}
      <div
        className="relative rounded-3xl overflow-hidden px-6 py-7 mb-7"
        style={{ background: theme.gradient, boxShadow: `0 8px 40px ${theme.glow}` }}
      >
        <div className="absolute -top-8 -right-10 w-52 h-52 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-10 -left-6 w-36 h-36 rounded-full bg-black/10 pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackClick}
              className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-all shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-white/60 text-xs font-semibold uppercase tracking-widest">Document Builder</span>
              </div>
              <h1 className="text-2xl font-bold text-white">
                {theme.emoji} {editId ? `Edit ${typeLabels[form.type || docType]}` : `New ${typeLabels[docType]}`}
              </h1>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {autoSaveStatus === "saving" && (
              <span className="text-xs text-white/60 animate-pulse bg-white/10 px-3 py-1 rounded-full">Auto-saving…</span>
            )}
            {autoSaveStatus === "saved" && (
              <span className="text-xs text-white font-semibold bg-white/15 px-3 py-1 rounded-full">
                ✓ {(form.type || docType) === "waybill" ? "Pending saved" : "Draft saved"}
              </span>
            )}
            {form.number && (
              <span className="text-white/50 text-xs font-mono mt-1">{form.number}</span>
            )}
          </div>
        </div>
      </div>

      {/* Main grid: form (2 cols) + sidebar (1 col) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">

        {/* ── Left column: form sections ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Document Info */}
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4 shadow-sm" style={{ borderLeft: `3px solid ${theme.accent}` }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: theme.light, border: `1px solid ${theme.border}` }}>🗂️</div>
              <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: theme.accent }}>{typeLabels[docType]} Details</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{L.number}</Label>
                <div className="relative">
                  <Input value={form.number} readOnly className="pr-9 cursor-default bg-muted/40" />
                  <Popover open={numOpen} onOpenChange={setNumOpen}>
                    <PopoverTrigger asChild>
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" title="Customize number format">
                        <Settings2 className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-4" align="end">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Customize Document Number</p>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">Company Abbreviation</Label>
                          <p className="text-xs text-muted-foreground mb-1">Your company's short code (e.g. DR)</p>
                          <Input
                            value={companyAbbr}
                            onChange={e => {
                              const val = e.target.value.toUpperCase();
                              setCompanyAbbr(val);
                              setForm(f => ({ ...f, number: val ? `${val}-${typePrefix}-${numSeq}` : `${typePrefix}-${numSeq}` }));
                            }}
                            placeholder="e.g. DR"
                            className="h-8 text-sm mt-1"
                            style={{ textTransform: "uppercase" }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Document Type Prefix</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input value={typePrefix} readOnly className="h-8 text-sm bg-muted/50 cursor-default flex-1" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Set in Settings</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Sequence Number</Label>
                          <Input value={numSeq} onChange={e => { setNumSeq(e.target.value); setForm(f => ({ ...f, number: companyAbbr ? `${companyAbbr}-${typePrefix}-${e.target.value}` : `${typePrefix}-${e.target.value}` })); }} placeholder="e.g. 0001" className="h-8 text-sm mt-1" />
                        </div>
                        <p className="text-xs text-muted-foreground">Preview: <span className="font-mono font-semibold text-foreground">{companyAbbr ? `${companyAbbr}-${typePrefix}-${numSeq}` : `${typePrefix}-${numSeq}`}</span></p>
                        <button type="button" className="w-full mt-1 bg-primary text-primary-foreground text-xs font-semibold py-1.5 rounded-md hover:bg-primary/90 transition-colors" onClick={async () => {
                             // Persist abbreviation to user settings so it stays in sync
                             await base44.auth.updateMe({ company_abbreviation: companyAbbr });
                             setNumOpen(false);
                             toast.success("Number format saved to settings.");
                           }}>Save</button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <Label>Currency</Label>
                <CurrencySelect value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))} />
              </div>
              <div>
                <Label>{L.customer}</Label>
                <CustomerSelect
                  customers={customers}
                  value={form.customer_id}
                  onSelect={selectCustomer}
                  onAddNew={() => setShowAddCustomer(true)}
                  label={L.customer}
                />
                {!form.customer_id && (
                  <Input className="mt-2" placeholder="Or type customer name manually" value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
                )}
              </div>

              <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Add New Customer</DialogTitle></DialogHeader>
                  <div className="mt-2">
                    <CustomerForm onSave={handleAddCustomer} onCancel={() => setShowAddCustomer(false)} />
                  </div>
                </DialogContent>
              </Dialog>

              {docType !== "quotation" && (
                <div className="sm:col-span-2">
                  <Label>Local Purchase Order (LPO)</Label>
                  <Input value={form.lpo_number} onChange={e => setForm(f => ({ ...f, lpo_number: e.target.value }))} placeholder="e.g. LPO-2024-001" />
                </div>
              )}
              <div className="sm:col-span-1"><Label>{L.issueDate}</Label><Input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} /></div>
              {L.showDue && <div><Label>{L.dueDate}</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>}
              {docType === "invoice" && (
                <div className="sm:col-span-2">
                  <Label>Tax Identification Number (TIN)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={form.tax_number} onChange={e => setForm(f => ({ ...f, tax_number: e.target.value }))} placeholder="e.g. 1234567-0001" className="flex-1" />
                    {form.tax_number && form.tax_number === savedTaxNumber ? (
                      <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">✓ Saved</span>
                    ) : (
                      <button
                        type="button"
                        disabled={savingTaxNumber || !form.tax_number}
                        onClick={async () => {
                          setSavingTaxNumber(true);
                          await base44.auth.updateMe({ default_tax_number: form.tax_number });
                          setSavedTaxNumber(form.tax_number);
                          setSavingTaxNumber(false);
                          toast.success("TIN saved — it will auto-fill on new documents.");
                        }}
                        className="text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-full px-3 py-1 hover:bg-slate-50 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
                      >
                        {savingTaxNumber ? "Saving…" : "💾 Save"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Details — Invoice & Quotation only */}
          {((form.type || docType) === "invoice" || (form.type || docType) === "quotation") && (
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4 shadow-sm" style={{ borderLeft: `3px solid ${theme.accent}` }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: theme.light, border: `1px solid ${theme.border}` }}>💳</div>
                <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: theme.accent }}>Payment Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Method</Label>
                  <Select value={form.payment_method || "none"} onValueChange={v => setForm(f => ({ ...f, payment_method: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.payment_method === "Bank Transfer" && (
                <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bank Details</p>
                  <BankDetailsFields currency={form.currency} form={form} setForm={setForm} />
                  <div className="flex items-center gap-3 pt-1">
                    {savedBankDetails && form.bank_name === savedBankDetails.bank_name && form.account_number === savedBankDetails.account_number ? (
                      <span className="text-xs text-emerald-600 font-medium">✓ Using saved bank details</span>
                    ) : (
                      <button
                        type="button"
                        disabled={savingBankDetails || !form.bank_name || !form.account_number}
                        onClick={async () => {
                          setSavingBankDetails(true);
                          await base44.auth.updateMe({ default_bank_name: form.bank_name, default_account_number: form.account_number, default_account_holder_name: form.account_holder_name, default_bank_reference: form.reference_number, default_bank_swift: form.transaction_id });
                          setSavedBankDetails({ bank_name: form.bank_name, account_number: form.account_number, account_holder_name: form.account_holder_name });
                          setSavingBankDetails(false);
                          toast.success("Bank details saved — they'll auto-fill on new documents.");
                        }}
                        className="text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-full px-3 py-0.5 hover:bg-slate-50 transition-colors disabled:opacity-40"
                      >
                        {savingBankDetails ? "Saving…" : "💾 Save as default"}
                      </button>
                    )}
                    {savedBankDetails && (
                      <button
                        type="button"
                        onClick={async () => {
                          await base44.auth.updateMe({ default_bank_name: "", default_account_number: "", default_account_holder_name: "" });
                          setSavedBankDetails(null);
                          toast.success("Default bank details removed.");
                        }}
                        className="text-xs text-red-400 hover:text-red-600 hover:underline"
                      >
                        Remove default
                      </button>
                    )}
                  </div>
                </div>
              )}
              {form.payment_method === "POS" && (
                <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">POS Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Transaction ID</Label><Input value={form.transaction_id} onChange={e => setForm(f => ({ ...f, transaction_id: e.target.value }))} placeholder="e.g. TXN-0012345" /></div>
                    <div><Label>Terminal ID</Label><Input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="e.g. TID-001" /></div>
                  </div>
                </div>
              )}
              {form.payment_method === "Credit Card" && (
                <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Card Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Transaction ID</Label><Input value={form.transaction_id} onChange={e => setForm(f => ({ ...f, transaction_id: e.target.value }))} placeholder="e.g. TXN-0012345" /></div>
                    <div><Label>Last 4 Digits</Label><Input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="e.g. 4242" maxLength={4} /></div>
                  </div>
                </div>
              )}
              {form.payment_method === "Mobile Money" && (
                <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mobile Money Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Phone Number</Label><Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="e.g. 0812345678" /></div>
                    <div><Label>Transaction ID</Label><Input value={form.transaction_id} onChange={e => setForm(f => ({ ...f, transaction_id: e.target.value }))} placeholder="e.g. TXN-0012345" /></div>
                    <div className="col-span-2"><Label>Account Name</Label><Input value={form.account_holder_name} onChange={e => setForm(f => ({ ...f, account_holder_name: e.target.value }))} placeholder="e.g. John Doe" /></div>
                  </div>
                </div>
              )}
              {form.payment_method === "Cheque" && (
                <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cheque Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Cheque Number</Label><Input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="e.g. 000123" /></div>
                    <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="e.g. First Bank" /></div>
                    <div className="col-span-2"><Label>Account Holder Name</Label><Input value={form.account_holder_name} onChange={e => setForm(f => ({ ...f, account_holder_name: e.target.value }))} placeholder="e.g. John Doe" /></div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Waybill — Logistics Details */}
          {docType === "waybill" && (
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4 shadow-sm" style={{ borderLeft: `3px solid ${theme.accent}` }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: theme.light, border: `1px solid ${theme.border}` }}>🚚</div>
                <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: theme.accent }}>Logistics Details</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Driver Name</Label><Input value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} placeholder="e.g. John Doe" /></div>
                <div><Label>Vehicle Number</Label><Input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="e.g. LND-123-AB" /></div>
                <div className="col-span-2"><Label>Tracking Number</Label><Input value={form.tracking_number} onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))} placeholder="e.g. TRK-20240001" /></div>
              </div>
            </div>
          )}

          {/* Line Items */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm" style={{ borderLeft: `3px solid ${theme.accent}` }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: theme.light, border: `1px solid ${theme.border}` }}>📦</div>
              <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: theme.accent }}>{L.items}</h3>
            </div>
            <div className="hidden sm:grid grid-cols-12 gap-2 mb-1">
              <div className="col-span-1" />
              <div className="col-span-4 text-xs font-medium text-muted-foreground">{L.itemDesc}</div>
              <div className="col-span-2 text-xs font-medium text-muted-foreground">{L.itemQty}</div>
              {L.showPrices && <div className="col-span-2 text-xs font-medium text-muted-foreground">Unit Price</div>}
              {L.showDisc && <div className="col-span-2 text-xs font-medium text-muted-foreground">Disc %</div>}
            </div>
            <DragDropContext onDragEnd={({ source, destination }) => {
              if (!destination) return;
              const next = [...items];
              const [moved] = next.splice(source.index, 1);
              next.splice(destination.index, 0, moved);
              setItems(next);
            }}>
              <Droppable droppableId="line-items">
                {(provided) => (
                  <div className="space-y-3" ref={provided.innerRef} {...provided.droppableProps}>
                    {items.map((item, i) => (
                      <Draggable key={i} draggableId={`item-${i}`} index={i}>
                        {(drag) => (
                          <div ref={drag.innerRef} {...drag.draggableProps} className="select-none">
                            {/* Mobile card layout */}
                            <div className="sm:hidden bg-muted/30 rounded-lg p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <span {...drag.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground shrink-0"><GripVertical className="h-4 w-4" /></span>
                                <Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder={L.itemDesc} className="flex-1" />
                                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                              {L.showPrices ? (
                                <div className="grid grid-cols-3 gap-2">
                                  <div><Label className="text-xs text-muted-foreground">{L.itemQty}</Label><Input value={item.quantity} onChange={e => updateItem(i, "quantity", sanitizeNumeric(e.target.value))} onKeyDown={numericOnly} onFocus={e => e.target.select()} placeholder="0" className="mt-1" /></div>
                                  <div><Label className="text-xs text-muted-foreground">Unit Price</Label><Input value={item.unit_price} onChange={e => updateItem(i, "unit_price", sanitizeNumeric(e.target.value))} onKeyDown={numericOnly} onFocus={e => e.target.select()} placeholder="0" className="mt-1" /></div>
                                  <div><Label className="text-xs text-muted-foreground">Disc %</Label><Input value={item.discount} onChange={e => updateItem(i, "discount", sanitizeNumeric(e.target.value))} onKeyDown={numericOnly} onFocus={e => e.target.select()} placeholder="0" className="mt-1" /></div>
                                </div>
                              ) : (
                                <div><Label className="text-xs text-muted-foreground">{L.itemQty}</Label><Input value={item.quantity} onChange={e => updateItem(i, "quantity", sanitizeNumeric(e.target.value))} onKeyDown={numericOnly} onFocus={e => e.target.select()} placeholder="0" className="mt-1 w-28" /></div>
                              )}
                              {L.showPrices && (
                                <div className="text-right text-xs font-semibold text-foreground">{sym}{((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0) * (1 - (parseFloat(item.discount) || 0) / 100)).toLocaleString("en", { minimumFractionDigits: 2 })}</div>
                              )}
                            </div>
                            {/* Desktop row layout */}
                            <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-1 flex items-center"><span {...drag.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground"><GripVertical className="h-4 w-4" /></span></div>
                              <div className="col-span-4">
                                <Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder={L.itemDesc} />
                                {docType === "quotation" && (
                                  <div className="mt-1">
                                    {item.image_url ? (
                                      <div className="relative inline-block">
                                        <img src={item.image_url} alt="item" className="h-20 w-20 object-cover rounded-lg border border-border shadow-sm" />
                                        <button type="button" onClick={() => updateItem(i, "image_url", "")} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center">
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <label className="cursor-pointer flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                        {uploadingItemImg[i] ? <span className="text-xs animate-pulse">Uploading…</span> : <><ImagePlus className="h-3.5 w-3.5" /> Add image</>}
                                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleItemImageUpload(i, e.target.files[0])} />
                                      </label>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="col-span-2"><Input value={item.quantity} onChange={e => updateItem(i, "quantity", sanitizeNumeric(e.target.value))} onKeyDown={numericOnly} onFocus={e => e.target.select()} placeholder="0" /></div>
                              {L.showPrices && <div className="col-span-2"><Input value={item.unit_price} onChange={e => updateItem(i, "unit_price", sanitizeNumeric(e.target.value))} onKeyDown={numericOnly} onFocus={e => e.target.select()} placeholder="0" /></div>}
                              {L.showDisc && <div className="col-span-2"><Input value={item.discount} onChange={e => updateItem(i, "discount", sanitizeNumeric(e.target.value))} onKeyDown={numericOnly} onFocus={e => e.target.select()} placeholder="0" /></div>}
                              <div className="col-span-1">
                                <Button variant="ghost" size="icon" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setItems(p => [...p, { description: "", quantity: "", unit_price: "", discount: "" }])}>
              <Plus className="h-3 w-3 mr-1" /> Add Item
            </Button>
          </div>

          {/* Totals */}
          {docType !== "waybill" && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm" style={{ borderLeft: `3px solid ${theme.accent}` }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: theme.light, border: `1px solid ${theme.border}` }}>💰</div>
                <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: theme.accent }}>{docType === "receipt" ? "Payment Summary" : "Totals"}</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{sym}{calcs.subtotal.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
                {L.showDisc && (
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-muted-foreground font-normal">Global Discount %</Label>
                    <div className="flex items-center gap-2">
                      <Input className="w-20 h-8 text-xs" value={form.global_discount_rate} onChange={e => setForm(f => ({ ...f, global_discount_rate: sanitizeNumeric(e.target.value) }))} onKeyDown={numericOnly} onFocus={e => e.target.select()} placeholder="0" />
                      <span className="text-orange-600 text-xs w-24 text-right">-{sym}{calcs.globalDiscAmt.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
                {L.showTax && (
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-muted-foreground font-normal">VAT %</Label>
                    <div className="flex items-center gap-2">
                      <Input className="w-20 h-8 text-xs" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: sanitizeNumeric(e.target.value) }))} onKeyDown={numericOnly} onFocus={e => e.target.select()} placeholder="0" />
                      <span className="text-muted-foreground text-xs w-24 text-right">{sym}{calcs.taxAmt.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
                {L.showTax && docType !== "receipt" && (
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-muted-foreground font-normal">Shipping</Label>
                    <Input className="w-32 h-8 text-xs text-right" value={form.shipping} onChange={e => setForm(f => ({ ...f, shipping: sanitizeNumeric(e.target.value) }))} onKeyDown={numericOnly} onFocus={e => e.target.select()} placeholder="0" />
                  </div>
                )}
                {(docType === "invoice" || docType === "receipt") && (
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-muted-foreground font-normal">Withholding Tax %</Label>
                    <div className="flex items-center gap-2">
                      <Input className="w-20 h-8 text-xs" value={form.withholding_vat_rate} onChange={e => setForm(f => ({ ...f, withholding_vat_rate: sanitizeNumeric(e.target.value) }))} onKeyDown={numericOnly} onFocus={e => e.target.select()} placeholder="0" />
                      <span className="text-red-500 text-xs w-24 text-right">-{sym}{(calcs.withholdingVatAmt || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="font-bold text-muted-foreground">{docType === "receipt" ? "Gross Amount" : "Gross Total"}</span>
                  <span className="font-semibold">{sym}{calcs.total.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
                {(calcs.withholdingTaxAmt || 0) > 0 ? (
                  <div className="border-t-2 border-primary pt-3 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-lg">{docType === "receipt" ? "Amount Received" : "Net Payable"}</span>
                      <p className="text-xs text-muted-foreground">After Withholding Tax deduction</p>
                    </div>
                    <span className="text-xl font-black text-primary">{sym}{(calcs.netPayable || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                  </div>
                ) : (
                  <div className="border-t-2 border-primary pt-3 flex justify-between items-center">
                    <span className="font-bold text-lg">{docType === "receipt" ? "Amount Received" : "Total"}</span>
                    <span className="text-xl font-black text-primary">{sym}{calcs.total.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4 shadow-sm" style={{ borderLeft: `3px solid ${theme.accent}` }}>
            <div>
              <Label>{L.notes}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                placeholder={docType === "waybill" ? "e.g. Handle with care. Deliver between 9am–5pm." : docType === "receipt" ? "e.g. Thank you for your payment." : "e.g. Thanks for your business."} />
            </div>


          </div>

          {/* Primary Signature */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm" style={{ borderLeft: `3px solid ${theme.accent}` }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">{L.sig}</h3>
              {savedManagerSig && managerSig === savedManagerSig && (
                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">✓ Using saved signature</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">{L.sigDesc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 pb-4 border-b border-border">
              <div>
                <Label className="text-xs">Signatory Name</Label>
                <Input value={form.manager_name} onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))} placeholder="e.g. John Doe" className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Title / Position</Label>
                <Input value={form.manager_title} onChange={e => setForm(f => ({ ...f, manager_title: e.target.value }))} placeholder="e.g. Manager" className="mt-1 h-9 text-sm" />
              </div>
            </div>
            {managerSig ? (
              <div className="space-y-3">
                <div className="border border-border rounded-xl p-4 bg-gray-50">
                  <img src={managerSig} alt={L.sig} className="h-20 object-contain" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setManagerSig(null)} className="text-xs text-primary hover:underline">Re-sign</button>
                  {savedManagerSig !== managerSig && (
                    <button
                      disabled={savingDefaultSig}
                      onClick={async () => {
                        setSavingDefaultSig(true);
                        await base44.auth.updateMe({ manager_signature: managerSig });
                        setSavedManagerSig(managerSig);
                        setSavingDefaultSig(false);
                        toast.success("Signature saved as your default — it will appear on all new documents.");
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-full px-3 py-0.5 hover:bg-slate-50 transition-colors"
                    >
                      {savingDefaultSig ? "Saving…" : "💾 Save as default"}
                    </button>
                  )}
                  {savedManagerSig && managerSig === savedManagerSig && (
                    <button
                      onClick={async () => {
                        await base44.auth.updateMe({ manager_signature: "" });
                        setSavedManagerSig(null);
                        toast.success("Default signature removed.");
                      }}
                      className="text-xs text-red-400 hover:text-red-600 hover:underline"
                    >
                      Remove default
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Sign using your mouse, finger, or stylus. This will appear on the final document.</p>
                {savedManagerSig && (
                  <button
                    onClick={() => setManagerSig(savedManagerSig)}
                    className="flex items-center gap-2 text-xs text-primary border border-primary/30 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
                  >
                    <span>↩ Use my saved signature</span>
                    <img src={savedManagerSig} alt="Saved sig" className="h-6 object-contain opacity-70" />
                  </button>
                )}
                <SignaturePad label={L.sig} onSave={handleManagerSigSave} />
              </div>
            )}
          </div>

        </div>{/* end left column */}

        {/* ── Right sidebar: live preview + actions ── */}
        <div className="hidden md:block space-y-4">
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border" style={{ background: theme.gradient }}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-white">Live Preview</h3>
                <span className="text-xs text-white/60 capitalize font-medium">{theme.emoji} {typeLabels[docType]}</span>
              </div>
            </div>
            <div className="overflow-hidden" style={{ height: 460, width: "100%", position: "relative" }}>
              <div style={{ transform: "scale(0.40)", transformOrigin: "top left", width: 794, pointerEvents: "none", position: "absolute", top: 0, left: 0 }}>
                <DocumentPreview key={`${template}-${templateColor}-${templateFont}`} form={form} items={calcs.lineItems} calcs={calcs} sym={sym} docType={docType} template={template} templateColor={templateColor} templateFont={templateFont} />
              </div>
            </div>

          </div>

          <div className="bg-card rounded-2xl border border-border p-5 sticky top-8 shadow-sm">
            <div className="mb-3 pb-3 border-b border-border">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.accent }}>Actions</p>
            </div>
            <div className="space-y-2">
              <Button className="w-full text-white font-semibold" style={{ background: theme.gradient }} onClick={() => handleSave("draft")} disabled={saving || !form.customer_name}>
                {saving ? "Saving..." : (form.type || docType) === "waybill" ? "Save — To Be Delivered" : "Save as Draft"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleSave("sent")} disabled={saving || !form.customer_name}>
                Save &amp; Send
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setShowPdfPreview(true)}>
                <FileDown className="h-4 w-4 mr-1" />
                Preview &amp; Download PDF
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setShowPdfPreview(true)}>
                <Upload className="h-4 w-4 mr-1" />
                Share PDF
              </Button>

            </div>
          </div>
        </div>{/* end sidebar */}

      </div>{/* end grid */}

      {/* Mobile sticky bottom action bar */}
      <div
        className="md:hidden fixed left-0 right-0 z-50"
        style={{ bottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="bg-white/95 backdrop-blur-md border-t border-border shadow-[0_-4px_24px_rgba(0,0,0,0.10)] px-4 pt-3 pb-2">
          {/* Secondary actions row */}
          <div className="flex items-center gap-2 mb-2.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 h-9 text-sm font-medium"
              onClick={() => setShowPdfPreview(true)}
              disabled={saving}
            >
              <FileDown className="h-4 w-4" />
              Preview PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 h-9 text-sm font-medium"
              onClick={() => handleSave("draft")}
              disabled={saving || !form.customer_name}
            >
              {saving ? "Saving…" : (form.type || docType) === "waybill" ? "Save Pending" : "Save Draft"}
            </Button>
          </div>
          {/* Primary full-width button */}
          <Button
            className="w-full h-11 text-[15px] font-semibold rounded-xl shadow-sm"
            onClick={() => handleSave("sent")}
            disabled={saving || !form.customer_name}
          >
            {saving ? "Saving…" : "Save Document"}
          </Button>
        </div>
      </div>

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full shadow-xl space-y-4">
            <div>
              <h3 className="font-bold text-lg">Leave this page?</h3>
              <p className="text-sm text-muted-foreground mt-1">You have unsaved changes. What would you like to do?</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={async () => {
                setShowLeaveModal(false);
                setIsDirty(false);
                await handleSave("draft");
                if (pendingNav) navigate(pendingNav);
              }}>
                {(form.type || docType) === "waybill" ? "Save as Pending & Leave" : "Save as Draft & Leave"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => {
                setShowLeaveModal(false);
                setIsDirty(false);
                if (pendingNav) navigate(pendingNav);
                else navigate(-1);
              }}>
                Discard &amp; Leave
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => {
                setShowLeaveModal(false);
                setPendingNav(null);
                // Re-push the guard state so back button is still trapped
                window.history.pushState({ interceptBack: true }, "");
              }}>
                Keep Editing
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "radial-gradient(ellipse at 60% 40%, #0d1117 0%, #080b14 60%, #050709 100%)" }} onClick={() => setShowPdfPreview(false)}>

          {/* ── Left panel: design controls ── */}
          <div className="shrink-0 flex flex-col h-full overflow-hidden" style={{ width: 190, background: "linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%)" }} onClick={e => e.stopPropagation()}>
            {/* Panel header */}
            <div className="px-3 pt-4 pb-2.5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs font-bold text-white tracking-wide">Design</span>
              </div>
            </div>

            {/* Layout section */}
            <div className="px-3 pt-3 pb-2 shrink-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 mb-2">Layout</p>
              <div className="flex gap-1.5">
                {Object.values(LAYOUTS).map(l => (
                  <button key={l.id} onClick={() => setTemplate(l.id)} title={l.name}
                    className="flex flex-col items-center gap-1 flex-1 group">
                    <div className={`rounded overflow-hidden transition-all w-full ${template === l.id ? "ring-2 ring-indigo-400" : "opacity-50 hover:opacity-80"}`}
                      style={{ aspectRatio: "3/4", background: "#fff" }}>
                      <LayoutThumb id={l.id} accentColor={COLOR_SCHEMES[templateColor]?.swatch} />
                    </div>
                    <span className={`text-[8px] font-semibold leading-none ${template === l.id ? "text-indigo-300" : "text-white/40"}`}>{l.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-3 border-t border-white/10 shrink-0" />

            {/* Colour section */}
            <div className="px-3 pt-2.5 pb-2 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">Colour</p>
                <p className="text-[9px] text-indigo-300 font-semibold">{COLOR_SCHEMES[templateColor]?.name}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(COLOR_SCHEMES).map(c => (
                  <button key={c.id} onClick={() => setTemplateColor(c.id)} title={c.name}
                    className={`w-4 h-4 rounded-full border-2 transition-all hover:scale-110 ${templateColor === c.id ? "border-white scale-125 shadow-lg shadow-white/20" : "border-transparent"}`}
                    style={{ background: c.swatch }} />
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-3 border-t border-white/10 shrink-0" />

            {/* Action buttons */}
            <div className="px-3 pt-2.5 pb-3 space-y-2 shrink-0">
              <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1.5" onClick={handleDownloadPdf} disabled={generatingPdf}>
                <FileDown className="h-3.5 w-3.5" />
                {generatingPdf ? "Generating…" : "Download PDF"}
              </Button>
              <Button size="sm" variant="outline" className="w-full text-xs font-semibold border-white/20 text-white/80 hover:bg-white/10 hover:text-white gap-1.5 bg-transparent" onClick={handleSharePdf} disabled={generatingPdf}>
                <Upload className="h-3.5 w-3.5" />
                {generatingPdf ? "Generating…" : "Share PDF"}
              </Button>
            </div>
          </div>

          {/* ── Right: preview area ── */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ position: "relative" }} onClick={e => e.stopPropagation()}>

            {/* Subtle dot-grid background texture */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(99,102,241,0.07) 1px, transparent 1px)", backgroundSize: "28px 28px", pointerEvents: "none" }} />

            {/* Ambient glow behind doc */}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 700, background: "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

            {/* Top bar */}
            <div className="shrink-0 flex items-center justify-between px-5 py-3 relative z-10" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-3">
                {/* Doc type badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.25)" }}>
                  <span>{(typeLabels[form.type || docType] || "Document").toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-white/80 font-semibold text-sm leading-tight">{form.number || "Draft"}</p>
                  {form.customer_name && <p className="text-white/30 text-[11px]">for {form.customer_name}</p>}
                </div>
              </div>
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all text-base leading-none" style={{ border: "1px solid rgba(255,255,255,0.1)" }} onClick={() => setShowPdfPreview(false)}>✕</button>
            </div>

            {/* Waybill sign banners */}
            {(form.type || docType) === "waybill" && pdfMode === "soft" && !customerSig && (
              <div className="shrink-0 relative z-10 flex items-center justify-between px-5 py-2.5" style={{ background: "rgba(5,150,105,0.85)", backdropFilter: "blur(8px)" }}>
                <div className="flex items-center gap-2 text-white">
                  <PenLine className="h-4 w-4" />
                  <span className="font-bold text-sm">Receiver Signature Required</span>
                </div>
                <button onClick={() => setShowInlineSigPad(true)} className="bg-white text-emerald-700 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-1.5">
                  <PenLine className="h-3.5 w-3.5" /> Sign Here
                </button>
              </div>
            )}
            {(form.type || docType) === "waybill" && pdfMode === "soft" && customerSig && (
              <div className="shrink-0 relative z-10 flex items-center justify-between px-5 py-2.5" style={{ background: "rgba(4,120,87,0.85)", backdropFilter: "blur(8px)" }}>
                <div className="flex items-center gap-2 text-white">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <span className="font-bold text-sm">Document Signed</span>
                </div>
                <button onClick={() => setShowInlineSigPad(true)} className="text-xs text-emerald-200 hover:text-white underline">Re-sign</button>
              </div>
            )}

            {/* Document stage */}
            <div className="flex-1 overflow-y-auto relative z-10" style={{ padding: "0" }}>
              {/* Document with layered shadow for depth */}
              <div style={{ position: "relative", width: "100%" }}>
                {/* Back page shadow layers for paper stack illusion */}
                <div style={{ position: "absolute", bottom: -6, left: 6, right: -6, height: "100%", background: "rgba(255,255,255,0.04)", borderRadius: 0, border: "1px solid rgba(255,255,255,0.06)" }} />
                <div style={{ position: "absolute", bottom: -3, left: 3, right: -3, height: "100%", background: "rgba(255,255,255,0.07)", borderRadius: 0, border: "1px solid rgba(255,255,255,0.08)" }} />
                {/* Main doc */}
                <div style={{ width: 794 * pdfModalScale, height: 1123 * pdfModalScale, overflow: "hidden", borderRadius: 0, boxShadow: "0 20px 60px rgba(0,0,0,0.7)", position: "relative" }}>
                  <div style={{ width: 794, height: 1123, transformOrigin: "top left", transform: `scale(${pdfModalScale})` }}>
                    <div ref={pdfRef} style={{ width: 794 }}>
                      <DocumentPreview
                        form={form}
                        items={calcs.lineItems}
                        calcs={calcs}
                        sym={sym}
                        docType={form.type || docType}
                        managerSig={managerSig}
                        customerSig={(form.type || docType) === "waybill" && pdfMode === "paper" ? "" : customerSig}
                        template={template}
                        templateColor={templateColor}
                        templateFont={templateFont}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Inline Receiver Signature Overlay (waybill soft signage) */}
          {showInlineSigPad && (
            <div className="fixed inset-0 z-[60] flex flex-col bg-black/80" onClick={() => { setShowInlineSigPad(false); setSigStep("info"); }}>
              <div className="mt-auto bg-white rounded-t-3xl shadow-2xl" style={{ maxHeight: "92dvh" }} onClick={e => e.stopPropagation()}>
                <div className="bg-slate-900 text-white px-6 py-5 rounded-t-3xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <PenLine className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <h2 className="font-bold text-base">Receiver Signature</h2>
                        <p className="text-xs text-slate-400">{form.number || "Draft"} · {form.customer_name || "Receiver"}</p>
                      </div>
                    </div>
                    <button onClick={() => { setShowInlineSigPad(false); setSigStep("info"); }} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                      <span className="text-lg leading-none">✕</span>
                    </button>
                  </div>
                </div>
                {sigStep === "info" && (
                  <div className="p-5 space-y-4 overflow-y-auto">
                    <div>
                      <Label className="text-sm font-semibold">Receiver Full Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={receiverName}
                        onChange={e => setReceiverName(e.target.value)}
                        placeholder="Enter receiver's full name"
                        className="mt-1.5 h-11 text-base"
                        autoFocus
                      />
                    </div>
                    <Button
                      className="w-full h-12 text-base font-bold bg-slate-900 hover:bg-slate-800 gap-2"
                      disabled={!receiverName.trim()}
                      onClick={() => setSigStep("sign")}
                    >
                      <PenLine className="h-5 w-5" /> Proceed to Sign
                    </Button>
                  </div>
                )}
                {sigStep === "sign" && (
                  <div className="p-5 overflow-y-auto">
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 mb-4">
                      <p className="text-sm font-bold text-slate-800">{receiverName}</p>
                      <p className="text-xs text-slate-400">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 text-center">Sign below using your finger, mouse, or stylus.</p>
                    <SignaturePad label="Receiver Signature" onSave={handleSoftSigSave} />
                    <button onClick={() => setSigStep("info")} className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors py-3">← Back to receiver details</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}