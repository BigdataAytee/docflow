import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import DocumentPreview from "../../components/DocumentPreview";
import {
  Save, ZoomIn, ZoomOut, Monitor, Tablet, Smartphone, ChevronDown, ChevronUp,
  Palette, Type, Layout, Sparkles, CheckCircle2, Trash2, Star, RotateCcw, Eye
} from "lucide-react";

// ─── DATA ─────────────────────────────────────────────────────────────────────
const FONTS = [
  { id: "inter",        label: "Inter",        css: "'Inter', sans-serif",          pair: "Clean & modern"            },
  { id: "poppins",      label: "Poppins",       css: "'Poppins', sans-serif",         pair: "Rounded & friendly"        },
  { id: "playfair",     label: "Playfair",      css: "'Playfair Display', serif",     pair: "Editorial & elegant"       },
  { id: "roboto",       label: "Roboto",        css: "'Roboto', sans-serif",          pair: "Neutral & versatile"       },
  { id: "merriweather", label: "Merriweather",  css: "'Merriweather', serif",         pair: "Traditional & trustworthy" },
  { id: "montserrat",   label: "Montserrat",    css: "'Montserrat', sans-serif",      pair: "Bold & corporate"          },
  { id: "lato",         label: "Lato",          css: "'Lato', sans-serif",            pair: "Humanist & readable"       },
  { id: "georgia",      label: "Georgia",       css: "Georgia, serif",                pair: "Classic & prestigious"     },
];

const COLOR_PALETTES = [
  { id: "slate",    label: "Slate",        swatch: "#334155" },
  { id: "charcoal", label: "Charcoal",     swatch: "#111827" },
  { id: "midnight", label: "Midnight",     swatch: "#1e1b4b" },
  { id: "navy",     label: "Navy",         swatch: "#0f172a" },
  { id: "indigo",   label: "Indigo",       swatch: "#4f46e5" },
  { id: "blue",     label: "Ocean Blue",   swatch: "#2563eb" },
  { id: "sky",      label: "Sky",          swatch: "#0284c7" },
  { id: "teal",     label: "Teal",         swatch: "#0d9488" },
  { id: "emerald",  label: "Emerald",      swatch: "#059669" },
  { id: "forest",   label: "Forest",       swatch: "#14532d" },
  { id: "purple",   label: "Plum Purple",  swatch: "#7c3aed" },
  { id: "pink",     label: "Pink",         swatch: "#be185d" },
  { id: "rose",     label: "Rose Red",     swatch: "#e11d48" },
  { id: "crimson",  label: "Crimson",      swatch: "#7f1d1d" },
  { id: "coral",    label: "Coral",        swatch: "#e7553a" },
  { id: "amber",    label: "Amber",        swatch: "#d97706" },
  { id: "copper",   label: "Copper",       swatch: "#92400e" },
  { id: "gold",     label: "Gold",         swatch: "#b45309" },
  { id: "gray",     label: "Gray",         swatch: "#9ca3af" },
];

const LAYOUT_TEMPLATES = [
  { id: "classic", label: "Classic"  },
  { id: "modern",  label: "Modern"   },
  { id: "minimal", label: "Minimal"  },
  { id: "bold",    label: "Bold"     },
  { id: "elegant", label: "Elegant"  },
];

const PRESETS = [
  // ── Professional & Corporate ──────────────────────────────
  { id: "modern_pro",     label: "Modern Professional",  template: "modern",  color: "slate",    font: "inter",        emoji: "💼", group: "Professional" },
  { id: "executive",      label: "Executive Report",     template: "classic", color: "charcoal", font: "merriweather", emoji: "🏛️", group: "Professional" },
  { id: "corporate",      label: "Corporate Premium",    template: "bold",    color: "slate",    font: "montserrat",   emoji: "🏢", group: "Professional" },
  { id: "boardroom",      label: "Boardroom Black",      template: "bold",    color: "charcoal", font: "montserrat",   emoji: "🖤", group: "Professional" },
  { id: "navy_exec",      label: "Navy Executive",       template: "classic", color: "indigo",   font: "merriweather", emoji: "🔷", group: "Professional" },
  { id: "clean_tech",     label: "Clean Technical",      template: "minimal", color: "blue",     font: "roboto",       emoji: "🔧", group: "Professional" },
  // ── Elegant & Luxury ─────────────────────────────────────
  { id: "elegant_biz",    label: "Elegant Business",     template: "elegant", color: "gold",     font: "playfair",     emoji: "✨", group: "Elegant" },
  { id: "royal_gold",     label: "Royal Gold",           template: "bold",    color: "gold",     font: "playfair",     emoji: "👑", group: "Elegant" },
  { id: "black_tie",      label: "Black Tie",            template: "elegant", color: "charcoal", font: "playfair",     emoji: "🎩", group: "Elegant" },
  { id: "ivory_classic",  label: "Ivory Classic",        template: "classic", color: "gold",     font: "georgia",      emoji: "🤍", group: "Elegant" },
  { id: "deep_plum",      label: "Deep Plum",            template: "elegant", color: "purple",   font: "playfair",     emoji: "🍇", group: "Elegant" },
  { id: "rose_luxury",    label: "Rose Luxe",            template: "elegant", color: "rose",     font: "georgia",      emoji: "🌹", group: "Elegant" },
  // ── Creative & Bold ──────────────────────────────────────
  { id: "creative",       label: "Creative Portfolio",   template: "modern",  color: "indigo",   font: "poppins",      emoji: "🎨", group: "Creative" },
  { id: "startup",        label: "Startup Pitch",        template: "modern",  color: "purple",   font: "poppins",      emoji: "🚀", group: "Creative" },
  { id: "magazine",       label: "Modern Magazine",      template: "bold",    color: "rose",     font: "montserrat",   emoji: "📰", group: "Creative" },
  { id: "neon_agency",    label: "Neon Agency",          template: "bold",    color: "indigo",   font: "poppins",      emoji: "⚡", group: "Creative" },
  { id: "fire_brand",     label: "Fire Brand",           template: "bold",    color: "rose",     font: "poppins",      emoji: "🔥", group: "Creative" },
  { id: "bold_amber",     label: "Bold Amber",           template: "bold",    color: "amber",    font: "montserrat",   emoji: "🟠", group: "Creative" },
  { id: "electric_blue",  label: "Electric Blue",        template: "modern",  color: "blue",     font: "montserrat",   emoji: "💙", group: "Creative" },
  // ── Minimal & Clean ──────────────────────────────────────
  { id: "minimalist",     label: "Minimalist",           template: "minimal", color: "slate",    font: "lato",         emoji: "⬜", group: "Minimal" },
  { id: "pure_white",     label: "Pure White",           template: "minimal", color: "charcoal", font: "inter",        emoji: "🗒️", group: "Minimal" },
  { id: "zen_minimal",    label: "Zen Minimal",          template: "minimal", color: "teal",     font: "lato",         emoji: "🪷", group: "Minimal" },
  { id: "soft_gray",      label: "Soft Gray",            template: "classic", color: "slate",    font: "roboto",       emoji: "🩶", group: "Minimal" },
  { id: "type_forward",   label: "Type Forward",         template: "minimal", color: "indigo",   font: "montserrat",   emoji: "📝", group: "Minimal" },
  // ── Nature & Fresh ───────────────────────────────────────
  { id: "eco",            label: "Natural & Fresh",      template: "modern",  color: "emerald",  font: "lato",         emoji: "🌿", group: "Nature" },
  { id: "forest_deep",    label: "Forest Deep",          template: "bold",    color: "emerald",  font: "merriweather", emoji: "🌲", group: "Nature" },
  { id: "ocean_breeze",   label: "Ocean Breeze",         template: "elegant", color: "teal",     font: "lato",         emoji: "🌊", group: "Nature" },
  { id: "sunset_warm",    label: "Sunset Warm",          template: "modern",  color: "amber",    font: "poppins",      emoji: "🌅", group: "Nature" },
  { id: "coral_fresh",    label: "Coral Fresh",          template: "classic", color: "rose",     font: "poppins",      emoji: "🪸", group: "Nature" },
];

const SAMPLE = {
  type: "invoice", number: "INV-0001", status: "draft",
  customer_name: "Acme Corporation", customer_address: "123 Business Ave, Lagos",
  customer_email: "accounts@acme.com",
  issue_date: new Date().toISOString(),
  due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
  items: [
    { description: "Web Design & Development", quantity: 1, unit_price: 150000, amount: 150000 },
    { description: "SEO Optimization Package", quantity: 1, unit_price: 75000,  amount: 75000  },
    { description: "Monthly Maintenance",      quantity: 3, unit_price: 25000,  amount: 75000  },
  ],
  subtotal: 300000, tax_rate: 7.5, tax_amount: 22500, total: 322500, balance_due: 322500,
  currency: "NGN", shipping: 0, global_discount_amount: 0,
};

const DOC_W = 794;
const DOC_H = 1123;

// ─── MiniPreview — always-visible document thumbnail ─────────────────────────
function MiniPreview({ design, userInfo, fixedHeight }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    if (!containerRef.current) return;
    const compute = (el) => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 10 || height < 10) return;
      const sw = (width - 16) / DOC_W;
      const sh = (height - 16) / DOC_H;
      setScale(parseFloat(Math.min(sw, sh, 1).toFixed(4)));
    };
    const raf = requestAnimationFrame(() => compute(containerRef.current));
    const ro = new ResizeObserver(([e]) => compute(e.target));
    ro.observe(containerRef.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const previewDoc = {
    ...SAMPLE,
    template: design.template, template_color: design.color,
    logo_url: userInfo?.logo_url || "",
    company_name: userInfo?.company_name || "Your Company",
    company_address: userInfo?.company_address || "Your Business Address",
    company_phone: userInfo?.company_phone || "",
    company_email: userInfo?.company_email || "",
    manager_signature: design.showSignature ? (userInfo?.manager_signature || "") : "",
    notes: design.showNotes ? "Thank you for your continued business." : "",
    bank_name: design.showBankDetails ? (userInfo?.default_bank_name || "First Bank") : "",
    account_number: design.showBankDetails ? (userInfo?.default_account_number || "0123456789") : "",
    account_holder_name: design.showBankDetails ? (userInfo?.default_account_holder_name || "Your Company") : "",
  };

  return (
    <div
      ref={containerRef}
      className="bg-slate-100 flex items-center justify-center w-full"
      style={{ height: fixedHeight, overflow: "hidden" }}
    >
      <div style={{
        width: DOC_W * scale, height: DOC_H * scale,
        flexShrink: 0, boxShadow: "0 4px 24px rgba(0,0,0,0.18)", borderRadius: 4, overflow: "hidden",
      }}>
        <div style={{
          width: DOC_W, height: DOC_H,
          transformOrigin: "top left", transform: `scale(${scale})`,
          pointerEvents: "none", transition: "transform 0.2s",
        }}>
          <DocumentPreview
            form={previewDoc} items={previewDoc.items}
            calcs={{ subtotal: previewDoc.subtotal, taxAmt: previewDoc.tax_amount, total: previewDoc.total }}
            sym="₦" docType="invoice"
            managerSig={previewDoc.manager_signature} customerSig=""
            template={design.template} templateColor={design.color}
          />
        </div>
      </div>
    </div>
  );
}

// ─── DesktopPreview — full-height preview with zoom & device controls ─────────
function DesktopPreview({ design, userInfo }) {
  const containerRef = useRef(null);
  const [fitScale, setFitScale]     = useState(0.6);
  const [useAutoFit, setUseAutoFit] = useState(true);
  const [manualZoom, setManualZoom] = useState(2);
  const [device, setDevice]         = useState("desktop");

  const ZOOM_LEVELS = [0.4, 0.5, 0.65, 0.75, 1];
  const ZOOM_LABELS = ["40%", "50%", "65%", "75%", "100%"];
  const previewW = device === "desktop" ? DOC_W : device === "tablet" ? 600 : 375;
  const scale    = useAutoFit ? fitScale : ZOOM_LEVELS[manualZoom];
  const fontCss  = FONTS.find(f => f.id === design.font)?.css || FONTS[0].css;

  useEffect(() => {
    if (!containerRef.current) return;
    const compute = (el) => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 10 || height < 10) return;
      setFitScale(parseFloat(Math.min((width - 32) / previewW, (height - 32) / DOC_H, 1).toFixed(4)));
    };
    const raf = requestAnimationFrame(() => compute(containerRef.current));
    const ro = new ResizeObserver(([e]) => compute(e.target));
    ro.observe(containerRef.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [device, previewW]);

  const previewDoc = {
    ...SAMPLE,
    template: design.template, template_color: design.color,
    logo_url: userInfo?.logo_url || "",
    company_name: userInfo?.company_name || "Your Company",
    company_address: userInfo?.company_address || "Your Business Address",
    company_phone: userInfo?.company_phone || "",
    company_email: userInfo?.company_email || "",
    manager_signature: design.showSignature ? (userInfo?.manager_signature || "") : "",
    notes: design.showNotes ? "Thank you for your continued business. Payment is due within 14 days." : "",
    bank_name: design.showBankDetails ? (userInfo?.default_bank_name || "First Bank") : "",
    account_number: design.showBankDetails ? (userInfo?.default_account_number || "0123456789") : "",
    account_holder_name: design.showBankDetails ? (userInfo?.default_account_holder_name || "Your Company") : "",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "1 1 0", minHeight: 0 }}>
      {/* Controls bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-border shrink-0">
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          {[["desktop", Monitor], ["tablet", Tablet], ["phone", Smartphone]].map(([id, Ic]) => (
            <button key={id} onClick={() => setDevice(id)}
              className={`p-1.5 rounded-md transition-colors ${device === id ? "bg-white shadow text-indigo-600" : "text-muted-foreground hover:text-foreground"}`}>
              <Ic className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          <button onClick={() => { setUseAutoFit(false); setManualZoom(z => Math.max(0, z - 1)); }}
            disabled={!useAutoFit && manualZoom === 0}
            className="p-1.5 rounded-md hover:bg-white text-muted-foreground disabled:opacity-30 transition-colors">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setUseAutoFit(a => !a)}
            className={`text-xs font-mono font-bold px-2 py-1 rounded-md min-w-[44px] text-center transition-colors ${useAutoFit ? "bg-indigo-100 text-indigo-700" : "bg-white text-foreground shadow"}`}>
            {useAutoFit ? "Fit" : ZOOM_LABELS[manualZoom]}
          </button>
          <button onClick={() => { setUseAutoFit(false); setManualZoom(z => Math.min(ZOOM_LEVELS.length - 1, z + 1)); }}
            disabled={!useAutoFit && manualZoom === ZOOM_LEVELS.length - 1}
            className="p-1.5 rounded-md hover:bg-white text-muted-foreground disabled:opacity-30 transition-colors">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Canvas */}
      <div ref={containerRef}
        style={{ flex: "1 1 0", minHeight: 0 }}
        className="bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden p-4">
        <div style={{
          width: previewW * scale, height: DOC_H * scale,
          flexShrink: 0, boxShadow: "0 6px 32px rgba(0,0,0,0.18)", borderRadius: 6, overflow: "hidden",
        }}>
          <div style={{
            width: previewW, height: DOC_H,
            transformOrigin: "top left", transform: `scale(${scale})`,
            fontFamily: fontCss, pointerEvents: "none", transition: "transform 0.25s ease",
          }}>
            <DocumentPreview
              form={previewDoc} items={previewDoc.items}
              calcs={{ subtotal: previewDoc.subtotal, taxAmt: previewDoc.tax_amount, total: previewDoc.total }}
              sym="₦" docType="invoice"
              managerSig={previewDoc.manager_signature} customerSig=""
              template={design.template} templateColor={design.color}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AccordionSection ─────────────────────────────────────────────────────────
function AccordionSection({ title, IconComp, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-b-0">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <IconComp className="h-4 w-4 text-indigo-500 shrink-0" />
          {title}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

// ─── DesignControls ───────────────────────────────────────────────────────────
function DesignControls({ design, update }) {
  return (
    <>
      <AccordionSection title="Templates" IconComp={Layout} defaultOpen>
        <div className="space-y-1">
          {LAYOUT_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => update("template", t.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${design.template === t.id ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-transparent hover:border-border hover:bg-muted/40"}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${design.template === t.id ? "bg-indigo-500" : "bg-muted-foreground/30"}`} />
              {t.label}
              {design.template === t.id && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-indigo-500" />}
            </button>
          ))}
        </div>
      </AccordionSection>

      <AccordionSection title="Colour Scheme" IconComp={Palette} defaultOpen>
        <div className="flex flex-wrap gap-2 mb-2">
          {COLOR_PALETTES.map(p => (
            <button key={p.id} onClick={() => update("color", p.id)} title={p.label}
              className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${design.color === p.id ? "border-foreground scale-110 shadow-md" : "border-transparent"}`}
              style={{ background: p.swatch }} />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">{COLOR_PALETTES.find(p => p.id === design.color)?.label}</p>
      </AccordionSection>

      <AccordionSection title="Typography" IconComp={Type}>
        <div className="space-y-1">
          {FONTS.map(f => (
            <button key={f.id} onClick={() => update("font", f.id)}
              style={{ fontFamily: f.css }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border ${design.font === f.id ? "border-indigo-300 bg-indigo-50 text-indigo-700 font-bold" : "border-transparent hover:bg-muted/40"}`}>
              {f.label}
              <span className="text-[10px] text-muted-foreground ml-2" style={{ fontFamily: "system-ui" }}>— {f.pair}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 mt-2">
          {[["sm","S"],["base","M"],["lg","L"]].map(([v,l]) => (
            <button key={v} onClick={() => update("fontSize", v)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${design.fontSize === v ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-border hover:bg-muted/40"}`}>
              {l}
            </button>
          ))}
        </div>
      </AccordionSection>

      <AccordionSection title="Sections" IconComp={Eye}>
        {[["showNotes","Notes / Terms"],["showBankDetails","Bank Details"],["showSignature","Signatures"]].map(([key, label]) => (
          <label key={key} className="flex items-center justify-between cursor-pointer py-1">
            <span className="text-sm">{label}</span>
            <div onClick={() => update(key, !design[key])}
              className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${design[key] ? "bg-indigo-500" : "bg-muted"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${design[key] ? "left-5" : "left-0.5"}`} />
            </div>
          </label>
        ))}
      </AccordionSection>

      <AccordionSection title="Visual Style" IconComp={Sparkles}>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Corner Radius</p>
        <div className="flex gap-1 mb-3">
          {[["none","None"],["sm","Soft"],["lg","Round"],["full","Pill"]].map(([v,l]) => (
            <button key={v} onClick={() => update("cornerRadius", v)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${design.cornerRadius === v ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-border hover:bg-muted/40"}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Shadow</p>
        <div className="flex gap-1">
          {[["none","None"],["sm","Light"],["md","Medium"],["lg","Heavy"]].map(([v,l]) => (
            <button key={v} onClick={() => update("shadowEffect", v)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${design.shadowEffect === v ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-border hover:bg-muted/40"}`}>
              {l}
            </button>
          ))}
        </div>
      </AccordionSection>
    </>
  );
}

// ─── StylePresets ─────────────────────────────────────────────────────────────
function StylePresets({ activePresetId, applyPreset, savedThemes, applySavedTheme, deleteTheme, showSaveInput, setShowSaveInput, savingThemeName, setSavingThemeName, saveTheme }) {
  return (
    <>
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          <p className="text-xs font-bold uppercase tracking-widest">Style Presets</p>
        </div>
        {["Professional", "Elegant", "Creative", "Minimal", "Nature"].map(group => (
          <div key={group} className="mb-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-1 mb-1">{group}</p>
            <div className="space-y-0.5">
              {PRESETS.filter(p => p.group === group).map(p => (
                <button key={p.id} onClick={() => applyPreset(p)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all border ${activePresetId === p.id ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:border-border hover:bg-muted/40"}`}>
                  <span className="text-sm">{p.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{p.label}</p>
                    <p className="text-[9px] text-muted-foreground capitalize">{p.template} · {p.color}</p>
                  </div>
                  {activePresetId === p.id && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-widest">My Themes</p>
          <button onClick={() => setShowSaveInput(s => !s)} className="text-xs text-indigo-600 font-semibold">+ Save current</button>
        </div>
        {showSaveInput && (
          <div className="flex gap-1 mb-3">
            <input value={savingThemeName} onChange={e => setSavingThemeName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveTheme()}
              placeholder="Theme name…" autoFocus
              className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            <button onClick={saveTheme} className="px-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">OK</button>
          </div>
        )}
        {savedThemes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No saved themes yet.</p>
        ) : (
          <div className="space-y-1">
            {savedThemes.map(t => (
              <div key={t.name} onClick={() => applySavedTheme(t)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer group transition-all ${activePresetId === "custom_" + t.name ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:border-border hover:bg-muted/40"}`}>
                <span>🎨</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{t.design.template} · {t.design.color}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteTheme(t.name); }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DocumentDesign() {
  const [design, setDesign] = useState({
    template: "classic", color: "slate", font: "inter", fontSize: "base",
    showNotes: true, showBankDetails: true, showSignature: true,
    cornerRadius: "lg", shadowEffect: "sm", pageSize: "a4",
  });
  const [savedDesign, setSavedDesign]         = useState(null);
  const [userInfo, setUserInfo]               = useState(null);
  const [saving, setSaving]                   = useState(false);
  const [activePresetId, setActivePresetId]   = useState(null);
  const [savedThemes, setSavedThemes]         = useState([]);
  const [savingThemeName, setSavingThemeName] = useState("");
  const [showSaveInput, setShowSaveInput]     = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (!user) return;
      setUserInfo(user);
      const saved = {
        template:        user.doc_design_template        || "classic",
        color:           user.doc_design_color           || "slate",
        font:            user.doc_design_font            || "inter",
        fontSize:        user.doc_design_fontSize        || "base",
        showNotes:       user.doc_design_showNotes       !== false,
        showBankDetails: user.doc_design_showBankDetails !== false,
        showSignature:   user.doc_design_showSignature   !== false,
        cornerRadius:    user.doc_design_cornerRadius    || "lg",
        shadowEffect:    user.doc_design_shadowEffect    || "sm",
        pageSize:        user.doc_design_pageSize        || "a4",
      };
      setDesign(saved); setSavedDesign(saved);
      try { setSavedThemes(JSON.parse(user.doc_design_saved_themes || "[]")); } catch { /**/ }
    });
  }, []);

  const isDirty = savedDesign && JSON.stringify(design) !== JSON.stringify(savedDesign);
  const update  = (k, v) => { setDesign(d => ({ ...d, [k]: v })); setActivePresetId(null); };
  const applyPreset = (p) => { setDesign(d => ({ ...d, template: p.template, color: p.color, font: p.font })); setActivePresetId(p.id); };
  const applySavedTheme = (t) => { setDesign({ ...t.design }); setActivePresetId("custom_" + t.name); };
  const deleteTheme = (name) => {
    const upd = savedThemes.filter(t => t.name !== name);
    setSavedThemes(upd);
    base44.auth.updateMe({ doc_design_saved_themes: JSON.stringify(upd) });
    toast("Theme deleted");
  };
  const saveTheme = () => {
    if (!savingThemeName.trim()) return;
    const upd = [...savedThemes.filter(t => t.name !== savingThemeName), { name: savingThemeName.trim(), design: { ...design } }];
    setSavedThemes(upd);
    base44.auth.updateMe({ doc_design_saved_themes: JSON.stringify(upd) });
    setSavingThemeName(""); setShowSaveInput(false);
    toast.success(`Theme "${savingThemeName}" saved!`);
  };
  const save = async () => {
    setSaving(true);
    await base44.auth.updateMe({
      doc_design_template: design.template, doc_design_color: design.color,
      doc_design_font: design.font, doc_design_fontSize: design.fontSize,
      doc_design_showNotes: design.showNotes, doc_design_showBankDetails: design.showBankDetails,
      doc_design_showSignature: design.showSignature, doc_design_cornerRadius: design.cornerRadius,
      doc_design_shadowEffect: design.shadowEffect, doc_design_pageSize: design.pageSize,
    });
    setSavedDesign({ ...design }); setSaving(false);
    toast.success("Document design saved!");
  };

  const presetsProps = {
    activePresetId, applyPreset, savedThemes, applySavedTheme, deleteTheme,
    showSaveInput, setShowSaveInput, savingThemeName, setSavingThemeName, saveTheme,
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-2 bg-white border-b border-border shrink-0">
        <span className="text-xs text-muted-foreground">
          {isDirty ? <span className="text-amber-600 font-semibold">⚠ Unsaved changes</span> : "Customise how your documents look"}
        </span>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button onClick={() => { setDesign({ ...savedDesign }); setActivePresetId(null); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors">
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
          <Button onClick={save} disabled={saving} size="sm" className="gap-1.5 font-bold text-xs"
            style={{ background: isDirty ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : isDirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      {/* ── DESKTOP (lg+): 3-column fixed layout, no scroll ── */}
      <div className="hidden lg:flex flex-1 min-h-0 overflow-hidden">
        <div className="w-64 shrink-0 bg-white border-r border-border overflow-y-auto">
          <DesignControls design={design} update={update} />
        </div>
        <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <DesktopPreview design={design} userInfo={userInfo} />
        </div>
        <div className="w-60 shrink-0 bg-white border-l border-border overflow-y-auto">
          <StylePresets {...presetsProps} />
        </div>
      </div>

      {/* ── TABLET & PHONE (<lg): Preview fixed top + side-by-side settings below ── */}
      <div className="flex lg:hidden flex-1 flex-col overflow-hidden bg-slate-50">

        {/* Sticky preview at top */}
        <div className="shrink-0 border-b border-border bg-white">
          <MiniPreview design={design} userInfo={userInfo} fixedHeight={380} />
        </div>

        {/* Controls + Presets side by side, scrollable */}
        <div className="flex flex-1 overflow-y-auto min-h-0">

          {/* Left: Design Controls */}
          <div className="flex-1 min-w-0 border-r border-border bg-white overflow-y-auto">
            <div className="px-3 py-2 border-b border-border bg-indigo-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Design Controls</p>
            </div>
            <DesignControls design={design} update={update} />
          </div>

          {/* Right: Style Presets */}
          <div className="flex-1 min-w-0 bg-white overflow-y-auto">
            <div className="px-3 py-2 border-b border-border bg-amber-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Style Presets</p>
            </div>
            <StylePresets {...presetsProps} />
          </div>

        </div>
      </div>
    </div>
  );
}