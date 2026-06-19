import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Trash2, Printer, Send, Pencil, Share2, FileDown, MoreVertical,
  Upload, Copy, GitMerge, PenLine, CheckCircle2, Receipt, Truck,
  ZoomIn, ZoomOut, Monitor, Tablet, Smartphone, ChevronDown, ChevronUp,
  Palette, Type, Layout, Star, Save, RotateCcw
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SignaturePad from "../components/SignaturePad";
import WaybillSignatureModal from "../components/WaybillSignatureModal";
import ConvertDocumentModal from "../components/ConvertDocumentModal";
import DocumentPreview from "../components/DocumentPreview";
import { LAYOUTS, COLOR_SCHEMES, LayoutThumb } from "../components/TemplateSelector";
import BrandColorPicker from "../components/settings/BrandColorPicker";

const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "₵", KES: "KSh", ZAR: "R", CAD: "CA$", AUD: "A$" };

const TYPE_LABELS = { invoice: "INVOICE", quotation: "QUOTATION", receipt: "RECEIPT", waybill: "WAYBILL" };
const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-500", sent: "bg-blue-50 text-blue-600", viewed: "bg-indigo-50 text-indigo-600",
  paid: "bg-emerald-50 text-emerald-600", partially_paid: "bg-teal-50 text-teal-600", overdue: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-500", accepted: "bg-emerald-50 text-emerald-600", rejected: "bg-red-50 text-red-600",
  pending: "bg-amber-50 text-amber-600", packed: "bg-blue-50 text-blue-600", dispatched: "bg-indigo-50 text-indigo-600",
  in_transit: "bg-purple-50 text-purple-600", delivered: "bg-emerald-50 text-emerald-600", returned: "bg-red-50 text-red-600",
  to_be_signed: "bg-amber-50 text-amber-700", to_be_delivered: "bg-orange-50 text-orange-700",
};
const STATUS_BY_TYPE = {
  invoice: ["draft","sent","viewed","partially_paid","paid","overdue","cancelled"],
  quotation: ["draft","sent","viewed","accepted","rejected","cancelled"],
  receipt: ["draft","sent","paid"],
  waybill: ["pending","packed","dispatched","in_transit","delivered","returned","to_be_signed","to_be_delivered"],
};

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
  { id: "classic",   label: "Classic"   }, { id: "modern",    label: "Modern"    },
  { id: "minimal",   label: "Minimal"   }, { id: "bold",      label: "Bold"      },
  { id: "elegant",   label: "Elegant"   }, { id: "sidebar",   label: "Sidebar"   },
  { id: "executive", label: "Executive" }, { id: "wave",      label: "Wave"      },
  { id: "compact",   label: "Compact"   }, { id: "sikky",     label: "Sikky"     },
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
  { id: "minimalist",    label: "Minimalist",           template: "minimal",   color: "slate",    font: "lato",         emoji: "⬜", group: "Minimal" },
  { id: "zen_minimal",   label: "Zen Minimal",          template: "minimal",   color: "teal",     font: "lato",         emoji: "🪷", group: "Minimal" },
  { id: "eco",           label: "Natural & Fresh",      template: "modern",    color: "emerald",  font: "lato",         emoji: "🌿", group: "Nature" },
  { id: "ocean_breeze",  label: "Ocean Breeze",         template: "elegant",   color: "teal",     font: "lato",         emoji: "🌊", group: "Nature" },
  { id: "sunset_warm",   label: "Sunset Warm",          template: "modern",    color: "amber",    font: "poppins",      emoji: "🌅", group: "Nature" },
];

const DOC_W = 794;
const DOC_H = 1123;

// ── Accordion ─────────────────────────────────────────────────────────────────
function AccordionSection({ title, IconComp, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-b-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors">
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

// ── Design Controls ────────────────────────────────────────────────────────────
function DesignControls({ design, update }) {
  const accentSwatch = COLOR_PALETTES.find(p => p.id === design.color)?.swatch;
  return (
    <>
      <AccordionSection title="Templates" IconComp={Layout} defaultOpen>
        <div className="grid grid-cols-5 gap-2">
          {LAYOUT_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => update("template", t.id)} title={t.label} className="flex flex-col items-center gap-1 group">
              <div className={`relative rounded-lg border-2 overflow-hidden transition-all w-full ${design.template === t.id ? "border-indigo-500 ring-2 ring-indigo-200" : "border-border hover:border-indigo-300"}`}
                style={{ aspectRatio: "3/4", background: "#fff" }}>
                <LayoutThumb id={t.id} accentColor={accentSwatch} />
                {design.template === t.id && (
                  <div className="absolute inset-0 flex items-end justify-center pb-1 bg-indigo-500/10">
                    <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 flex items-center justify-center">
                      <CheckCircle2 className="h-2.5 w-2.5 text-white" />
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
          <button onClick={() => update("customColor", null)} className="mt-1.5 text-[10px] text-muted-foreground hover:text-destructive transition-colors">✕ Clear custom color</button>
        )}
      </AccordionSection>

      <AccordionSection title="Typography" IconComp={Type}>
        <div className="space-y-1">
          {FONTS.map(f => (
            <button key={f.id} onClick={() => update("font", f.id)} style={{ fontFamily: f.css }}
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

// ── Style Presets ──────────────────────────────────────────────────────────────
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
                {activePresetId === p.id && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Desktop Preview ────────────────────────────────────────────────────────────
function DesktopPreview({ doc, design, calcs, sym }) {
  const containerRef = useRef(null);
  const [fitScale, setFitScale] = useState(0.6);
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
            disabled={!useAutoFit && manualZoom === 0} className="p-1.5 rounded-md hover:bg-white text-muted-foreground disabled:opacity-30 transition-colors">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setUseAutoFit(a => !a)}
            className={`text-xs font-mono font-bold px-2 py-1 rounded-md min-w-[44px] text-center transition-colors ${useAutoFit ? "bg-indigo-100 text-indigo-700" : "bg-white text-foreground shadow"}`}>
            {useAutoFit ? "Fit" : ZOOM_LABELS[manualZoom]}
          </button>
          <button onClick={() => { setUseAutoFit(false); setManualZoom(z => Math.min(ZOOM_LEVELS.length - 1, z + 1)); }}
            disabled={!useAutoFit && manualZoom === ZOOM_LEVELS.length - 1} className="p-1.5 rounded-md hover:bg-white text-muted-foreground disabled:opacity-30 transition-colors">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div ref={containerRef} style={{ flex: "1 1 0", minHeight: 0 }}
        className="bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden p-4">
        <div style={{ width: previewW * scale, height: DOC_H * scale, flexShrink: 0, boxShadow: "0 6px 32px rgba(0,0,0,0.18)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ width: previewW, height: DOC_H, transformOrigin: "top left", transform: `scale(${scale})`, fontFamily: fontCss, pointerEvents: "none", transition: "transform 0.25s ease" }}>
            <DocumentPreview form={doc} items={doc.items || []} calcs={calcs} sym={sym} docType={doc.type}
              managerSig={doc.manager_signature} customerSig={doc.customer_signature}
              template={design.template} templateColor={design.color} templateFont={design.font} customColor={design.customColor} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile Mini Preview ────────────────────────────────────────────────────────
function MiniPreview({ doc, design, calcs, sym, fixedHeight = 380 }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    if (!containerRef.current) return;
    const compute = (el) => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 10 || height < 10) return;
      setScale(parseFloat(Math.min((width - 16) / DOC_W, (height - 16) / DOC_H, 1).toFixed(4)));
    };
    const raf = requestAnimationFrame(() => compute(containerRef.current));
    const ro = new ResizeObserver(([e]) => compute(e.target));
    ro.observe(containerRef.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return (
    <div ref={containerRef} className="bg-slate-100 flex items-center justify-center w-full" style={{ height: fixedHeight, overflow: "hidden" }}>
      <div style={{ width: DOC_W * scale, height: DOC_H * scale, flexShrink: 0, boxShadow: "0 4px 24px rgba(0,0,0,0.18)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: DOC_W, height: DOC_H, transformOrigin: "top left", transform: `scale(${scale})`, pointerEvents: "none" }}>
          <DocumentPreview form={doc} items={doc.items || []} calcs={calcs} sym={sym} docType={doc.type}
            managerSig={doc.manager_signature} customerSig={doc.customer_signature}
            template={design.template} templateColor={design.color} templateFont={design.font} customColor={design.customColor} />
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ViewDocument() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showInlineSigPad, setShowInlineSigPad] = useState(false);
  const [convertTarget, setConvertTarget] = useState(null);
  const pdfDocRef = useRef(null);

  const [design, setDesign] = useState({ template: "classic", color: "slate", font: "inter", customColor: null });
  const [savedDesign, setSavedDesign] = useState(null);
  const [activePresetId, setActivePresetId] = useState(null);
  const [saving, setSaving] = useState(false);

  const isDirty = savedDesign && JSON.stringify(design) !== JSON.stringify(savedDesign);
  const update = (k, v) => { setDesign(d => ({ ...d, [k]: v })); setActivePresetId(null); };
  const applyPreset = (p) => { setDesign(d => ({ ...d, template: p.template, color: p.color, font: p.font })); setActivePresetId(p.id); };

  useEffect(() => {
    Promise.all([base44.entities.Document.get(docId), base44.auth.me()]).then(([d, user]) => {
      if (d && user && d.created_by !== user.email && user.role !== "admin") { navigate("/documents"); return; }
      if (user) {
        d = { ...d, logo_url: user.logo_url || d.logo_url || "", company_name: user.company_name || d.company_name || "",
          company_email: user.company_email || user.email || d.company_email || "", company_phone: user.company_phone || d.company_phone || "",
          company_address: user.company_address || d.company_address || "", company_website: user.company_website || d.company_website || "",
          document_tagline: user.document_tagline || "", footer_contact_line: user.footer_contact_line || "" };
      }
      setDoc(d);
      const des = { template: d.template || "classic", color: d.template_color || "slate", font: d.template_font || "inter", customColor: null };
      setDesign(des); setSavedDesign(des);
      setLoading(false);
    });
  }, [docId]);

  const updateStatus = async (status) => { await base44.entities.Document.update(docId, { status }); setDoc(prev => ({ ...prev, status })); };
  const uploadSig = async (dataUrl) => {
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(data); const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const file = new File([arr], 'signature.png', { type: mime });
    const { file_url } = await base44.integrations.Core.UploadFile({ file }); return file_url;
  };

  const handleSoftSigSave = async (sig) => {
    const now = new Date();
    const sigUrl = await uploadSig(sig);
    const updates = { customer_signature: sigUrl, receiver_date: now.toISOString().split("T")[0], receiver_time: now.toTimeString().slice(0, 5), delivery_signed_at: now.toISOString(), status: "delivered" };
    await base44.entities.Document.update(docId, updates);
    setDoc(prev => ({ ...prev, ...updates }));
    setShowInlineSigPad(false);
    toast.success("Signature captured!");
  };

  const handleDeliveryConfirmed = (updatedDoc) => setDoc(prev => ({ ...prev, ...updatedDoc }));

  const generatePdfBlob = async () => {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const element = pdfDocRef.current;
    const wrapper = element.parentElement;
    const savedStyle = wrapper.getAttribute("style");
    wrapper.setAttribute("style", "position:fixed;top:0;left:-9999px;width:794px;z-index:9999;opacity:0;pointer-events:none;");
    element.style.width = "794px";
    await new Promise(r => setTimeout(r, 300));
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", width: 794, windowWidth: 794, scrollX: 0, scrollY: 0, logging: false });
    wrapper.setAttribute("style", savedStyle || "");
    element.style.width = "";
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();
    const imgHeightMm = (canvas.height / canvas.width) * pageWidthMm;
    let remaining = imgHeightMm; let yPos = 0;
    pdf.addImage(imgData, "JPEG", 0, yPos, pageWidthMm, imgHeightMm);
    remaining -= pageHeightMm;
    while (remaining > 30) { yPos -= pageHeightMm; pdf.addPage(); pdf.addImage(imgData, "JPEG", 0, yPos, pageWidthMm, imgHeightMm); remaining -= pageHeightMm; }
    return pdf.output("blob");
  };

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    const blob = await generatePdfBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${doc.number || "document"}.pdf`; a.click(); URL.revokeObjectURL(url);
    setGeneratingPdf(false);
  };

  const handleSharePdf = async () => {
    setGeneratingPdf(true);
    const blob = await generatePdfBlob();
    const file = new File([blob], `${doc.number || "document"}.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: doc.number, text: `${doc.number} — ${doc.customer_name}` });
    } else {
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${doc.number || "document"}.pdf`; a.click(); URL.revokeObjectURL(url);
    }
    setGeneratingPdf(false);
  };

  const handleDelete = async () => { await base44.entities.Document.delete(docId); navigate("/documents"); };
  const handleDuplicate = async () => {
    const { id, created_date, updated_date, created_by, ...rest } = doc;
    const created = await base44.entities.Document.create({ ...rest, number: `${rest.number}-copy`, status: "draft", manager_signature: "", customer_signature: "", paid_amount: 0 });
    toast.success("Document duplicated!"); navigate(`/documents/${created.id}`);
  };

  const handleConvertConfirm = async (formData) => {
    const { id, created_date, updated_date, created_by, ...rest } = doc;
    const isReceipt = convertTarget === "receipt"; const isWaybill = convertTarget === "waybill";
    const newDoc = { ...rest, type: convertTarget, number: formData.number, status: isReceipt ? "paid" : isWaybill ? "pending" : "draft",
      issue_date: formData.issue_date ? new Date(formData.issue_date).toISOString() : new Date().toISOString(),
      due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
      notes: formData.notes, manager_signature: rest.manager_signature || "", customer_signature: "",
      payment_method: formData.payment_method || rest.payment_method || undefined,
      ...(isReceipt ? { paid_amount: rest.total || 0, balance_due: 0 } : { paid_amount: 0 }) };
    const created = await base44.entities.Document.create(newDoc);
    setConvertTarget(null);
    toast.success(`${convertTarget.charAt(0).toUpperCase() + convertTarget.slice(1)} created!`);
    navigate(`/documents/${created.id}`);
  };

  const saveDesign = async () => {
    setSaving(true);
    await base44.entities.Document.update(docId, { template: design.template, template_color: design.color, template_font: design.font });
    setDoc(prev => ({ ...prev, template: design.template, template_color: design.color, template_font: design.font }));
    setSavedDesign({ ...design });
    setSaving(false);
    toast.success("Design saved!");
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!doc) return <div className="text-center py-12 text-muted-foreground">Document not found</div>;

  const sym = CURRENCY_SYMBOLS[doc.currency] || doc.currency || "₦";
  const calcs = { subtotal: doc.subtotal, taxAmt: doc.tax_amount, globalDiscAmt: doc.global_discount_amount || 0, total: doc.total, withholdingVatAmt: doc.withholding_vat_amount || 0, netPayable: doc.balance_due || doc.total };

  return (
    <div className="flex flex-col h-full">

      {/* ── Top action bar ── */}
      <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-2 bg-white border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate(`/documents?type=${doc.type}`)} className="p-1.5 rounded-lg hover:bg-muted shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{doc.number}</p>
            <p className="text-xs text-muted-foreground capitalize hidden sm:block">{doc.type} · Preview &amp; Design</p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${STATUS_COLORS[doc.status]}`}>{doc.status?.replace(/_/g, " ")}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {isDirty ? <span className="text-amber-600 font-semibold">⚠ Unsaved design</span> : "Customise how your document looks"}
          </span>

          {doc.type === "quotation" && (<>
            <Button variant="outline" size="sm" className="h-8 px-2.5 hidden md:flex gap-1 border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs" onClick={() => setConvertTarget("invoice")}><GitMerge className="h-3.5 w-3.5" />→ Invoice</Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5 hidden md:flex gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs" onClick={() => setConvertTarget("receipt")}><Receipt className="h-3.5 w-3.5" />→ Receipt</Button>
          </>)}
          {doc.type === "invoice" && (<>
            <Button variant="outline" size="sm" className="h-8 px-2.5 hidden md:flex gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs" onClick={() => setConvertTarget("receipt")}><Receipt className="h-3.5 w-3.5" />→ Receipt</Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5 hidden md:flex gap-1 border-orange-300 text-orange-700 hover:bg-orange-50 text-xs" onClick={() => setConvertTarget("waybill")}><Truck className="h-3.5 w-3.5" />→ Waybill</Button>
          </>)}
          {doc.type === "waybill" && !doc.customer_signature && (
            <button onClick={() => setShowInlineSigPad(true)} className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors">
              <PenLine className="h-3.5 w-3.5" /> Sign
            </button>
          )}
          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs gap-1" onClick={() => navigate(`/documents/new?edit=${docId}&type=${doc.type}`)}>
            <Pencil className="h-3.5 w-3.5" /><span className="hidden sm:inline">Edit</span>
          </Button>
          <button onClick={handleDownloadPdf} disabled={generatingPdf} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <FileDown className="h-3.5 w-3.5" /><span className="hidden sm:inline">{generatingPdf ? "…" : "Download"}</span>
          </button>
          <button onClick={handleSharePdf} disabled={generatingPdf} className="items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors hidden sm:flex">
            <Upload className="h-3.5 w-3.5" />Share
          </button>
          <Button onClick={saveDesign} disabled={saving} size="sm" className="gap-1.5 font-bold text-xs h-8"
            style={{ background: isDirty ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : isDirty ? "Save" : "Saved"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8"><MoreVertical className="h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="md:hidden px-2 py-1.5">
                <p className="text-xs text-muted-foreground mb-1">Change Status</p>
                {(STATUS_BY_TYPE[doc.type] || STATUS_BY_TYPE.invoice).map(s => (
                  <button key={s} onClick={() => updateStatus(s)} className={`block w-full text-left px-2 py-1 rounded text-xs capitalize hover:bg-muted ${doc.status === s ? "font-bold text-primary" : ""}`}>{s.replace(/_/g, " ")}</button>
                ))}
              </div>
              <DropdownMenuSeparator className="md:hidden" />
              <DropdownMenuItem onClick={handleSharePdf} disabled={generatingPdf}><Upload className="h-4 w-4 mr-2" />Share PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</DropdownMenuItem>
              {doc.status === "draft" && <DropdownMenuItem onClick={() => updateStatus("sent")}><Send className="h-4 w-4 mr-2" />Mark as Sent</DropdownMenuItem>}
              <DropdownMenuItem onClick={handleDuplicate}><Copy className="h-4 w-4 mr-2" />Duplicate</DropdownMenuItem>
              {doc.type === "quotation" && (<>
                <DropdownMenuItem onClick={() => setConvertTarget("invoice")}><GitMerge className="h-4 w-4 mr-2" />Convert to Invoice</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConvertTarget("receipt")}><Receipt className="h-4 w-4 mr-2" />Convert to Receipt</DropdownMenuItem>
              </>)}
              {doc.type === "invoice" && (<>
                <DropdownMenuItem onClick={() => setConvertTarget("receipt")}><Receipt className="h-4 w-4 mr-2" />Convert to Receipt</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConvertTarget("waybill")}><Truck className="h-4 w-4 mr-2" />Convert to Waybill</DropdownMenuItem>
              </>)}
              {doc.type === "waybill" && <DropdownMenuItem onClick={() => setShowSignModal(true)}><PenLine className="h-4 w-4 mr-2" />Sign Delivery</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── DESKTOP (lg+): 3-column like Settings Design tab ── */}
      <div className="hidden lg:flex flex-1 min-h-0 overflow-hidden">
        <div className="w-64 shrink-0 bg-white border-r border-border overflow-y-auto">
          <div className="px-3 py-2 border-b border-border bg-indigo-50 sticky top-0 z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Design Controls</p>
          </div>
          <DesignControls design={design} update={update} />
        </div>
        <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <DesktopPreview doc={doc} design={design} calcs={calcs} sym={sym} />
        </div>
        <div className="w-60 shrink-0 bg-white border-l border-border overflow-y-auto">
          <div className="px-3 py-2 border-b border-border bg-amber-50 sticky top-0 z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Style Presets</p>
          </div>
          <StylePresets activePresetId={activePresetId} applyPreset={applyPreset} />
        </div>
      </div>

      {/* ── MOBILE/TABLET (<lg): same as Settings Design mobile layout ── */}
      <div className="flex lg:hidden flex-1 flex-col overflow-hidden bg-slate-50">
        <div className="shrink-0 border-b border-border bg-white">
          <MiniPreview doc={doc} design={design} calcs={calcs} sym={sym} fixedHeight={380} />
        </div>
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

      {/* Hidden PDF render target */}
      <div style={{ position: "fixed", top: 0, left: "-9999px", width: "794px", zIndex: -1, pointerEvents: "none", opacity: 0 }}>
        <div ref={pdfDocRef} style={{ width: "794px" }}>
          {doc && <DocumentPreview form={doc} items={doc.items || []} calcs={calcs} sym={sym} docType={doc.type}
            managerSig={doc.manager_signature} customerSig={doc.customer_signature}
            template={design.template} templateColor={design.color} templateFont={design.font} customColor={design.customColor} />}
        </div>
      </div>

      {/* Inline Signature */}
      {showInlineSigPad && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/80" onClick={() => setShowInlineSigPad(false)}>
          <div className="mt-auto bg-white rounded-t-3xl shadow-2xl" style={{ maxHeight: "92dvh" }} onClick={e => e.stopPropagation()}>
            <div className="bg-slate-900 text-white px-6 py-5 rounded-t-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center"><PenLine className="h-5 w-5 text-emerald-400" /></div>
                <div><h2 className="font-bold text-base">Receiver Signature</h2><p className="text-xs text-slate-400">{doc.number} · {doc.customer_name}</p></div>
              </div>
              <button onClick={() => setShowInlineSigPad(false)} className="p-2 hover:bg-slate-700 rounded-lg"><span className="text-lg">✕</span></button>
            </div>
            <div className="p-5 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-4 text-center">Sign below using your finger, mouse, or stylus.</p>
              <SignaturePad label="Receiver Signature" onSave={handleSoftSigSave} />
            </div>
          </div>
        </div>
      )}

      {showSignModal && doc.type === "waybill" && (
        <WaybillSignatureModal doc={doc} onClose={() => setShowSignModal(false)} onSaved={handleDeliveryConfirmed} />
      )}
      {convertTarget && (
        <ConvertDocumentModal doc={doc} targetType={convertTarget} onConfirm={handleConvertConfirm} onClose={() => setConvertTarget(null)} />
      )}
    </div>
  );
}