import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ImageIcon, Building2, FileText, Hash, User, Save, Upload, X, CheckCircle2, AlertTriangle, Paintbrush } from "lucide-react";
import DocumentDesign from "./settings/DocumentDesign";
import SignaturePad from "../components/SignaturePad";
import CurrencySelector from "../components/CurrencySelector";

const TABS = [
  { id: "company",   label: "Company",   icon: Building2,  emoji: "🏢" },
  { id: "documents", label: "Documents", icon: FileText,   emoji: "📄" },
  { id: "numbering", label: "Numbering", icon: Hash,       emoji: "#️⃣" },
  { id: "account",   label: "Account",   icon: User,       emoji: "👤" },
  { id: "design",    label: "Design",    icon: Paintbrush, emoji: "🎨" },
];

const ACCENT = { gradient: "linear-gradient(135deg,#6366f1 0%,#4f46e5 60%,#3730a3 100%)", glow: "rgba(99,102,241,0.25)", accent: "#6366f1", light: "#eef2ff", border: "#c7d2fe" };

function Section({ title, emoji, children }) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2.5" style={{ borderLeft: `3px solid ${ACCENT.accent}` }}>
        <span className="text-lg">{emoji}</span>
        <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: ACCENT.accent }}>{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function Settings() {
  const logoInputRef = useRef(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("company");
  const [managerSig, setManagerSig] = useState(null);
  const [savedManagerSig, setSavedManagerSig] = useState(null);
  const [savedForm, setSavedForm] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const navigate = useNavigate();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingNav, setPendingNav] = useState(null);
  const [form, setForm] = useState({
    company_name: "",
    company_email: "",
    company_phone: "",
    company_address: "",
    company_website: "",
    logo_url: "",
    default_currency: "NGN",
    default_tax_rate: 7.5,
    default_terms: "",
    default_payment_instructions: "",
    document_tagline: "",
    footer_contact_line: "",
    company_abbreviation: "",
    prefix_invoice: "INV",
    prefix_quotation: "QUO",
    prefix_receipt: "REC",
    prefix_waybill: "WB",
    manager_name: "",
    manager_title: "",
    default_bank_name: "",
    default_account_number: "",
    default_account_holder_name: "",
  });

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user) {
        setUserInfo(user);
        const loaded = {
          company_name: user.company_name || "",
          company_email: user.company_email || user.email || "",
          company_phone: user.company_phone || "",
          company_address: user.company_address || "",
          company_website: user.company_website || "",
          logo_url: user.logo_url || "",
          default_currency: user.default_currency || "NGN",
          default_tax_rate: user.default_tax_rate ?? 7.5,
          default_terms: user.default_terms || "",
          default_payment_instructions: user.default_payment_instructions || "",
          document_tagline: user.document_tagline || "",
          footer_contact_line: user.footer_contact_line || "",
          company_abbreviation: user.company_abbreviation || "",
          prefix_invoice: user.prefix_invoice || "INV",
          prefix_quotation: user.prefix_quotation || "QUO",
          prefix_receipt: user.prefix_receipt || "REC",
          prefix_waybill: user.prefix_waybill || "WB",
          manager_name: user.manager_name || user.full_name || "",
          manager_title: user.manager_title || "",
          default_bank_name: user.default_bank_name || "",
          default_account_number: user.default_account_number || "",
          default_account_holder_name: user.default_account_holder_name || "",
        };
        setForm(loaded);
        setSavedForm(loaded);
        if (user.logo_url) setLogoPreview(user.logo_url);
        if (user.manager_signature) {
          setManagerSig(user.manager_signature);
          setSavedManagerSig(user.manager_signature);
        }
      }
    });
  }, []);

  const isDirty = savedForm !== null && (
    JSON.stringify(form) !== JSON.stringify(savedForm) ||
    managerSig !== savedManagerSig
  );

  // Block browser refresh / tab close
  useEffect(() => {
    const handler = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Intercept in-app link clicks (sidebar, nav) when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handleClick = (e) => {
      const anchor = e.target.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto") || href.startsWith("#")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNav(href);
      setShowLeaveModal(true);
    };
    // Intercept browser back/forward
    const handlePop = (e) => {
      if (isDirty) {
        window.history.pushState(null, "", window.location.href);
        setPendingNav(-1);
        setShowLeaveModal(true);
      }
    };
    window.history.pushState(null, "", window.location.href);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePop);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePop);
    };
  }, [isDirty]);

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Reset input so the same file can be re-selected after a failure
    e.target.value = "";
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file is too large. Please use an image under 5MB.");
      return;
    }
    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, logo_url: file_url }));
      toast.success("Logo uploaded successfully!");
    } catch (err) {
      setLogoPreview(null);
      toast.error("Logo upload failed. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const uploadSig = async (dataUrl) => {
    const [header, data] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const file = new File([arr], "signature.png", { type: mime });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  const handleSigSave = async (dataUrl) => {
    const url = await uploadSig(dataUrl);
    setManagerSig(url);
  };

  const save = async () => {
    setSaving(true);
    const payload = { ...form };
    if (managerSig) payload.manager_signature = managerSig;
    await base44.auth.updateMe(payload);
    // Filter by current user's email to only update OWN documents
    const me = await base44.auth.me();
    const docs = await base44.entities.Document.filter({ created_by_id: me.id }, "-created_date", 500);
    await Promise.all(docs.map(doc =>
      base44.entities.Document.update(doc.id, {
        logo_url: form.logo_url,
        company_name: form.company_name,
        company_email: form.company_email,
        company_phone: form.company_phone,
        company_address: form.company_address,
        company_website: form.company_website,
      })
    ));
    setSavedManagerSig(managerSig);
    setSavedForm({ ...form });
    setSaving(false);
    toast.success("Settings saved and applied to all documents");
  };

  const discard = () => {
    if (savedForm) setForm({ ...savedForm });
    setManagerSig(savedManagerSig);
    toast("Changes discarded");
  };

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const prefixes = [form.prefix_invoice, form.prefix_quotation, form.prefix_receipt, form.prefix_waybill].filter(Boolean);
  const hasDuplicatePrefixes = prefixes.length !== new Set(prefixes).size;

  if (activeTab === "design") {
    return (
      <div className="w-full -mx-4 md:-mx-6 lg:-mx-8 -my-4 md:-my-6 lg:-my-8" style={{ height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
        {/* Mini banner for design tab */}
        <div className="px-6 py-4 flex items-center gap-3 border-b border-border bg-white shrink-0">
          <div className="flex gap-1 bg-muted/60 p-1 rounded-xl overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    active ? "bg-white text-indigo-700 shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/50"
                  }`}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.emoji}</span>
                </button>
              );
            })}
          </div>
          <span className="text-xs text-muted-foreground hidden md:block">Customise how your documents look</span>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <DocumentDesign />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl w-full pb-20 md:pb-0">
      {/* Hero banner */}
      <div
        className="relative rounded-3xl overflow-hidden px-6 py-7 mb-7"
        style={{ background: ACCENT.gradient, boxShadow: `0 8px 40px ${ACCENT.glow}` }}
      >
        <div className="absolute -top-8 -right-10 w-52 h-52 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-10 -left-6 w-36 h-36 rounded-full bg-black/10 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Configuration</p>
          <h1 className="text-2xl font-bold text-white">⚙️ Settings</h1>
          <p className="text-white/60 text-sm mt-1">Manage your company profile and document preferences</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/60 p-1 rounded-2xl mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-1 justify-center ${
                active
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.emoji}</span>
            </button>
          );
        })}
      </div>

      {/* ── Company Tab ── */}
      {activeTab === "company" && (
        <div className="space-y-5">
          <Section title="Company Logo" emoji="🖼️">
            <div className="flex items-start gap-5">
              <div
                onClick={() => logoInputRef.current?.click()}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden bg-indigo-50/50 flex-shrink-0 hover:border-indigo-400 hover:bg-indigo-50"
                style={{ borderColor: logoPreview ? ACCENT.accent : undefined }}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center text-muted-foreground p-2">
                    <ImageIcon className="h-7 w-7 mx-auto mb-1 text-indigo-300" />
                    <p className="text-xs">Upload</p>
                  </div>
                )}
              </div>
              <div className="text-sm text-muted-foreground space-y-2 pt-1">
                <p className="font-medium text-foreground">Company Logo</p>
                <p className="text-xs">Appears on all invoices, quotations, receipts and waybills.</p>
                <p className="text-xs text-muted-foreground">PNG with transparent background, min 200×200px recommended.</p>
                {uploadingLogo && <p className="text-indigo-600 text-xs animate-pulse">⏳ Uploading…</p>}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload Logo
                  </button>
                  {logoPreview && (
                    <button
                      onClick={() => { setLogoPreview(null); setForm(f => ({ ...f, logo_url: "" })); }}
                      className="flex items-center gap-1.5 text-xs text-destructive border border-destructive/20 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                </div>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
          </Section>

          <Section title="Company Information" emoji="🏢">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Company Name</Label><Input className="mt-1" value={form.company_name} onChange={e => update("company_name", e.target.value)} placeholder="e.g. Acme Ltd" /></div>
              <div><Label>Business Email</Label><Input className="mt-1" type="email" value={form.company_email} onChange={e => update("company_email", e.target.value)} placeholder="e.g. admin@acme.com" /></div>
              <div><Label>Phone Number</Label><Input className="mt-1" value={form.company_phone} onChange={e => update("company_phone", e.target.value)} placeholder="e.g. +234 800 000 0000" /></div>
              <div><Label>Website</Label><Input className="mt-1" value={form.company_website} onChange={e => update("company_website", e.target.value)} placeholder="e.g. www.acme.com" /></div>
              <div className="sm:col-span-2">
                <Label>Business Address</Label>
                <Textarea className="mt-1" value={form.company_address} onChange={e => update("company_address", e.target.value)} rows={3} placeholder="Full registered business address" />
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── Documents Tab ── */}
      {activeTab === "documents" && (
        <div className="space-y-5">
          <Section title="Financial Defaults" emoji="💰">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Default Currency</Label>
                <CurrencySelector value={form.default_currency} onValueChange={v => update("default_currency", v)} className="mt-1" />
              </div>
              <div>
                <Label>Default VAT / Tax Rate (%)</Label>
                <Input className="mt-1" type="number" min="0" max="100" value={form.default_tax_rate} onChange={e => update("default_tax_rate", +e.target.value)} placeholder="e.g. 7.5" />
              </div>
            </div>
          </Section>

          <Section title="Default Bank Account" emoji="🏦">
            <p className="text-xs text-muted-foreground mb-4">Auto-fills on new invoices and quotations when Bank Transfer is selected.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Bank Name</Label><Input className="mt-1" value={form.default_bank_name} onChange={e => update("default_bank_name", e.target.value)} placeholder="e.g. First Bank" /></div>
              <div><Label>Account Number</Label><Input className="mt-1" value={form.default_account_number} onChange={e => update("default_account_number", e.target.value)} placeholder="e.g. 0123456789" /></div>
              <div className="sm:col-span-2"><Label>Account Holder Name</Label><Input className="mt-1" value={form.default_account_holder_name} onChange={e => update("default_account_holder_name", e.target.value)} placeholder="e.g. Acme Limited" /></div>
            </div>
          </Section>

          <Section title="Document Content Defaults" emoji="📝">
            <div className="space-y-4">

              <div>
                <Label>Default Terms &amp; Conditions</Label>
                <p className="text-xs text-muted-foreground mb-1.5">Pre-filled in the Terms field on every new document.</p>
                <Textarea value={form.default_terms} onChange={e => update("default_terms", e.target.value)} rows={3} placeholder="e.g. Payment is due within 14 days of invoice date. Late payments may incur a 1.5% monthly fee." />
              </div>
              <div>
                <Label>Footer Contact Line</Label>
                <p className="text-xs text-muted-foreground mb-1.5">Shown at the very bottom of every document.</p>
                <Input value={form.footer_contact_line} onChange={e => update("footer_contact_line", e.target.value)} placeholder="e.g. 07423182811  ·  admin@example.org  ·  www.example.com" />
              </div>
              <div>
                <Label>Document Tagline</Label>
                <p className="text-xs text-muted-foreground mb-1.5">A short closing sentence on every document.</p>
                <Input value={form.document_tagline} onChange={e => update("document_tagline", e.target.value)} placeholder="e.g. Thank you for your business!" />
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── Numbering Tab ── */}
      {activeTab === "numbering" && (
        <div className="space-y-5">
          <Section title="Document Number Format" emoji="#️⃣">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-5">
              <p className="text-sm text-indigo-800 font-medium mb-1">Number Format</p>
              <p className="font-mono text-lg font-bold text-indigo-700">
                {form.company_abbreviation || "DR"}-{form.prefix_invoice || "INV"}-0001
              </p>
              <p className="text-xs text-indigo-500 mt-1">Company Abbreviation · Type Prefix · Sequence</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Company Abbreviation</Label>
                <p className="text-xs text-muted-foreground mb-1">Short code for your business (appears before every document number).</p>
                <Input
                  value={form.company_abbreviation}
                  onChange={e => update("company_abbreviation", e.target.value.toUpperCase())}
                  placeholder="e.g. DR"
                  className="font-mono uppercase max-w-xs"
                />
              </div>
              <div>
                <Label>📄 Invoice Prefix</Label>
                <Input className="mt-1 font-mono" value={form.prefix_invoice} onChange={e => update("prefix_invoice", e.target.value.toUpperCase())} placeholder="INV" />
                <p className="text-xs text-muted-foreground mt-1">Preview: <span className="font-mono font-semibold text-indigo-600">{form.company_abbreviation ? `${form.company_abbreviation}-` : ""}{form.prefix_invoice}-0001</span></p>
              </div>
              <div>
                <Label>📋 Quotation Prefix</Label>
                <Input className="mt-1 font-mono" value={form.prefix_quotation} onChange={e => update("prefix_quotation", e.target.value.toUpperCase())} placeholder="QUO" />
                <p className="text-xs text-muted-foreground mt-1">Preview: <span className="font-mono font-semibold text-purple-600">{form.company_abbreviation ? `${form.company_abbreviation}-` : ""}{form.prefix_quotation}-0001</span></p>
              </div>
              <div>
                <Label>🧾 Receipt Prefix</Label>
                <Input className="mt-1 font-mono" value={form.prefix_receipt} onChange={e => update("prefix_receipt", e.target.value.toUpperCase())} placeholder="REC" />
                <p className="text-xs text-muted-foreground mt-1">Preview: <span className="font-mono font-semibold text-emerald-600">{form.company_abbreviation ? `${form.company_abbreviation}-` : ""}{form.prefix_receipt}-0001</span></p>
              </div>
              <div>
                <Label>🚚 Waybill Prefix</Label>
                <Input className="mt-1 font-mono" value={form.prefix_waybill} onChange={e => update("prefix_waybill", e.target.value.toUpperCase())} placeholder="WB" />
                <p className="text-xs text-muted-foreground mt-1">Preview: <span className="font-mono font-semibold text-amber-600">{form.company_abbreviation ? `${form.company_abbreviation}-` : ""}{form.prefix_waybill}-0001</span></p>
              </div>
            </div>
            {hasDuplicatePrefixes && (
              <p className="text-xs text-red-500 mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">⚠ Each document type prefix must be unique across all document types.</p>
            )}
          </Section>
        </div>
      )}

      {/* ── Account Tab ── */}
      {activeTab === "account" && (
        <div className="space-y-5">
          <Section title="Manager / Signatory Details" emoji="👤">
            <p className="text-xs text-muted-foreground mb-4">This information auto-fills the signatory section on all new documents.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Full Name</Label><Input className="mt-1" value={form.manager_name} onChange={e => update("manager_name", e.target.value)} placeholder="e.g. John Doe" /></div>
              <div><Label>Title / Position</Label><Input className="mt-1" value={form.manager_title} onChange={e => update("manager_title", e.target.value)} placeholder="e.g. General Manager" /></div>
            </div>
          </Section>

          <Section title="Default Signature" emoji="✍️">
            <p className="text-xs text-muted-foreground mb-4">Your saved signature auto-fills on all new documents. You can always re-sign on individual documents.</p>
            {managerSig ? (
              <div className="space-y-3">
                <div className="border border-border rounded-2xl p-4 bg-slate-50 inline-block">
                  <img src={managerSig} alt="Signature" className="h-20 object-contain" />
                </div>
                {savedManagerSig === managerSig && (
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Signature saved to your account
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setManagerSig(null)} className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors">Re-sign</button>
                  <button onClick={() => { setManagerSig(null); setSavedManagerSig(null); }} className="text-xs text-destructive border border-destructive/20 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">Remove signature</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Draw your signature below using mouse, finger, or stylus.</p>
                <SignaturePad label="Manager Signature" onSave={handleSigSave} />
              </div>
            )}
          </Section>

          <Section title="Account Info" emoji="🔑">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Full Name</span>
                <span className="font-medium text-foreground">{userInfo?.full_name || "—"}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Login Email</span>
                <span className="font-medium text-foreground">{userInfo?.email || "—"}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Company</span>
                <span className="font-medium text-foreground">{form.company_name || "—"}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Plan</span>
                <span className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">✨ Active</span>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Save button */}
      <div className="mt-6 flex items-center justify-between gap-4 bg-card rounded-2xl border border-border p-4 shadow-sm">
        <p className="text-sm text-muted-foreground hidden sm:block">
          {isDirty ? <span className="text-amber-600 font-medium">⚠ You have unsaved changes</span> : "Changes apply to all existing documents."}
        </p>
        <div className="flex gap-2 w-full sm:w-auto">
          {isDirty && (
            <Button variant="outline" onClick={discard} className="flex-1 sm:flex-none">
              Discard
            </Button>
          )}
          <Button
            onClick={save}
            disabled={saving || hasDuplicatePrefixes}
            className="flex-1 sm:flex-none gap-2 font-bold px-8"
            style={{ background: isDirty ? "linear-gradient(135deg,#f59e0b,#d97706)" : ACCENT.gradient }}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-base">Unsaved Changes</h3>
                <p className="text-sm text-muted-foreground mt-0.5">You have changes that haven't been saved yet. What would you like to do?</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full gap-2 font-bold"
                style={{ background: ACCENT.gradient }}
                onClick={async () => {
                  setShowLeaveModal(false);
                  await save();
                  if (pendingNav === -1) navigate(-1);
                  else if (pendingNav) navigate(pendingNav);
                }}
              >
                <Save className="h-4 w-4" /> Save then Leave
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowLeaveModal(false);
                  discard();
                  if (pendingNav === -1) navigate(-1);
                  else if (pendingNav) navigate(pendingNav);
                }}
              >
                Discard then Leave
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => { setShowLeaveModal(false); setPendingNav(null); }}
              >
                Keep Editing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}