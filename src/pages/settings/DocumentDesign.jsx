import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import DocumentPreview from "../../components/DocumentPreview";
import {
  Save, ZoomIn, ZoomOut, Monitor, Tablet, Smartphone, ChevronDown, ChevronUp,
  Palette, Type, Layout, Sparkles, CheckCircle2, Copy, Trash2, Star,
  RotateCcw, Download, Upload, Eye
} from "lucide-react";

// ─── FONTS ────────────────────────────────────────────────────────────────────
const FONTS = [
  { id: "inter",     label: "Inter",        css: "'Inter', sans-serif",          pair: "Clean & modern" },
  { id: "poppins",   label: "Poppins",      css: "'Poppins', sans-serif",         pair: "Rounded & friendly" },
  { id: "playfair",  label: "Playfair",     css: "'Playfair Display', serif",     pair: "Editorial & elegant" },
  { id: "roboto",    label: "Roboto",       css: "'Roboto', sans-serif",          pair: "Neutral & versatile" },
  { id: "merriweather", label: "Merriweather", css: "'Merriweather', serif",      pair: "Traditional & trustworthy" },
  { id: "montserrat", label: "Montserrat",  css: "'Montserrat', sans-serif",      pair: "Bold & corporate" },
  { id: "lato",      label: "Lato",         css: "'Lato', sans-serif",            pair: "Humanist & readable" },
  { id: "georgia",   label: "Georgia",      css: "Georgia, serif",                pair: "Classic & prestigious" },
];

// ─── COLOR PALETTES ────────────────────────────────────────────────────────────
const COLOR_PALETTES = [
  { id: "slate",   label: "Slate",      accent: "#334155", text: "#1e293b",  bg: "#f8fafc", swatch: "#334155" },
  { id: "indigo",  label: "Indigo",     accent: "#4f46e5", text: "#1e1b4b",  bg: "#eef2ff", swatch: "#4f46e5" },
  { id: "blue",    label: "Ocean",      accent: "#2563eb", text: "#1e3a5f",  bg: "#eff6ff", swatch: "#2563eb" },
  { id: "emerald", label: "Emerald",    accent: "#059669", text: "#064e3b",  bg: "#ecfdf5", swatch: "#059669" },
  { id: "rose",    label: "Rose",       accent: "#e11d48", text: "#4c0519",  bg: "#fff1f2", swatch: "#e11d48" },
  { id: "amber",   label: "Amber",      accent: "#d97706", text: "#451a03",  bg: "#fffbeb", swatch: "#d97706" },
  { id: "purple",  label: "Plum",       accent: "#7c3aed", text: "#2e1065",  bg: "#f5f3ff", swatch: "#7c3aed" },
  { id: "teal",    label: "Teal",       accent: "#0d9488", text: "#042f2e",  bg: "#f0fdfa", swatch: "#0d9488" },
  { id: "gold",    label: "Gold",       accent: "#b45309", text: "#3b1a08",  bg: "#fefce8", swatch: "#b45309" },
  { id: "charcoal",label: "Charcoal",   accent: "#111827", text: "#111827",  bg: "#f9fafb", swatch: "#111827" },
];

// ─── LAYOUT TEMPLATES ─────────────────────────────────────────────────────────
const LAYOUT_TEMPLATES = [
  { id: "classic",  label: "Classic" },
  { id: "modern",   label: "Modern" },
  { id: "minimal",  label: "Minimal" },
  { id: "bold",     label: "Bold" },
  { id: "elegant",  label: "Elegant" },
];

// ─── PRESETS (named combos) ────────────────────────────────────────────────────
const PRESETS = [
  { id: "modern_pro",   label: "Modern Professional", template: "modern",  color: "slate",    font: "inter",       emoji: "💼" },
  { id: "executive",    label: "Executive Report",    template: "classic", color: "charcoal", font: "merriweather", emoji: "🏛️" },
  { id: "creative",     label: "Creative Portfolio",  template: "modern",  color: "indigo",   font: "poppins",     emoji: "🎨" },
  { id: "corporate",    label: "Corporate Premium",   template: "bold",    color: "slate",    font: "montserrat",  emoji: "🏢" },
  { id: "minimalist",   label: "Minimalist",          template: "minimal", color: "slate",    font: "lato",        emoji: "⬜" },
  { id: "elegant_biz",  label: "Elegant Business",    template: "elegant", color: "gold",     font: "playfair",    emoji: "✨" },
  { id: "startup",      label: "Startup Pitch",       template: "modern",  color: "purple",   font: "poppins",     emoji: "🚀" },
  { id: "magazine",     label: "Modern Magazine",     template: "bold",    color: "rose",     font: "montserrat",  emoji: "📰" },
  { id: "clean_tech",   label: "Clean Technical",     template: "minimal", color: "blue",     font: "roboto",      emoji: "🔧" },
  { id: "eco",          label: "Natural & Fresh",     template: "modern",  color: "emerald",  font: "lato",        emoji: "🌿" },
];

// ─── SAMPLE DOCUMENT FOR PREVIEW ──────────────────────────────────────────────
const SAMPLE = {
  type: "invoice", number: "INV-0001", status: "draft",
  customer_name: "Acme Corporation", customer_address: "123 Business Ave, Lagos",
  customer_email: "accounts@acme.com",
  issue_date: new Date().toISOString(),
  due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
  items: [
    { description: "Web Design & Development", quantity: 1, unit_price: 150000, amount: 150000 },
    { description: "SEO Optimization Package", quantity: 1, unit_price: 75000, amount: 75000 },
    { description: "Monthly Maintenance", quantity: 3, unit_price: 25000, amount: 75000 },
  ],
  subtotal: 300000, tax_rate: 7.5, tax_amount: 22500, total: 322500, balance_due: 322500,
  currency: "NGN", shipping: 0, global_discount_amount: 0,
  company_name: "Your Company", company_address: "Victoria Island, Lagos",
  company_phone: "+234 800 000 0000", company_email: "info@yourcompany.com",
  bank_name: "First Bank", account_number: "0123456789", account_holder_name: "Your Company Ltd",
};

const ZOOM_LEVELS = [0.5, 0.65, 0.75, 1, 1.1, 1.25];
const ZOOM_LABELS = ["50%", "65%", "75%", "100%", "110%", "125%"];

function AccordionSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2.5 font-semibold text-sm">
          <Icon className="h-4 w-4 text-indigo-500" />
          {title}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function ColorSwatch({ palette, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      title={palette.label}
      className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${selected ? "border-foreground scale-110 shadow-md" : "border-transparent"}`}
      style={{ background: palette.swatch }}
    />
  );
}

export default function DocumentDesign() {
  const [design, setDesign] = useState({
    template: "classic",
    color: "slate",
    font: "inter",
    fontSize: "base",
    logoPosition: "left",
    showNotes: true,
    showBankDetails: true,
    showSignature: true,
    cornerRadius: "lg",
    borderStyle: "subtle",
    shadowEffect: "sm",
    pageSize: "a4",
  });
  const [savedDesign, setSavedDesign] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [zoom, setZoom] = useState(3); // index into ZOOM_LEVELS (default 100%)
  const [saving, setSaving] = useState(false);
  const [devicePreview, setDevicePreview] = useState("desktop");
  const [activePresetId, setActivePresetId] = useState(null);
  const [savedThemes, setSavedThemes] = useState([]);
  const [savingThemeName, setSavingThemeName] = useState("");
  const [showSaveThemeInput, setShowSaveThemeInput] = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user) {
        setUserInfo(user);
        const saved = {
          template: user.doc_design_template || "classic",
          color: user.doc_design_color || "slate",
          font: user.doc_design_font || "inter",
          fontSize: user.doc_design_fontSize || "base",
          logoPosition: user.doc_design_logoPosition || "left",
          showNotes: user.doc_design_showNotes !== false,
          showBankDetails: user.doc_design_showBankDetails !== false,
          showSignature: user.doc_design_showSignature !== false,
          cornerRadius: user.doc_design_cornerRadius || "lg",
          borderStyle: user.doc_design_borderStyle || "subtle",
          shadowEffect: user.doc_design_shadowEffect || "sm",
          pageSize: user.doc_design_pageSize || "a4",
        };
        setDesign(saved);
        setSavedDesign(saved);
        try {
          const themes = JSON.parse(user.doc_design_saved_themes || "[]");
          setSavedThemes(themes);
        } catch { setSavedThemes([]); }
      }
    });
  }, []);

  const isDirty = savedDesign && JSON.stringify(design) !== JSON.stringify(savedDesign);

  const update = (k, v) => {
    setDesign(d => ({ ...d, [k]: v }));
    setActivePresetId(null);
  };

  const applyPreset = (preset) => {
    setDesign(d => ({ ...d, template: preset.template, color: preset.color, font: preset.font }));
    setActivePresetId(preset.id);
  };

  const applySavedTheme = (theme) => {
    setDesign({ ...theme.design });
    setActivePresetId("custom_" + theme.name);
  };

  const saveTheme = () => {
    if (!savingThemeName.trim()) return;
    const newTheme = { name: savingThemeName.trim(), design: { ...design } };
    const updated = [...savedThemes.filter(t => t.name !== newTheme.name), newTheme];
    setSavedThemes(updated);
    setSavingThemeName("");
    setShowSaveThemeInput(false);
    base44.auth.updateMe({ doc_design_saved_themes: JSON.stringify(updated) });
    toast.success(`Theme "${newTheme.name}" saved!`);
  };

  const deleteTheme = (name) => {
    const updated = savedThemes.filter(t => t.name !== name);
    setSavedThemes(updated);
    base44.auth.updateMe({ doc_design_saved_themes: JSON.stringify(updated) });
    toast("Theme deleted");
  };

  const save = async () => {
    setSaving(true);
    await base44.auth.updateMe({
      doc_design_template: design.template,
      doc_design_color: design.color,
      doc_design_font: design.font,
      doc_design_fontSize: design.fontSize,
      doc_design_logoPosition: design.logoPosition,
      doc_design_showNotes: design.showNotes,
      doc_design_showBankDetails: design.showBankDetails,
      doc_design_showSignature: design.showSignature,
      doc_design_cornerRadius: design.cornerRadius,
      doc_design_borderStyle: design.borderStyle,
      doc_design_shadowEffect: design.shadowEffect,
      doc_design_pageSize: design.pageSize,
    });
    setSavedDesign({ ...design });
    setSaving(false);
    toast.success("Document design saved! All new documents will use this style.");
  };

  const reset = () => {
    if (savedDesign) setDesign({ ...savedDesign });
    setActivePresetId(null);
  };

  const fontCss = FONTS.find(f => f.id === design.font)?.css || FONTS[0].css;
  const selectedPalette = COLOR_PALETTES.find(p => p.id === design.color) || COLOR_PALETTES[0];

  const previewDoc = {
    ...SAMPLE,
    template: design.template,
    template_color: design.color,
    logo_url: userInfo?.logo_url || "",
    company_name: userInfo?.company_name || "Your Company",
    company_address: userInfo?.company_address || "Your Business Address",
    company_phone: userInfo?.company_phone || "",
    company_email: userInfo?.company_email || "",
    manager_signature: userInfo?.manager_signature || "",
    notes: design.showNotes ? "Thank you for your continued business. Payment is due within 14 days." : "",
    bank_name: design.showBankDetails ? (userInfo?.default_bank_name || "First Bank") : "",
    account_number: design.showBankDetails ? (userInfo?.default_account_number || "0123456789") : "",
    account_holder_name: design.showBankDetails ? (userInfo?.default_account_holder_name || "Your Company") : "",
  };

  const zoomScale = ZOOM_LEVELS[zoom];
  const previewWidth = devicePreview === "desktop" ? 794 : devicePreview === "tablet" ? 600 : 375;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-border shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {[["desktop", Monitor], ["tablet", Tablet], ["phone", Smartphone]].map(([id, Icon]) => (
              <button key={id} onClick={() => setDevicePreview(id)}
                className={`p-1.5 rounded-md transition-colors ${devicePreview === id ? "bg-white shadow text-indigo-600" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 ml-1">
            <button onClick={() => setZoom(z => Math.max(0, z - 1))} className="p-1.5 rounded-md hover:bg-white transition-colors text-muted-foreground hover:text-foreground" disabled={zoom === 0}><ZoomOut className="h-3.5 w-3.5" /></button>
            <span className="text-xs font-mono font-bold px-2 text-foreground min-w-[40px] text-center">{ZOOM_LABELS[zoom]}</span>
            <button onClick={() => setZoom(z => Math.min(ZOOM_LEVELS.length - 1, z + 1))} className="p-1.5 rounded-md hover:bg-white transition-colors text-muted-foreground hover:text-foreground" disabled={zoom === ZOOM_LEVELS.length - 1}><ZoomIn className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
          <Button onClick={save} disabled={saving} size="sm" className="gap-1.5 font-bold"
            style={{ background: isDirty ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : isDirty ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left Sidebar: Controls ── */}
        <div className="w-72 shrink-0 bg-white border-r border-border overflow-y-auto flex flex-col">

          <AccordionSection title="Templates" icon={Layout} defaultOpen>
            <div className="grid grid-cols-1 gap-1.5">
              {LAYOUT_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => update("template", t.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${design.template === t.id ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-transparent hover:border-border hover:bg-muted/40 text-foreground"}`}>
                  <span className={`w-2 h-2 rounded-full ${design.template === t.id ? "bg-indigo-500" : "bg-muted-foreground/30"}`} />
                  {t.label}
                  {design.template === t.id && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-indigo-500" />}
                </button>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection title="Color Scheme" icon={Palette} defaultOpen>
            <div className="flex flex-wrap gap-2 mb-3">
              {COLOR_PALETTES.map(p => (
                <ColorSwatch key={p.id} palette={p} selected={design.color === p.id} onClick={() => update("color", p.id)} />
              ))}
            </div>
            <div className="flex items-center gap-2 bg-muted/40 rounded-xl p-2.5">
              <div className="w-5 h-5 rounded-full" style={{ background: selectedPalette.swatch }} />
              <div>
                <p className="text-xs font-bold">{selectedPalette.label}</p>
                <p className="text-[10px] text-muted-foreground">{selectedPalette.swatch}</p>
              </div>
            </div>
          </AccordionSection>

          <AccordionSection title="Typography" icon={Type}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Font Family</p>
            <div className="space-y-1">
              {FONTS.map(f => (
                <button key={f.id} onClick={() => update("font", f.id)}
                  style={{ fontFamily: f.css }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border ${design.font === f.id ? "border-indigo-300 bg-indigo-50 text-indigo-700 font-bold" : "border-transparent hover:bg-muted/40 text-foreground"}`}>
                  <span className="font-medium">{f.label}</span>
                  <span className="text-xs text-muted-foreground ml-2" style={{ fontFamily: "system-ui" }}>— {f.pair}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-3 mb-2">Font Size</p>
            <div className="flex gap-1">
              {[["sm", "S"], ["base", "M"], ["lg", "L"]].map(([v, l]) => (
                <button key={v} onClick={() => update("fontSize", v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${design.fontSize === v ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-border hover:bg-muted/40"}`}>
                  {l}
                </button>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection title="Sections" icon={Eye}>
            {[
              ["showNotes", "Notes / Terms"],
              ["showBankDetails", "Bank Details"],
              ["showSignature", "Signatures"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-sm text-foreground">{label}</span>
                <div onClick={() => update(key, !design[key])}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${design[key] ? "bg-indigo-500" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${design[key] ? "left-5" : "left-0.5"}`} />
                </div>
              </label>
            ))}
          </AccordionSection>

          <AccordionSection title="Visual Style" icon={Sparkles}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Corner Radius</p>
            <div className="flex gap-1">
              {[["none","None"], ["sm","Soft"], ["lg","Round"], ["full","Pill"]].map(([v, l]) => (
                <button key={v} onClick={() => update("cornerRadius", v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${design.cornerRadius === v ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-border hover:bg-muted/40"}`}>
                  {l}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-3 mb-2">Shadow</p>
            <div className="flex gap-1">
              {[["none","None"], ["sm","Light"], ["md","Medium"], ["lg","Heavy"]].map(([v, l]) => (
                <button key={v} onClick={() => update("shadowEffect", v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${design.shadowEffect === v ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-border hover:bg-muted/40"}`}>
                  {l}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-3 mb-2">Page Size</p>
            <div className="flex gap-1">
              {[["a4","A4"], ["letter","Letter"], ["legal","Legal"]].map(([v, l]) => (
                <button key={v} onClick={() => update("pageSize", v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${design.pageSize === v ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-border hover:bg-muted/40"}`}>
                  {l}
                </button>
              ))}
            </div>
          </AccordionSection>

        </div>

        {/* ── Center: Live Preview ── */}
        <div className="flex-1 min-w-0 bg-gradient-to-br from-slate-100 to-slate-200 overflow-auto flex items-start justify-center p-6">
          <div style={{ width: previewWidth * zoomScale, minHeight: 400 }}>
            <div style={{
              width: previewWidth,
              transformOrigin: "top left",
              transform: `scale(${zoomScale})`,
              marginBottom: zoomScale < 1 ? `${(zoomScale - 1) * 1200}px` : 0,
              fontFamily: fontCss,
              transition: "all 0.2s ease",
            }}>
              <DocumentPreview
                form={previewDoc}
                items={previewDoc.items}
                calcs={{ subtotal: previewDoc.subtotal, taxAmt: previewDoc.tax_amount, total: previewDoc.total }}
                sym="₦"
                docType="invoice"
                managerSig={design.showSignature ? (userInfo?.manager_signature || "") : ""}
                customerSig=""
                template={design.template}
                templateColor={design.color}
              />
            </div>
          </div>
        </div>

        {/* ── Right Sidebar: Presets & Themes ── */}
        <div className="w-64 shrink-0 bg-white border-l border-border overflow-y-auto flex flex-col">

          {/* Presets */}
          <div className="px-4 pt-4 pb-2 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-amber-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-foreground">Style Presets</p>
            </div>
            <div className="space-y-1">
              {PRESETS.map(p => (
                <button key={p.id} onClick={() => applyPreset(p)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-all border ${activePresetId === p.id ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:border-border hover:bg-muted/40"}`}>
                  <span className="text-base">{p.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate text-foreground">{p.label}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{p.template} · {p.color}</p>
                  </div>
                  {activePresetId === p.id && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0 ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Saved Themes */}
          <div className="px-4 pt-4 pb-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-foreground">My Themes</p>
              <button onClick={() => setShowSaveThemeInput(s => !s)}
                className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 transition-colors">
                + Save current
              </button>
            </div>

            {showSaveThemeInput && (
              <div className="mb-3 flex gap-1">
                <input
                  value={savingThemeName}
                  onChange={e => setSavingThemeName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveTheme()}
                  placeholder="Theme name…"
                  className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  autoFocus
                />
                <button onClick={saveTheme} className="px-2 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">
                  Save
                </button>
              </div>
            )}

            {savedThemes.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-2">
                  <Palette className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">No saved themes yet.</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Customise and save your own!</p>
              </div>
            ) : (
              <div className="space-y-1">
                {savedThemes.map(theme => (
                  <div key={theme.name}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all group cursor-pointer ${activePresetId === "custom_" + theme.name ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:border-border hover:bg-muted/40"}`}
                    onClick={() => applySavedTheme(theme)}>
                    <span className="text-base">🎨</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate text-foreground">{theme.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{theme.design.template} · {theme.design.color}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteTheme(theme.name); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded-md transition-all">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* AI Recommendations */}
            <div className="mt-6 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                <p className="text-xs font-bold text-indigo-700">AI Suggestions</p>
              </div>
              <p className="text-[10px] text-indigo-600 leading-relaxed mb-3">Based on professional invoice standards, these styles work best:</p>
              <div className="space-y-1.5">
                {[PRESETS[0], PRESETS[1], PRESETS[4]].map(p => (
                  <button key={p.id} onClick={() => applyPreset(p)}
                    className="w-full text-left flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg bg-white/80 border border-indigo-100 hover:bg-white hover:border-indigo-300 transition-all">
                    <span>{p.emoji}</span>
                    <span className="font-medium text-indigo-800">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}