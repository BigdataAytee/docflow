import { useState, useEffect, useRef } from "react";
import {
  FileDown, Upload, PenLine, CheckCircle2, X, ZoomIn, ZoomOut,
  Monitor, Tablet, Smartphone, ChevronDown, ChevronUp,
  Palette, Type, Layout, Star, Save
} from "lucide-react";

const Check = CheckCircle2;
import { Button } from "@/components/ui/button";
import DocumentPreview from "./DocumentPreview";
import { LAYOUTS, COLOR_SCHEMES, LayoutThumb } from "./TemplateSelector";
import FieldLayoutEditor from "./settings/FieldLayoutEditor";
import BrandColorPicker from "./settings/BrandColorPicker";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "₵", KES: "KSh", ZAR: "R", CAD: "CA$", AUD: "A$" };

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
  { id: "classic",   label: "Classic"   },
  { id: "modern",    label: "Modern"    },
  { id: "minimal",   label: "Minimal"   },
  { id: "bold",      label: "Bold"      },
  { id: "elegant",   label: "Elegant"   },
  { id: "sidebar",   label: "Sidebar"   },
  { id: "executive", label: "Executive" },
  { id: "wave",      label: "Wave"      },
  { id: "compact",   label: "Compact"   },
  { id: "sikky",     label: "Sikky"     },
];

const PRESETS = [
  { id: "modern_pro",    label: "Modern Professional",  template: "modern",    color: "slate",    font: "inter",        emoji: "💼", group: "Professional" },
  { id: "executive",     label: "Executive Report",     template: "classic",   color: "charcoal", font: "merriweather", emoji: "🏛️", group: "Professional" },
  { id: "corporate",     label: "Corporate Premium",    template: "bold",      color: "slate",    font: "montserrat",   emoji: "🏢", group: "Professional" },
  { id: "boardroom",     label: "Boardroom Black",      template: "bold",      color: "charcoal", font: "montserrat",   emoji: "🖤", group: "Professional" },
  { id: "navy_exec",     label: "Navy Executive",       template: "classic",   color: "indigo",   font: "merriweather", emoji: "🔷", group: "Professional" },
  { id: "clean_tech",    label: "Clean Technical",      template: "minimal",   color: "blue",     font: "roboto",       emoji: "🔧", group: "Professional" },
  { id: "elegant_biz",   label: "Elegant Business",     template: "elegant",   color: "gold",     font: "playfair",     emoji: "✨", group: "Elegant" },
  { id: "royal_gold",    label: "Royal Gold",           template: "bold",      color: "gold",     font: "playfair",     emoji: "👑", group: "Elegant" },
  { id: "black_tie",     label: "Black Tie",            template: "elegant",   color: "charcoal", font: "playfair",     emoji: "🎩", group: "Elegant" },
  { id: "ivory_classic", label: "Ivory Classic",        template: "classic",   color: "gold",     font: "georgia",      emoji: "🤍", group: "Elegant" },
  { id: "deep_plum",     label: "Deep Plum",            template: "elegant",   color: "purple",   font: "playfair",     emoji: "🍇", group: "Elegant" },
  { id: "rose_luxury",   label: "Rose Luxe",            template: "elegant",   color: "rose",     font: "georgia",      emoji: "🌹", group: "Elegant" },
  { id: "creative",      label: "Creative Portfolio",   template: "modern",    color: "indigo",   font: "poppins",      emoji: "🎨", group: "Creative" },
  { id: "startup",       label: "Startup Pitch",        template: "modern",    color: "purple",   font: "poppins",      emoji: "🚀", group: "Creative" },
  { id: "magazine",      label: "Modern Magazine",      template: "bold",      color: "rose",     font: "montserrat",   emoji: "📰", group: "Creative" },
  { id: "neon_agency",   label: "Neon Agency",          template: "bold",      color: "indigo",   font: "poppins",      emoji: "⚡", group: "Creative" },
  { id: "minimalist",    label: "Minimalist",           template: "minimal",   color: "slate",    font: "lato",         emoji: "⬜", group: "Minimal" },
  { id: "zen_minimal",   label: "Zen Minimal",          template: "minimal",   color: "teal",     font: "lato",         emoji: "🪷", group: "Minimal" },
  { id: "eco",           label: "Natural & Fresh",      template: "modern",    color: "emerald",  font: "lato",         emoji: "🌿", group: "Nature" },
  { id: "ocean_breeze",  label: "Ocean Breeze",         template: "elegant",   color: "teal",     font: "lato",         emoji: "🌊", group: "Nature" },
  { id: "sunset_warm",   label: "Sunset Warm",          template: "modern",    color: "amber",    font: "poppins",      emoji: "🌅", group: "Nature" },
];

const DOC_W = 794;
const DOC_H = 1123;

// ── Accordion section (same pattern as DocumentDesign) ─────────────────────────
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

// ── Design controls panel ──────────────────────────────────────────────────────
function DesignControls({ design, update }) {
  const accentSwatch = COLOR_PALETTES.find(p => p.id === design.color)?.swatch;
  return (
    <>
      <AccordionSection title="Templates" IconComp={Layout} defaultOpen>
        <div className="grid grid-cols-5 gap-2">
          {LAYOUT_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => update("template", t.id)} title={t.label}
              className="flex flex-col items-center gap-1 group">
              <div className={`relative rounded-lg border-2 overflow-hidden transition-all w-full ${design.template === t.id ? "border-indigo-500 ring-2 ring-indigo-200" : "border-border hover:border-indigo-300"}`}
                style={{ aspectRatio: "3/4", background: "#fff" }}>
                <LayoutThumb id={t.id} accentColor={accentSwatch} />
                {design.template === t.id && (
                  <div className="absolute inset-0 flex items-end justify-center pb-1 bg-indigo-500/10">
                    <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  </div>
                )}
              </div>
              <span className={`text-[9px] font-semibold leading-tight text-center ${design.template === t.id ? "text-indigo-600" : "text-muted-foreground"}`}>{t.label}</span>
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
        <p className="text-[10px] text-muted-foreground mb-3">{COLOR_PALETTES.find(p => p.id === design.color)?.label}</p>
        <BrandColorPicker
          label="Custom Brand Color"
          value={design.customColor || COLOR_PALETTES.find(p => p.id === design.color)?.swatch || "#4f46e5"}
          onChange={(hex) => update("customColor", hex)}
        />
        {design.customColor && (
          <button onClick={() => update("customColor", null)} className="mt-1.5 text-[10px] text-muted-foreground hover:text-destructive transition-colors">
            ✕ Clear custom color
          </button>
        )}
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
      </AccordionSection>
    </>
  );
}

// ── Style presets panel ────────────────────────────────────────────────────────
function StylePresets({ activePresetId, applyPreset }) {
  return (
    <div className="px-4 pt-4 pb-3">
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
                {activePresetId === p.id && <Check className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Live preview (same as DocumentDesign's DesktopPreview) ────────────────────
function LivePreview({ doc, design, calcs, sym }) {
  const containerRef = useRef(null);
  const [fitScale, setFitScale] = useState(0.5);
  const [useAutoFit, setUseAutoFit] = useState(true);
  const [manualZoom, setManualZoom] = useState(2);
  const [device, setDevice] = useState("desktop");

  const ZOOM_LEVELS = [0.4, 0.5, 0.65, 0.75, 1];
  const ZOOM_LABELS = ["40%", "50%", "65%", "75%", "100%"];
  const previewW = device === "desktop" ? DOC_W : device === "tablet" ? 600 : 375;
  const scale = useAutoFit ? fitScale : ZOOM_LEVELS[manualZoom];
  const fontCss = FONTS.find(f => f.id === design.font)?.css || FONTS[0].css;

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
              form={doc}
              items={doc.items || []}
              calcs={calcs}
              sym={sym}
              docType={doc.type}
              managerSig={doc.manager_signature}
              customerSig={doc.customer_signature}
              template={design.template}
              templateColor={design.color}
              templateFont={design.font}
              customColor={design.customColor}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile mini-preview ────────────────────────────────────────────────────────
function MiniPreview({ doc, design, calcs, sym }) {
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

  return (
    <div ref={containerRef} className="bg-slate-100 flex items-center justify-center w-full" style={{ height: 300, overflow: "hidden" }}>
      <div style={{ width: DOC_W * scale, height: DOC_H * scale, flexShrink: 0, boxShadow: "0 4px 24px rgba(0,0,0,0.18)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: DOC_W, height: DOC_H, transformOrigin: "top left", transform: `scale(${scale})`, pointerEvents: "none" }}>
          <DocumentPreview
            form={doc} items={doc.items || []} calcs={calcs} sym={sym}
            docType={doc.type} managerSig={doc.manager_signature} customerSig={doc.customer_signature}
            template={design.template} templateColor={design.color} templateFont={design.font}
            customColor={design.customColor}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export default function ViewDocPdfModal({ doc, pdfRef, generatingPdf, onClose, onDownload, onShare, onSign }) {
  const sym = CURRENCY_SYMBOLS[doc.currency] || doc.currency || "₦";
  const calcs = {
    subtotal: doc.subtotal, taxAmt: doc.tax_amount, total: doc.total,
    withholdingVatAmt: doc.withholding_vat_amount || 0,
    netPayable: doc.balance_due || doc.total,
    globalDiscAmt: doc.global_discount_amount || 0,
  };

  const [design, setDesign] = useState({
    template: doc.template || "classic",
    color: doc.template_color || "slate",
    font: doc.template_font || "inter",
    customColor: null,
  });
  const [activePresetId, setActivePresetId] = useState(null);
  const [saving, setSaving] = useState(false);

  const update = (k, v) => { setDesign(d => ({ ...d, [k]: v })); setActivePresetId(null); };
  const applyPreset = (p) => { setDesign(d => ({ ...d, template: p.template, color: p.color, font: p.font })); setActivePresetId(p.id); };

  const save = async () => {
    setSaving(true);
    await base44.entities.Document.update(doc.id, {
      template: design.template,
      template_color: design.color,
      template_font: design.font,
    });
    setSaving(false);
    toast.success("Document design saved!");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">

      {/* ── Top bar (mirrors Settings design tab top bar) ── */}
      <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-2 bg-white border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{doc.number}</p>
            <p className="text-xs text-muted-foreground truncate capitalize">{doc.type} · Preview &amp; Design</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Waybill sign button */}
          {doc.type === "waybill" && !doc.customer_signature && (
            <button onClick={onSign}
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors">
              <PenLine className="h-3.5 w-3.5" /> Sign
            </button>
          )}
          <button onClick={onDownload} disabled={generatingPdf}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <FileDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{generatingPdf ? "…" : "Download"}</span>
          </button>
          <button onClick={onShare} disabled={generatingPdf}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <Button onClick={save} disabled={saving} size="sm" className="gap-1.5 font-bold text-xs"
            style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* ── DESKTOP (lg+): 3-column layout identical to DocumentDesign ── */}
      <div className="hidden lg:flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Design controls */}
        <div className="w-64 shrink-0 bg-white border-r border-border overflow-y-auto">
          <div className="px-3 py-2 border-b border-border bg-indigo-50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Design Controls</p>
          </div>
          <DesignControls design={design} update={update} />
        </div>
        {/* Center: Live preview */}
        <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <LivePreview doc={doc} design={design} calcs={calcs} sym={sym} />
        </div>
        {/* Right: Style presets */}
        <div className="w-60 shrink-0 bg-white border-l border-border overflow-y-auto">
          <div className="px-3 py-2 border-b border-border bg-amber-50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Style Presets</p>
          </div>
          <StylePresets activePresetId={activePresetId} applyPreset={applyPreset} />
        </div>
      </div>

      {/* ── TABLET & PHONE (<lg): same layout as DocumentDesign mobile ── */}
      <div className="flex lg:hidden flex-1 flex-col overflow-hidden bg-slate-50">
        {/* Sticky preview at top */}
        <div className="shrink-0 border-b border-border bg-white">
          <MiniPreview doc={doc} design={design} calcs={calcs} sym={sym} />
        </div>
        {/* Controls + Presets side by side, scrollable */}
        <div className="flex flex-1 overflow-y-auto min-h-0">
          <div className="flex-1 min-w-0 border-r border-border bg-white overflow-y-auto">
            <div className="px-3 py-2 border-b border-border bg-indigo-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Design Controls</p>
            </div>
            <DesignControls design={design} update={update} />
          </div>
          <div className="flex-1 min-w-0 bg-white overflow-y-auto">
            <div className="px-3 py-2 border-b border-border bg-amber-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Style Presets</p>
            </div>
            <StylePresets activePresetId={activePresetId} applyPreset={applyPreset} />
          </div>
        </div>
      </div>

      {/* Hidden off-screen render for PDF export */}
      <div style={{ position: "fixed", top: 0, left: "-9999px", width: "794px", zIndex: -1, pointerEvents: "none", opacity: 0 }}>
        <div ref={pdfRef} style={{ width: "794px" }}>
          <DocumentPreview
            form={doc} items={doc.items || []} calcs={calcs} sym={sym}
            docType={doc.type} managerSig={doc.manager_signature} customerSig={doc.customer_signature}
            template={design.template} templateColor={design.color} templateFont={design.font}
            customColor={design.customColor}
          />
        </div>
      </div>
    </div>
  );
}