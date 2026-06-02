import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import DocumentPreview from "../../components/DocumentPreview";
import {
  Save, ZoomIn, ZoomOut, Monitor, Tablet, Smartphone, ChevronDown, ChevronUp,
  Palette, Type, Layout, Sparkles, CheckCircle2, Trash2, Star, RotateCcw, Eye,
  Settings2, Image, RotateCw, Maximize2, Minimize2, X
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
  { id: "slate",    label: "Slate",    swatch: "#334155" },
  { id: "indigo",   label: "Indigo",   swatch: "#4f46e5" },
  { id: "blue",     label: "Ocean",    swatch: "#2563eb" },
  { id: "emerald",  label: "Emerald",  swatch: "#059669" },
  { id: "rose",     label: "Rose",     swatch: "#e11d48" },
  { id: "amber",    label: "Amber",    swatch: "#d97706" },
  { id: "purple",   label: "Plum",     swatch: "#7c3aed" },
  { id: "teal",     label: "Teal",     swatch: "#0d9488" },
  { id: "gold",     label: "Gold",     swatch: "#b45309" },
  { id: "charcoal", label: "Charcoal", swatch: "#111827" },
];

const LAYOUT_TEMPLATES = [
  { id: "classic", label: "Classic" },
  { id: "modern",  label: "Modern"  },
  { id: "minimal", label: "Minimal" },
  { id: "bold",    label: "Bold"    },
  { id: "elegant", label: "Elegant" },
];

const PRESETS = [
  { id: "modern_pro",  label: "Modern Professional", template: "modern",  color: "slate",    font: "inter",        emoji: "💼" },
  { id: "executive",   label: "Executive Report",    template: "classic", color: "charcoal", font: "merriweather", emoji: "🏛️" },
  { id: "creative",    label: "Creative Portfolio",  template: "modern",  color: "indigo",   font: "poppins",      emoji: "🎨" },
  { id: "corporate",   label: "Corporate Premium",   template: "bold",    color: "slate",    font: "montserrat",   emoji: "🏢" },
  { id: "minimalist",  label: "Minimalist",          template: "minimal", color: "slate",    font: "lato",         emoji: "⬜" },
  { id: "elegant_biz", label: "Elegant Business",    template: "elegant", color: "gold",     font: "playfair",     emoji: "✨" },
  { id: "startup",     label: "Startup Pitch",       template: "modern",  color: "purple",   font: "poppins",      emoji: "🚀" },
  { id: "magazine",    label: "Modern Magazine",     template: "bold",    color: "rose",     font: "montserrat",   emoji: "📰" },
  { id: "clean_tech",  label: "Clean Technical",     template: "minimal", color: "blue",     font: "roboto",       emoji: "🔧" },
  { id: "eco",         label: "Natural & Fresh",     template: "modern",  color: "emerald",  font: "lato",         emoji: "🌿" },
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

// Device specs: [docWidth, frameW, frameH, label]
const DEVICE_SPECS = {
  desktop: { portrait: { docW: 794, frameW: 1440, frameH: 900,  label: "1440 × 900"   }, landscape: null },
  tablet:  { portrait: { docW: 600, frameW: 768,  frameH: 1024, label: "768 × 1024"   }, landscape: { docW: 794, frameW: 1024, frameH: 768, label: "1024 × 768" } },
  phone:   { portrait: { docW: 375, frameW: 390,  frameH: 844,  label: "390 × 844"    }, landscape: { docW: 600, frameW: 844,  frameH: 390, label: "844 × 390"  } },
};

const DOC_H = 1123;
const ZOOM_LEVELS = [0.35, 0.5, 0.65, 0.75, 1];
const ZOOM_LABELS = ["35%", "50%", "65%", "75%", "100%"];

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

// ─── DesignControls ────────────────────────────────────────────────────────────
function DesignControls({ design, update }) {
  return (
    <div className="overflow-y-auto" style={{ flex: "1 1 0", minHeight: 0 }}>
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
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Font Family</p>
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
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-3 mb-1.5">Size</p>
        <div className="flex gap-1">
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
    </div>
  );
}

// ─── PresetsPanel ──────────────────────────────────────────────────────────────
function PresetsPanel({ activePresetId, applyPreset, savedThemes, applySavedTheme, deleteTheme, showSaveInput, setShowSaveInput, savingThemeName, setSavingThemeName, saveTheme }) {
  return (
    <div className="overflow-y-auto" style={{ flex: "1 1 0", minHeight: 0 }}>
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          <p className="text-xs font-bold uppercase tracking-widest">Style Presets</p>
        </div>
        <div className="space-y-1">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => applyPreset(p)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all border ${activePresetId === p.id ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:border-border hover:bg-muted/40"}`}>
              <span className="text-base">{p.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{p.label}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{p.template} · {p.color}</p>
              </div>
              {activePresetId === p.id && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0 ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-widest">My Themes</p>
          <button onClick={() => setShowSaveInput(s => !s)} className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 transition-colors">+ Save</button>
        </div>
        {showSaveInput && (
          <div className="flex gap-1 mb-3">
            <input value={savingThemeName} onChange={e => setSavingThemeName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveTheme()}
              placeholder="Theme name…" autoFocus
              className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            <button onClick={saveTheme} className="px-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">OK</button>
          </div>
        )}
        {savedThemes.length === 0 ? (
          <div className="text-center py-5">
            <Palette className="h-8 w-8 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">No saved themes yet.</p>
          </div>
        ) : (
          <div className="space-y-1 mb-4">
            {savedThemes.map(t => (
              <div key={t.name} onClick={() => applySavedTheme(t)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer group transition-all ${activePresetId === "custom_" + t.name ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:border-border hover:bg-muted/40"}`}>
                <span className="text-base">🎨</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{t.design.template} · {t.design.color}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteTheme(t.name); }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <p className="text-xs font-bold text-indigo-700">AI Suggestions</p>
          </div>
          <div className="space-y-1">
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
  );
}

// ─── DeviceFrame ───────────────────────────────────────────────────────────────
function DeviceFrame({ device, landscape, children }) {
  if (device === "desktop") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="bg-gray-800 rounded-t-xl px-4 pt-2 pb-0 flex items-center gap-1.5 w-full">
          {["#ff5f57","#ffbd2e","#28c840"].map(c => (
            <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <div className="w-full border-2 border-gray-800 rounded-b-xl overflow-hidden bg-white" style={{ borderTop: "none" }}>
          {children}
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-16 h-2 bg-gray-600 rounded" />
          <div className="w-24 h-1.5 bg-gray-400 rounded-full" />
        </div>
      </div>
    );
  }
  if (device === "tablet") {
    const w = landscape ? "100%" : undefined;
    return (
      <div className={`bg-gray-800 rounded-[20px] p-2.5 shadow-2xl ${landscape ? "flex flex-row gap-2 items-center" : "flex flex-col gap-1.5 items-center"}`}
        style={landscape ? { width: w } : {}}>
        {!landscape && <div className="w-16 h-1.5 bg-gray-600 rounded-full" />}
        {landscape && <div className="w-1.5 h-8 bg-gray-600 rounded-full" />}
        <div className="rounded-[10px] overflow-hidden bg-white flex-1 w-full">
          {children}
        </div>
        {!landscape && <div className="w-10 h-10 rounded-full border-2 border-gray-600 flex items-center justify-center"><div className="w-5 h-5 rounded border border-gray-500" /></div>}
        {landscape && <div className="w-8 h-8 rounded-full border-2 border-gray-600 flex items-center justify-center shrink-0"><div className="w-4 h-4 rounded border border-gray-500" /></div>}
      </div>
    );
  }
  // phone
  return (
    <div className={`bg-gray-900 rounded-[32px] shadow-2xl ${landscape ? "flex flex-row items-center px-6 py-3" : "flex flex-col items-center px-3 py-4"}`}>
      {!landscape && (
        <div className="flex items-center justify-center mb-2 w-full">
          <div className="w-24 h-5 bg-gray-800 rounded-full flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-700" />
            <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
          </div>
        </div>
      )}
      {landscape && <div className="w-5 h-24 bg-gray-800 rounded-full flex flex-col items-center justify-center gap-2 mr-2">
        <div className="w-2 h-2 rounded-full bg-gray-700" />
      </div>}
      <div className="rounded-[20px] overflow-hidden bg-white flex-1" style={{ minWidth: 0 }}>
        {children}
      </div>
      {!landscape && <div className="mt-2 w-28 h-1 bg-gray-700 rounded-full" />}
      {landscape && <div className="ml-2 h-28 w-1 bg-gray-700 rounded-full" />}
    </div>
  );
}

// ─── DocPreviewPanel ───────────────────────────────────────────────────────────
function DocPreviewPanel({ design, userInfo, fullscreen = false, onEnterFullscreen, onExitFullscreen }) {
  const containerRef   = useRef(null);
  const [device, setDevice]       = useState("desktop");
  const [landscape, setLandscape] = useState(false);
  const [useAutoFit, setUseAutoFit] = useState(true);
  const [manualZoom, setManualZoom] = useState(2);
  const [fitScale, setFitScale]   = useState(0.5);

  // Pinch-to-zoom state
  const pinchRef      = useRef({ active: false, startDist: 0, startZoom: 2 });

  const spec = DEVICE_SPECS[device][landscape && device !== "desktop" ? "landscape" : "portrait"];
  const docW = spec.docW;
  const scale = useAutoFit ? fitScale : ZOOM_LEVELS[manualZoom];

  // Compute auto-fit scale
  useEffect(() => {
    if (!containerRef.current) return;
    const compute = (el) => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 20 || height < 20) return;
      // account for device frame padding (~24px each side)
      const availW = width  - 48;
      const availH = height - 64;
      const sw = availW / docW;
      const sh = availH / DOC_H;
      setFitScale(parseFloat(Math.min(sw, sh, 0.98).toFixed(4)));
    };
    const raf = requestAnimationFrame(() => containerRef.current && compute(containerRef.current));
    const ro = new ResizeObserver(([e]) => compute(e.target));
    ro.observe(containerRef.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [device, landscape, fullscreen, docW]);

  // Pinch-to-zoom handlers
  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { active: true, startDist: Math.hypot(dx, dy), startZoom: manualZoom };
    }
  }, [manualZoom]);

  const onTouchMove = useCallback((e) => {
    if (!pinchRef.current.active || e.touches.length !== 2) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const ratio = dist / pinchRef.current.startDist;
    // map ratio to zoom index
    const baseZoom = pinchRef.current.startZoom;
    let newZoom = baseZoom;
    if (ratio > 1.3) newZoom = Math.min(ZOOM_LEVELS.length - 1, baseZoom + 1);
    if (ratio < 0.7) newZoom = Math.max(0, baseZoom - 1);
    if (newZoom !== manualZoom) { setUseAutoFit(false); setManualZoom(newZoom); }
  }, [manualZoom]);

  const onTouchEnd = useCallback(() => { pinchRef.current.active = false; }, []);

  const fontCss = FONTS.find(f => f.id === design.font)?.css || FONTS[0].css;

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
    <div className="flex flex-col" style={{ flex: "1 1 0", minHeight: 0, background: fullscreen ? "#0f172a" : undefined }}>

      {/* Toolbar */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap gap-y-2 ${fullscreen ? "bg-gray-900 border-gray-700" : "bg-white"}`}>

        {/* Device switcher */}
        <div className={`flex items-center gap-0.5 rounded-lg p-0.5 ${fullscreen ? "bg-gray-800" : "bg-muted"}`}>
          {[["desktop", Monitor, "Desktop"], ["tablet", Tablet, "Tablet"], ["phone", Smartphone, "Phone"]].map(([id, Ic, lbl]) => (
            <button key={id} onClick={() => { setDevice(id); setLandscape(false); setUseAutoFit(true); }}
              title={lbl}
              className={`p-1.5 rounded-md transition-colors ${device === id ? (fullscreen ? "bg-gray-700 text-indigo-400" : "bg-white shadow text-indigo-600") : (fullscreen ? "text-gray-400 hover:text-white" : "text-muted-foreground hover:text-foreground")}`}>
              <Ic className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {/* Orientation toggle (phone/tablet only) */}
        {device !== "desktop" && (
          <button onClick={() => { setLandscape(l => !l); setUseAutoFit(true); }}
            title="Rotate device"
            className={`p-1.5 rounded-lg border transition-colors ${landscape ? (fullscreen ? "bg-indigo-900 border-indigo-600 text-indigo-400" : "bg-indigo-50 border-indigo-300 text-indigo-600") : (fullscreen ? "border-gray-700 text-gray-400" : "border-border text-muted-foreground hover:text-foreground")}`}>
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Dimensions badge */}
        <span className={`text-[10px] font-mono px-2 py-1 rounded-md ${fullscreen ? "bg-gray-800 text-gray-400" : "bg-muted text-muted-foreground"}`}>
          {spec.label}
        </span>

        <div className="flex-1" />

        {/* Zoom controls */}
        <div className={`flex items-center gap-0.5 rounded-lg p-0.5 ${fullscreen ? "bg-gray-800" : "bg-muted"}`}>
          <button onClick={() => { setUseAutoFit(false); setManualZoom(z => Math.max(0, z - 1)); }}
            disabled={!useAutoFit && manualZoom === 0}
            className={`p-1.5 rounded-md transition-colors disabled:opacity-30 ${fullscreen ? "text-gray-400 hover:text-white hover:bg-gray-700" : "text-muted-foreground hover:bg-white"}`}>
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setUseAutoFit(a => !a)}
            className={`text-xs font-mono font-bold px-2 py-1 rounded-md min-w-[44px] text-center transition-colors ${
              useAutoFit
                ? (fullscreen ? "bg-indigo-900 text-indigo-400" : "bg-indigo-100 text-indigo-700")
                : (fullscreen ? "bg-gray-700 text-white" : "bg-white text-foreground shadow")
            }`}>
            {useAutoFit ? "Fit" : ZOOM_LABELS[manualZoom]}
          </button>
          <button onClick={() => { setUseAutoFit(false); setManualZoom(z => Math.min(ZOOM_LEVELS.length - 1, z + 1)); }}
            disabled={!useAutoFit && manualZoom === ZOOM_LEVELS.length - 1}
            className={`p-1.5 rounded-md transition-colors disabled:opacity-30 ${fullscreen ? "text-gray-400 hover:text-white hover:bg-gray-700" : "text-muted-foreground hover:bg-white"}`}>
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Fullscreen toggle */}
        <button onClick={fullscreen ? onExitFullscreen : onEnterFullscreen}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          className={`p-1.5 rounded-lg border transition-colors ${fullscreen ? "border-gray-700 text-gray-400 hover:text-white hover:border-gray-500" : "border-border text-muted-foreground hover:text-foreground"}`}>
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={`flex items-center justify-center overflow-auto ${fullscreen ? "bg-gray-900" : "bg-gradient-to-br from-slate-100 to-slate-200"}`}
        style={{ flex: "1 1 0", minHeight: 0, padding: 16, touchAction: "pan-y" }}
      >
        <DeviceFrame device={device} landscape={landscape}>
          {/* Scaled document inside device frame */}
          <div style={{
            width: docW * scale,
            height: DOC_H * scale,
            overflow: "hidden",
            flexShrink: 0,
          }}>
            <div style={{
              width: docW,
              height: DOC_H,
              transformOrigin: "top left",
              transform: `scale(${scale})`,
              fontFamily: fontCss,
              transition: "transform 0.2s ease",
              pointerEvents: "none",
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
        </DeviceFrame>
      </div>
    </div>
  );
}

// ─── TabletSidePanel ───────────────────────────────────────────────────────────
function TabletSidePanel({ design, update, presetsProps }) {
  const [tab, setTab] = useState("controls");
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "1 1 0", minHeight: 0 }}>
      <div className="flex border-b border-border shrink-0">
        {[["controls","Controls"],["presets","Presets"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2.5 text-xs font-bold transition-colors border-b-2 ${tab === id ? "border-indigo-500 text-indigo-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {lbl}
          </button>
        ))}
      </div>
      <div style={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column" }}>
        {tab === "controls" ? (
          <DesignControls design={design} update={update} />
        ) : (
          <PresetsPanel {...presetsProps} />
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DocumentDesign() {
  const [design, setDesign]           = useState({ template: "classic", color: "slate", font: "inter", fontSize: "base", showNotes: true, showBankDetails: true, showSignature: true, cornerRadius: "lg", shadowEffect: "sm", pageSize: "a4" });
  const [savedDesign, setSavedDesign] = useState(null);
  const [userInfo, setUserInfo]       = useState(null);
  const [saving, setSaving]           = useState(false);
  const [activePresetId, setActivePresetId] = useState(null);
  const [savedThemes, setSavedThemes] = useState([]);
  const [savingThemeName, setSavingThemeName] = useState("");
  const [showSaveInput, setShowSaveInput]   = useState(false);
  const [mobilePanel, setMobilePanel] = useState("design"); // design | preview | themes
  const [fullscreen, setFullscreen]   = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (!user) return;
      setUserInfo(user);
      const saved = {
        template: user.doc_design_template || "classic", color: user.doc_design_color || "slate",
        font: user.doc_design_font || "inter", fontSize: user.doc_design_fontSize || "base",
        showNotes: user.doc_design_showNotes !== false, showBankDetails: user.doc_design_showBankDetails !== false,
        showSignature: user.doc_design_showSignature !== false, cornerRadius: user.doc_design_cornerRadius || "lg",
        shadowEffect: user.doc_design_shadowEffect || "sm", pageSize: user.doc_design_pageSize || "a4",
      };
      setDesign(saved); setSavedDesign(saved);
      try { setSavedThemes(JSON.parse(user.doc_design_saved_themes || "[]")); } catch { /**/ }
    });
  }, []);

  // Escape key exits fullscreen
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isDirty     = savedDesign && JSON.stringify(design) !== JSON.stringify(savedDesign);
  const update      = (k, v) => { setDesign(d => ({ ...d, [k]: v })); setActivePresetId(null); };
  const applyPreset = (p) => { setDesign(d => ({ ...d, template: p.template, color: p.color, font: p.font })); setActivePresetId(p.id); };
  const applySavedTheme = (t) => { setDesign({ ...t.design }); setActivePresetId("custom_" + t.name); };
  const deleteTheme = (name) => {
    const upd = savedThemes.filter(t => t.name !== name);
    setSavedThemes(upd); base44.auth.updateMe({ doc_design_saved_themes: JSON.stringify(upd) }); toast("Theme deleted");
  };
  const saveTheme = () => {
    if (!savingThemeName.trim()) return;
    const upd = [...savedThemes.filter(t => t.name !== savingThemeName), { name: savingThemeName.trim(), design: { ...design } }];
    setSavedThemes(upd); base44.auth.updateMe({ doc_design_saved_themes: JSON.stringify(upd) });
    setSavingThemeName(""); setShowSaveInput(false); toast.success(`Theme "${savingThemeName}" saved!`);
  };
  const save = async () => {
    setSaving(true);
    await base44.auth.updateMe({
      doc_design_template: design.template, doc_design_color: design.color, doc_design_font: design.font,
      doc_design_fontSize: design.fontSize, doc_design_showNotes: design.showNotes,
      doc_design_showBankDetails: design.showBankDetails, doc_design_showSignature: design.showSignature,
      doc_design_cornerRadius: design.cornerRadius, doc_design_shadowEffect: design.shadowEffect,
      doc_design_pageSize: design.pageSize,
    });
    setSavedDesign({ ...design }); setSaving(false);
    toast.success("Document design saved!");
  };

  const presetsProps = { activePresetId, applyPreset, savedThemes, applySavedTheme, deleteTheme, showSaveInput, setShowSaveInput, savingThemeName, setSavingThemeName, saveTheme };

  return (
    <div className="flex flex-col h-full">

      {/* ── Fullscreen overlay ── */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
            <span className="text-sm font-semibold text-white">Document Preview</span>
            <button onClick={() => setFullscreen(false)}
              className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div style={{ flex: "1 1 0", minHeight: 0 }}>
            <DocPreviewPanel design={design} userInfo={userInfo} fullscreen onEnterFullscreen={() => {}} onExitFullscreen={() => setFullscreen(false)} />
          </div>
        </div>
      )}

      {/* ── Top action bar ── */}
      <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-2 bg-white border-b border-border shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:block">
          {isDirty ? <span className="text-amber-600 font-semibold">⚠ Unsaved changes</span> : "Design your documents"}
        </span>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {isDirty && (
            <button onClick={() => { setDesign({ ...savedDesign }); setActivePresetId(null); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors">
              <RotateCcw className="h-3 w-3" /><span className="hidden sm:inline">Reset</span>
            </button>
          )}
          <Button onClick={save} disabled={saving} size="sm" className="gap-1.5 font-bold text-xs"
            style={{ background: isDirty ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : isDirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      {/* ── DESKTOP (lg+): 3-column ── */}
      <div className="hidden lg:flex" style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
        <div className="w-64 shrink-0 bg-white border-r border-border flex flex-col">
          <DesignControls design={design} update={update} />
        </div>
        <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <DocPreviewPanel design={design} userInfo={userInfo} onEnterFullscreen={() => setFullscreen(true)} onExitFullscreen={() => setFullscreen(false)} />
        </div>
        <div className="w-60 shrink-0 bg-white border-l border-border flex flex-col">
          <PresetsPanel {...presetsProps} />
        </div>
      </div>

      {/* ── TABLET (md–lg): Preview + side panel ── */}
      <div className="hidden md:flex lg:hidden" style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
        <div style={{ flex: "1 1 0", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }} className="border-r border-border">
          <DocPreviewPanel design={design} userInfo={userInfo} onEnterFullscreen={() => setFullscreen(true)} onExitFullscreen={() => setFullscreen(false)} />
        </div>
        <div style={{ width: 272, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }} className="bg-white">
          <TabletSidePanel design={design} update={update} presetsProps={presetsProps} />
        </div>
      </div>

      {/* ── MOBILE (<md): tabbed panels ── */}
      <div className="flex md:hidden flex-col" style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
        <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }} className="bg-white">
          {mobilePanel === "design" && <DesignControls design={design} update={update} />}
          {mobilePanel === "preview" && (
            <DocPreviewPanel design={design} userInfo={userInfo} onEnterFullscreen={() => setFullscreen(true)} onExitFullscreen={() => setFullscreen(false)} />
          )}
          {mobilePanel === "themes" && <PresetsPanel {...presetsProps} />}
        </div>
        {/* Bottom tab bar */}
        <div className="flex border-t border-border bg-white shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {[["design", Settings2, "Controls"], ["preview", Image, "Preview"], ["themes", Star, "Themes"]].map(([id, Ic, lbl]) => (
            <button key={id} onClick={() => setMobilePanel(id)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${mobilePanel === id ? "text-indigo-600" : "text-muted-foreground"}`}>
              <Ic className="h-5 w-5" />
              <span className="text-[10px] font-semibold">{lbl}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}