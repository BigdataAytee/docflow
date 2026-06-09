import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, X, Loader2, CheckCircle2, RefreshCw, Wand2, ImagePlus, Zap, Palette, Contrast, Crop, Brush, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const STYLES = [
  { id: "modern",  label: "Modern",  emoji: "⚡", bg: "linear-gradient(135deg,#6366f1,#8b5cf6)", prompt: "ultra-modern flat geometric logo, bold sans-serif, sharp angles, contemporary, white background" },
  { id: "minimal", label: "Minimal", emoji: "○",  bg: "linear-gradient(135deg,#64748b,#94a3b8)", prompt: "minimalist logo, extreme simplicity, thin elegant lines, generous white space, white background" },
  { id: "bold",    label: "Bold",    emoji: "◼",  bg: "linear-gradient(135deg,#dc2626,#f97316)", prompt: "bold impactful logo, heavy typography, high contrast, powerful solid fills, white background" },
  { id: "classic", label: "Classic", emoji: "🏛", bg: "linear-gradient(135deg,#92400e,#d97706)", prompt: "classic traditional crest badge logo, timeless serif typography, established professional, white background" },
  { id: "tech",    label: "Tech",    emoji: "◈",  bg: "linear-gradient(135deg,#0ea5e9,#6366f1)", prompt: "futuristic tech startup logo, circuit or data-inspired icon, electric palette, cutting-edge digital, white background" },
  { id: "elegant", label: "Elegant", emoji: "✦",  bg: "linear-gradient(135deg,#be185d,#9333ea)", prompt: "luxury brand logo, gold and black palette, thin stroke serifs, high-end fashion aesthetic, white background" },
  { id: "playful", label: "Playful", emoji: "★",  bg: "linear-gradient(135deg,#f59e0b,#ec4899)", prompt: "playful fun logo, rounded bubbly shapes, bright cheerful multi-color, friendly energetic, white background" },
  { id: "nature",  label: "Nature",  emoji: "🌿", bg: "linear-gradient(135deg,#16a34a,#065f46)", prompt: "organic eco-friendly logo, leaf or plant motif, earthy greens, sustainability brand, white background" },
];

const LOGO_TYPES = [
  { id: "lettermark", label: "Letter",    desc: "Initials only" },
  { id: "icon",       label: "Icon+Name", desc: "Symbol & text" },
  { id: "wordmark",   label: "Wordmark",  desc: "Stylised name" },
  { id: "emblem",     label: "Emblem",    desc: "Badge / crest" },
];

const INDUSTRIES = [
  "Technology", "Finance & Banking", "Healthcare", "Education", "Retail & Fashion",
  "Food & Beverage", "Real Estate", "Legal & Law", "Creative & Agency",
  "Logistics & Transport", "Construction", "Consulting", "Beauty & Wellness", "Non-Profit"
];

const COLORS = [
  { id: "indigo", hex: "#6366f1", dark: "#3730a3", label: "Indigo" },
  { id: "blue",   hex: "#3b82f6", dark: "#1d4ed8", label: "Blue" },
  { id: "teal",   hex: "#14b8a6", dark: "#134e4a", label: "Teal" },
  { id: "green",  hex: "#10b981", dark: "#065f46", label: "Green" },
  { id: "amber",  hex: "#f59e0b", dark: "#92400e", label: "Amber" },
  { id: "orange", hex: "#f97316", dark: "#c2410c", label: "Orange" },
  { id: "red",    hex: "#ef4444", dark: "#991b1b", label: "Red" },
  { id: "pink",   hex: "#ec4899", dark: "#9d174d", label: "Pink" },
  { id: "purple", hex: "#8b5cf6", dark: "#6d28d9", label: "Purple" },
  { id: "slate",  hex: "#475569", dark: "#1e293b", label: "Slate" },
];

const ENHANCE_MODES = [
  { id: "polish",    label: "Polish",     icon: Sparkles,   desc: "Sharpen lines & boost quality",   prompt: "Professionally polish and sharpen this logo. Improve line crispness, contrast, and overall print quality. Keep every element, shape, colour and composition exactly as-is. White background. Do NOT redesign anything." },
  { id: "colorize",  label: "Recolour",   icon: Palette,    desc: "Apply a fresh colour palette",    prompt: "Recolour this logo with a more vibrant and modern colour palette while keeping every shape, icon, and layout completely identical. Only change the colours — do not move, remove, or add any design element. White background." },
  { id: "contrast",  label: "Contrast",   icon: Contrast,   desc: "Boost contrast & vibrancy",       prompt: "Enhance the contrast, saturation, and vibrancy of this logo dramatically. Preserve every shape, text, and layout element exactly. Make it pop visually. White background. Do NOT change the design." },
  { id: "clean",     label: "Clean Up",   icon: Crop,       desc: "Remove noise & artefacts",        prompt: "Clean up this logo: remove any compression artefacts, jagged edges, noise or blurriness. Produce a crisp vector-like result. Keep all shapes, colours, and text 100% identical. White background only." },
  { id: "style",     label: "Restyle",    icon: Brush,      desc: "Apply a new visual style",        prompt: "Apply a refined visual style to this logo while keeping the exact same icon, shapes, text, and layout. Only update the artistic rendering — stroke weight, finish, and depth. White background. Do NOT alter the composition." },
  { id: "pro",       label: "Make Pro",   icon: ShieldCheck, desc: "Make it look premium & pro",     prompt: "Transform this logo into a premium, agency-grade design. Keep the exact same elements, layout, text, and icon — only elevate the execution: cleaner geometry, professional typography spacing, and polished finish. White background." },
];

function buildPrompt({ companyName, industry, style, logoType, color, extraDetails }) {
  const s = STYLES.find(s => s.id === style);
  const t = LOGO_TYPES.find(t => t.id === logoType);
  const c = COLORS.find(c => c.id === color);
  return `Design a professional company logo for "${companyName}".
${industry ? `Industry: ${industry}. The design should reflect the norms and aesthetics of this sector.` : ""}
Logo type: ${t?.label} style (${t?.desc}).
Visual style: ${s?.prompt}.
Primary color: ${c?.hex} with dark accent ${c?.dark}. Use these colors prominently.
${extraDetails ? `Extra details: ${extraDetails}.` : ""}
Pure white background, perfectly centered, high resolution, crisp clean edges, suitable for printing on invoices and business documents.`;
}

// ── Shared AI Preview Panel ──────────────────────────────────────────────────
function PreviewPanel({ previewUrl, generating, applying, onApply, onRegenerate, canRegenerate }) {
  return (
    <div className="w-full md:w-72 p-5 flex flex-col gap-4 bg-slate-50/60 shrink-0">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">AI Preview</p>

      <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow-sm flex items-center justify-center min-h-[200px] relative overflow-hidden">
        {generating && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-3 z-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              <Sparkles className="h-6 w-6 text-white animate-pulse" />
            </div>
            <p className="text-xs text-muted-foreground font-medium animate-pulse">Generating…</p>
          </div>
        )}
        {previewUrl && !generating ? (
          <img src={previewUrl} alt="Logo preview" className="max-h-48 max-w-full object-contain p-4" />
        ) : !generating ? (
          <div className="text-center p-6 space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto">
              <Wand2 className="h-6 w-6 text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-slate-400">Preview will appear here</p>
            <p className="text-xs text-muted-foreground">AI generates in real-time</p>
          </div>
        ) : null}
      </div>

      {previewUrl && !generating && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">On document</p>
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
            <img src={previewUrl} alt="logo" className="h-8 w-8 object-contain rounded-md border border-slate-100 shrink-0" />
            <div>
              <div className="h-2.5 bg-slate-200 rounded w-20 mb-1" />
              <div className="h-2 bg-slate-100 rounded w-14" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-1.5 bg-slate-100 rounded w-full" />
            <div className="h-1.5 bg-slate-100 rounded w-3/4" />
          </div>
        </div>
      )}

      <div className="space-y-2 mt-auto">
        {previewUrl && (
          <Button
            className="w-full gap-2 font-bold"
            onClick={onApply}
            disabled={applying || generating}
            style={{ background: "linear-gradient(135deg,#10b981,#047857)" }}
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Use This Logo
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
          onClick={onRegenerate}
          disabled={!canRegenerate || generating}
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {generating ? "Generating…" : "Regenerate"}
        </Button>
      </div>
    </div>
  );
}

export default function LogoGenerator({ open, onClose, onApply }) {
  const [activeTab, setActiveTab] = useState("create");

  // Create tab state
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry]       = useState("");
  const [style, setStyle]             = useState("modern");
  const [logoType, setLogoType]       = useState("icon");
  const [color, setColor]             = useState("indigo");
  const [extraDetails, setExtraDetails] = useState("");
  const [createPreview, setCreatePreview] = useState(null);
  const [createGenerating, setCreateGenerating] = useState(false);
  const debounceRef = useRef(null);

  // Enhance tab state
  const [referenceUrl, setReferenceUrl]   = useState(null);
  const [uploadingRef, setUploadingRef]   = useState(false);
  const [enhanceMode, setEnhanceMode]     = useState("polish");
  const [enhanceColor, setEnhanceColor]   = useState("indigo");
  const [enhanceStyle, setEnhanceStyle]   = useState("modern");
  const [enhanceHint, setEnhanceHint]     = useState("");
  const [enhancePreview, setEnhancePreview] = useState(null);
  const [enhanceGenerating, setEnhanceGenerating] = useState(false);
  const refInputRef = useRef(null);

  // Shared
  const [applying, setApplying] = useState(false);

  const previewUrl = activeTab === "create" ? createPreview : enhancePreview;
  const generating = activeTab === "create" ? createGenerating : enhanceGenerating;

  // Auto-generate on create tab param change
  useEffect(() => {
    if (activeTab !== "create" || !companyName.trim()) {
      setCreatePreview(null);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => generateCreate(), 800);
    return () => clearTimeout(debounceRef.current);
  }, [companyName, industry, style, logoType, color, activeTab]);

  const generateCreate = async () => {
    if (!companyName.trim()) return;
    setCreateGenerating(true);
    try {
      const prompt = buildPrompt({ companyName, industry, style, logoType, color, extraDetails });
      const result = await base44.integrations.Core.GenerateImage({ prompt });
      setCreatePreview(result.url);
    } catch {
      toast.error("Preview generation failed.");
    } finally {
      setCreateGenerating(false);
    }
  };

  const generateEnhance = async (refUrl) => {
    const url = refUrl || referenceUrl;
    if (!url) return;
    setEnhanceGenerating(true);
    try {
      const mode = ENHANCE_MODES.find(m => m.id === enhanceMode);
      const c = COLORS.find(c => c.id === enhanceColor);
      const s = STYLES.find(s => s.id === enhanceStyle);
      const hint = enhanceHint.trim();
      const prompt = `${mode.prompt}${hint ? ` Additional instruction: ${hint}.` : ""} Preferred colour accent: ${c?.hex}. Visual style feel: ${s?.label}.`;
      const result = await base44.integrations.Core.GenerateImage({ prompt, existing_image_urls: [url] });
      setEnhancePreview(result.url);
    } catch {
      toast.error("Enhancement failed.");
    } finally {
      setEnhanceGenerating(false);
    }
  };

  const handleRefUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setUploadingRef(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setReferenceUrl(file_url);
      await generateEnhance(file_url);
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploadingRef(false);
    }
  };

  const handleApply = async () => {
    if (!previewUrl) return;
    setApplying(true);
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const file = new File([blob], "logo.png", { type: "image/png" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onApply(file_url);
      toast.success("Logo applied!");
      handleClose();
    } catch {
      onApply(previewUrl);
      toast.success("Logo applied!");
      handleClose();
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    clearTimeout(debounceRef.current);
    setCompanyName(""); setIndustry(""); setStyle("modern"); setLogoType("icon");
    setColor("indigo"); setExtraDetails(""); setCreatePreview(null); setCreateGenerating(false);
    setReferenceUrl(null); setEnhancePreview(null); setEnhanceGenerating(false);
    setEnhanceMode("polish"); setEnhanceColor("indigo"); setEnhanceStyle("modern"); setEnhanceHint("");
    setApplying(false);
    onClose();
  };

  const tabs = [
    { id: "create",  label: "✦  Create New",       sub: "Generate from scratch" },
    { id: "enhance", label: "⚡  Enhance Existing",  sub: "Polish your current logo" },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl p-0 max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-white text-base">Logo Studio</h2>
            <p className="text-white/70 text-xs">AI-powered logo creation & enhancement</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 bg-white">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-3 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-700 bg-indigo-50/60"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50"
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] font-normal text-muted-foreground mt-0.5">{tab.sub}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

          {/* ── CREATE TAB ───────────────────────────────────────────── */}
          {activeTab === "create" && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5 border-r border-border">
              <div>
                <Label className="text-xs font-bold">Company / Brand Name</Label>
                <Input
                  className="mt-1.5 text-base font-semibold"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Ltd"
                  autoFocus
                />
                {!companyName.trim() && (
                  <p className="text-xs text-muted-foreground mt-1">Type your company name to generate a preview →</p>
                )}
              </div>

              <div>
                <Label className="text-xs font-bold">Industry</Label>
                <select
                  value={INDUSTRIES.includes(industry) ? industry : industry ? "other" : ""}
                  onChange={e => { if (e.target.value === "other") setIndustry("other"); else setIndustry(e.target.value); }}
                  className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select industry (optional)</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  <option value="other">Other (type below)</option>
                </select>
                {(industry === "other" || (!INDUSTRIES.includes(industry) && industry !== "")) && (
                  <Input className="mt-2 text-sm" value={industry === "other" ? "" : industry} onChange={e => setIndustry(e.target.value)} placeholder="Type your industry..." />
                )}
              </div>

              <div>
                <Label className="text-xs font-bold mb-2 block">Logo Type</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {LOGO_TYPES.map(t => (
                    <button key={t.id} onClick={() => setLogoType(t.id)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-center transition-all ${logoType === t.id ? "border-indigo-500 bg-indigo-50" : "border-border hover:border-indigo-200 hover:bg-slate-50"}`}>
                      <span className={`text-[10px] font-bold leading-tight ${logoType === t.id ? "text-indigo-700" : "text-foreground"}`}>{t.label}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold mb-2 block">Primary Color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button key={c.id} onClick={() => setColor(c.id)} title={c.label}
                      className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${color === c.id ? "border-foreground ring-2 ring-offset-2 ring-foreground/30 scale-110" : "border-white shadow-sm"}`}
                      style={{ background: `linear-gradient(135deg,${c.hex},${c.dark})` }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold mb-2 block">Visual Style</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {STYLES.map(s => (
                    <button key={s.id} onClick={() => setStyle(s.id)}
                      className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 text-center transition-all ${style === s.id ? "border-indigo-500 bg-indigo-50" : "border-border hover:border-indigo-200 hover:bg-slate-50"}`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-sm" style={{ background: s.bg }}>{s.emoji}</div>
                      <span className={`text-[10px] font-semibold leading-tight ${style === s.id ? "text-indigo-700" : "text-muted-foreground"}`}>{s.label}</span>
                      {style === s.id && <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-indigo-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white" /></div>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold">Extra Details (optional)</Label>
                <Input className="mt-1.5 text-sm" value={extraDetails} onChange={e => setExtraDetails(e.target.value)} placeholder="e.g. include a shield, no text, very simple" />
              </div>
            </div>
          )}

          {/* ── ENHANCE TAB ──────────────────────────────────────────── */}
          {activeTab === "enhance" && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5 border-r border-border">

              {/* Upload zone */}
              <div>
                <Label className="text-xs font-bold">Your Current Logo</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">Upload your existing logo — AI will enhance it without changing its content.</p>
                {referenceUrl ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-indigo-200 bg-indigo-50">
                    <img src={referenceUrl} alt="Reference" className="h-14 w-14 object-contain rounded-lg border border-white bg-white shrink-0 shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-indigo-700">Logo uploaded ✓</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">AI will preserve this content exactly</p>
                    </div>
                    <button onClick={() => { setReferenceUrl(null); setEnhancePreview(null); }}
                      className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors">
                      <X className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => refInputRef.current?.click()} disabled={uploadingRef}
                    className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all">
                    {uploadingRef
                      ? <Loader2 className="h-7 w-7 text-indigo-400 animate-spin" />
                      : <ImagePlus className="h-7 w-7 text-slate-300" />}
                    <span className="text-sm font-medium text-muted-foreground">{uploadingRef ? "Uploading…" : "Click to upload your logo"}</span>
                    <span className="text-xs text-slate-400">PNG, JPG, SVG · Any size</span>
                  </button>
                )}
                <input ref={refInputRef} type="file" accept="image/*" className="hidden" onChange={handleRefUpload} />
              </div>

              {/* Enhancement mode */}
              <div>
                <Label className="text-xs font-bold mb-2 block">Enhancement Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ENHANCE_MODES.map(m => {
                    const Icon = m.icon;
                    return (
                      <button key={m.id} onClick={() => setEnhanceMode(m.id)}
                        className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all ${enhanceMode === m.id ? "border-indigo-500 bg-indigo-50" : "border-border hover:border-indigo-200 hover:bg-slate-50"}`}>
                        <Icon className={`h-4 w-4 ${enhanceMode === m.id ? "text-indigo-600" : "text-slate-400"}`} />
                        <span className={`text-[11px] font-bold leading-tight ${enhanceMode === m.id ? "text-indigo-700" : "text-foreground"}`}>{m.label}</span>
                        <span className="text-[9px] text-muted-foreground leading-tight">{m.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color accent */}
              <div>
                <Label className="text-xs font-bold mb-2 block">Colour Accent</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button key={c.id} onClick={() => setEnhanceColor(c.id)} title={c.label}
                      className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${enhanceColor === c.id ? "border-foreground ring-2 ring-offset-2 ring-foreground/30 scale-110" : "border-white shadow-sm"}`}
                      style={{ background: `linear-gradient(135deg,${c.hex},${c.dark})` }}
                    />
                  ))}
                </div>
              </div>

              {/* Style feel */}
              <div>
                <Label className="text-xs font-bold mb-2 block">Style Feel</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {STYLES.map(s => (
                    <button key={s.id} onClick={() => setEnhanceStyle(s.id)}
                      className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 text-center transition-all ${enhanceStyle === s.id ? "border-indigo-500 bg-indigo-50" : "border-border hover:border-indigo-200 hover:bg-slate-50"}`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-sm" style={{ background: s.bg }}>{s.emoji}</div>
                      <span className={`text-[10px] font-semibold leading-tight ${enhanceStyle === s.id ? "text-indigo-700" : "text-muted-foreground"}`}>{s.label}</span>
                      {enhanceStyle === s.id && <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-indigo-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white" /></div>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom hint */}
              <div>
                <Label className="text-xs font-bold">Custom Instruction (optional)</Label>
                <Input className="mt-1.5 text-sm" value={enhanceHint} onChange={e => setEnhanceHint(e.target.value)} placeholder="e.g. make it more vibrant, add depth, sharpen the icon" />
              </div>

              {referenceUrl && (
                <Button
                  className="w-full gap-2 font-semibold"
                  onClick={() => generateEnhance(null)}
                  disabled={enhanceGenerating}
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
                >
                  {enhanceGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {enhanceGenerating ? "Enhancing…" : "Enhance Logo"}
                </Button>
              )}
            </div>
          )}

          {/* ── SHARED PREVIEW ───────────────────────────────────────── */}
          <PreviewPanel
            previewUrl={previewUrl}
            generating={generating}
            applying={applying}
            onApply={handleApply}
            onRegenerate={activeTab === "create" ? generateCreate : () => generateEnhance(null)}
            canRegenerate={activeTab === "create" ? !!companyName.trim() : !!referenceUrl}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}