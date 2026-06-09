import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Upload, Wand2, Image as ImageIcon, CheckCircle2, Loader2, X, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

// ── Style definitions with rich visual identity descriptions ──
const STYLES = [
  {
    id: "modern",
    label: "Modern",
    emoji: "⚡",
    preview: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    desc: "Clean lines, geometric shapes, bold sans-serif",
    prompt: "ultra-modern flat design logo, clean geometric shapes, bold sans-serif typography, sharp angles, contemporary color palette, vector-style, professional tech company aesthetic, white background"
  },
  {
    id: "minimal",
    label: "Minimal",
    emoji: "○",
    preview: "linear-gradient(135deg,#64748b,#94a3b8)",
    desc: "Simple, white space, understated elegance",
    prompt: "minimalist logo design, extreme simplicity, generous white space, thin elegant lines, subtle monochromatic palette, Swiss design influence, refined and understated, white background"
  },
  {
    id: "bold",
    label: "Bold",
    emoji: "◼",
    preview: "linear-gradient(135deg,#dc2626,#f97316)",
    desc: "Strong, impactful, high contrast",
    prompt: "bold impactful logo, strong heavy typography, high contrast colors, powerful graphic mark, solid fills, commanding presence, sports or agency style, striking visual weight, white background"
  },
  {
    id: "classic",
    label: "Classic",
    emoji: "🏛",
    preview: "linear-gradient(135deg,#92400e,#d97706)",
    desc: "Timeless, trustworthy, traditional",
    prompt: "classic traditional logo design, timeless serif typography, crest or badge style, navy and gold or deep green palette, established professional look, law firm or finance aesthetic, white background"
  },
  {
    id: "tech",
    label: "Tech",
    emoji: "◈",
    preview: "linear-gradient(135deg,#0ea5e9,#6366f1)",
    desc: "Digital, futuristic, innovation",
    prompt: "futuristic tech startup logo, circuit board or data-inspired icon, glowing accent lines, deep blue and electric cyan palette, gradient fills, cutting-edge digital company, white background"
  },
  {
    id: "elegant",
    label: "Elegant",
    emoji: "✦",
    preview: "linear-gradient(135deg,#be185d,#9333ea)",
    desc: "Luxury, refined, sophisticated",
    prompt: "luxury brand logo, elegant gold and black palette, thin stroke serifs, decorative monogram or emblem, high-end fashion or jewelry aesthetic, sophisticated negative space, white background"
  },
  {
    id: "playful",
    label: "Playful",
    emoji: "★",
    preview: "linear-gradient(135deg,#f59e0b,#ec4899)",
    desc: "Fun, friendly, colorful energy",
    prompt: "playful fun logo design, rounded bubbly shapes, bright cheerful multi-color palette, friendly mascot or character icon, energetic typography, creative agency or kids brand style, white background"
  },
  {
    id: "nature",
    label: "Nature",
    emoji: "🌿",
    preview: "linear-gradient(135deg,#16a34a,#065f46)",
    desc: "Organic, eco-friendly, earthy",
    prompt: "organic eco-friendly logo, natural leaf or plant motif, earthy green and brown palette, hand-drawn feel with clean vector finish, sustainability brand aesthetic, fresh and clean, white background"
  },
];

const ICON_TYPES = [
  { id: "lettermark", label: "Letter Mark", desc: "Initials only", emoji: "A" },
  { id: "icon", label: "Icon + Name", desc: "Symbol with text", emoji: "◎" },
  { id: "emblem", label: "Emblem", desc: "Badge / crest style", emoji: "⬡" },
  { id: "wordmark", label: "Word Mark", desc: "Stylized name only", emoji: "Aa" },
];

const COLORS = [
  { id: "blue", label: "Blue", value: "#3b82f6", dark: "#1d4ed8" },
  { id: "purple", label: "Purple", value: "#8b5cf6", dark: "#6d28d9" },
  { id: "green", label: "Green", value: "#10b981", dark: "#065f46" },
  { id: "red", label: "Red", value: "#ef4444", dark: "#991b1b" },
  { id: "orange", label: "Orange", value: "#f97316", dark: "#c2410c" },
  { id: "gold", label: "Gold", value: "#f59e0b", dark: "#92400e" },
  { id: "pink", label: "Pink", value: "#ec4899", dark: "#9d174d" },
  { id: "slate", label: "Slate", value: "#475569", dark: "#1e293b" },
  { id: "teal", label: "Teal", value: "#14b8a6", dark: "#134e4a" },
  { id: "black", label: "Black", value: "#18181b", dark: "#000000" },
];

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Education", "Retail",
  "Food & Beverage", "Real Estate", "Legal", "Creative / Agency", "Logistics"
];

const MODES = [
  { id: "generate", label: "✨ AI Create", icon: Sparkles },
  { id: "extract", label: "📷 From Photo", icon: ImageIcon },
  { id: "enhance", label: "🪄 Enhance", icon: Wand2 },
];

export default function LogoGenerator({ open, onClose, onApply }) {
  const [mode, setMode] = useState("generate");
  const [step, setStep] = useState(1); // 1 = config, 2 = result
  const [companyName, setCompanyName] = useState("");
  const [tagline, setTagline] = useState("");
  const [style, setStyle] = useState("modern");
  const [iconType, setIconType] = useState("icon");
  const [color, setColor] = useState("blue");
  const [industry, setIndustry] = useState("");
  const [extraDetails, setExtraDetails] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState(null);
  const [generatedUrl, setGeneratedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingSource, setUploadingSource] = useState(false);
  const fileRef = useRef(null);

  const selectedStyle = STYLES.find(s => s.id === style);
  const selectedColor = COLORS.find(c => c.id === color);

  const resetAll = () => {
    setGeneratedUrl(null);
    setUploadedImageUrl(null);
    setUploadedImagePreview(null);
    setStep(1);
  };

  const handleSourceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setUploadingSource(true);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploadedImageUrl(file_url);
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploadingSource(false);
    }
  };

  const buildPrompt = () => {
    const name = companyName || "the company";
    const colorDesc = `${selectedColor?.label || color} color palette (primary: ${selectedColor?.value}, accent: ${selectedColor?.dark})`;
    const styleDesc = selectedStyle?.prompt || "professional logo";
    const iconDesc = ICON_TYPES.find(i => i.id === iconType)?.desc || "";
    const industryDesc = industry ? `Industry: ${industry}.` : "";
    const taglineDesc = tagline ? `Tagline: "${tagline}".` : "";
    const extraDesc = extraDetails ? `Additional: ${extraDetails}.` : "";

    return `Design a professional company logo for "${name}".
Logo type: ${iconType} style (${iconDesc}).
Visual style: ${styleDesc}.
Color scheme: ${colorDesc}.
${industryDesc}
${taglineDesc}
${extraDesc}
The logo must be on a pure white background, high resolution, perfectly centered, suitable for printing on business documents, invoices, and letterheads. No shadows, no gradients bleeding to edges. Clean vector-art quality.`;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setGeneratedUrl(null);
    try {
      let prompt = "";
      let imageUrls = undefined;

      if (mode === "generate") {
        prompt = buildPrompt();
      } else if (mode === "extract") {
        if (!uploadedImageUrl) { toast.error("Please upload a photo first."); setLoading(false); return; }
        prompt = `Extract and isolate ONLY the logo or brand mark from this image. Remove all backgrounds, people, objects and non-logo elements entirely. Output only the clean, crisp logo centered on a pure white background. High resolution, suitable for business documents.`;
        imageUrls = [uploadedImageUrl];
      } else if (mode === "enhance") {
        if (!uploadedImageUrl) { toast.error("Please upload your logo first."); setLoading(false); return; }
        prompt = `Enhance and professionally remaster this logo. Make it sharper and more polished. Fix any pixelation, jagged edges, or inconsistencies. Ensure clean lines, crisp edges, and a pure white background. Keep the original design but elevate it to premium quality. ${extraDetails ? `Specific improvements: ${extraDetails}` : ""}`;
        imageUrls = [uploadedImageUrl];
      }

      const result = await base44.integrations.Core.GenerateImage({
        prompt,
        ...(imageUrls ? { existing_image_urls: imageUrls } : {}),
      });
      setGeneratedUrl(result.url);
      setStep(2);
    } catch {
      toast.error("Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!generatedUrl) return;
    setLoading(true);
    try {
      const res = await fetch(generatedUrl);
      const blob = await res.blob();
      const file = new File([blob], "logo.png", { type: "image/png" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onApply(file_url);
      toast.success("Logo applied!");
      onClose();
    } catch {
      onApply(generatedUrl);
      toast.success("Logo applied!");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-border px-5 py-4 flex items-center gap-3">
          {step === 2 && (
            <button onClick={() => setStep(1)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-base leading-tight">Logo Studio</h2>
            <p className="text-xs text-muted-foreground">{step === 1 ? "Configure your logo" : "Your generated logo"}</p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Mode Tabs */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); resetAll(); }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  mode === m.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* ── STEP 1: Configuration ── */}
          {step === 1 && (
            <>
              {mode === "generate" && (
                <div className="space-y-5">
                  {/* Company name + tagline */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <Label className="text-xs font-semibold">Company / Brand Name <span className="text-red-500">*</span></Label>
                      <Input className="mt-1.5" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Acme Ltd" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Label className="text-xs font-semibold">Industry (optional)</Label>
                      <select
                        value={industry}
                        onChange={e => setIndustry(e.target.value)}
                        className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Select industry…</option>
                        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs font-semibold">Tagline (optional)</Label>
                      <Input className="mt-1.5" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Delivering excellence, every time" />
                    </div>
                  </div>

                  {/* Style selector */}
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Visual Style</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {STYLES.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setStyle(s.id)}
                          className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 text-center transition-all ${
                            style === s.id ? "border-indigo-500 bg-indigo-50" : "border-border hover:border-indigo-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm" style={{ background: s.preview }}>
                            {s.emoji}
                          </div>
                          <span className={`text-[10px] font-semibold leading-tight ${style === s.id ? "text-indigo-700" : "text-muted-foreground"}`}>
                            {s.label}
                          </span>
                          {style === s.id && (
                            <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-indigo-500 flex items-center justify-center">
                              <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    {selectedStyle && (
                      <p className="text-xs text-muted-foreground mt-2 ml-1">
                        <span className="font-semibold text-indigo-600">{selectedStyle.label}:</span> {selectedStyle.desc}
                      </p>
                    )}
                  </div>

                  {/* Logo type */}
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Logo Type</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {ICON_TYPES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setIconType(t.id)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                            iconType === t.id ? "border-indigo-500 bg-indigo-50" : "border-border hover:border-indigo-200"
                          }`}
                        >
                          <span className="text-lg font-black text-indigo-500">{t.emoji}</span>
                          <span className={`text-[10px] font-semibold leading-tight ${iconType === t.id ? "text-indigo-700" : "text-muted-foreground"}`}>{t.label}</span>
                          <span className="text-[9px] text-muted-foreground leading-tight">{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color palette */}
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Primary Color</Label>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setColor(c.id)}
                          title={c.label}
                          className={`w-8 h-8 rounded-full border-2 transition-all shadow-sm hover:scale-110 ${
                            color === c.id ? "border-foreground scale-110 ring-2 ring-offset-1 ring-foreground/30" : "border-white"
                          }`}
                          style={{ background: `linear-gradient(135deg, ${c.value}, ${c.dark})` }}
                        />
                      ))}
                    </div>
                    {selectedColor && (
                      <p className="text-xs text-muted-foreground mt-1.5 ml-0.5">{selectedColor.label} selected</p>
                    )}
                  </div>

                  {/* Extra details */}
                  <div>
                    <Label className="text-xs font-semibold">Extra Details (optional)</Label>
                    <Input
                      className="mt-1.5"
                      value={extraDetails}
                      onChange={e => setExtraDetails(e.target.value)}
                      placeholder="e.g. include a shield icon, no text in logo, very simple"
                    />
                  </div>

                  {/* Live prompt preview */}
                  {companyName && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">AI Prompt Preview</p>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{buildPrompt()}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Extract / Enhance modes */}
              {(mode === "extract" || mode === "enhance") && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all min-h-[180px] ${
                      uploadedImagePreview ? "border-indigo-400 bg-indigo-50/30" : "border-border hover:border-indigo-300 hover:bg-indigo-50/20"
                    }`}
                  >
                    {uploadingSource ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                        <p className="text-sm">Uploading image…</p>
                      </div>
                    ) : uploadedImagePreview ? (
                      <div className="relative p-3">
                        <img src={uploadedImagePreview} alt="Source" className="max-h-36 object-contain rounded-xl shadow-sm" />
                        <button
                          onClick={e => { e.stopPropagation(); resetAll(); }}
                          className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center shadow"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center p-6 space-y-2">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto">
                          <Upload className="h-6 w-6 text-indigo-500" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">
                          {mode === "extract" ? "Upload a photo with your logo" : "Upload your existing logo"}
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 10MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSourceUpload} />

                  {mode === "enhance" && (
                    <div>
                      <Label className="text-xs font-semibold">Improvement notes (optional)</Label>
                      <Input className="mt-1.5" value={extraDetails} onChange={e => setExtraDetails(e.target.value)} placeholder="e.g. make colours more vibrant, sharpen edges" />
                    </div>
                  )}

                  {mode === "extract" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                      💡 Works best with photos where the logo is clearly visible — business cards, storefronts, products, or screenshots.
                    </div>
                  )}
                </div>
              )}

              {/* Generate CTA */}
              <Button
                className="w-full h-12 text-base font-bold gap-2 rounded-xl shadow-lg"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
                onClick={handleGenerate}
                disabled={loading || uploadingSource || (mode !== "generate" && !uploadedImageUrl) || (mode === "generate" && !companyName.trim())}
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Creating your logo…</>
                ) : (
                  <><Sparkles className="h-5 w-5" />
                  {mode === "generate" ? "Generate Logo" : mode === "extract" ? "Extract Logo" : "Enhance Logo"}</>
                )}
              </Button>

              {loading && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground animate-pulse">This takes about 10–15 seconds…</p>
                </div>
              )}
            </>
          )}

          {/* ── STEP 2: Result ── */}
          {step === 2 && generatedUrl && (
            <div className="space-y-4">
              {/* Preview on mock document */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 text-center">Preview on document</p>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-3">
                    <img src={generatedUrl} alt="Generated logo" className="h-12 w-12 object-contain rounded-lg" />
                    <div>
                      <div className="h-3 bg-slate-200 rounded w-28 mb-1.5" />
                      <div className="h-2 bg-slate-100 rounded w-20" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 bg-slate-100 rounded w-full" />
                    <div className="h-2 bg-slate-100 rounded w-4/5" />
                    <div className="h-2 bg-slate-100 rounded w-3/5" />
                  </div>
                </div>
              </div>

              {/* Full size preview */}
              <div className="bg-white rounded-2xl border-2 border-indigo-100 p-6 flex items-center justify-center min-h-[200px]">
                <img src={generatedUrl} alt="Generated logo" className="max-h-48 max-w-full object-contain" />
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="gap-2 font-semibold"
                  onClick={() => { setStep(1); setGeneratedUrl(null); }}
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4" /> Try Again
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 font-semibold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Regenerate
                </Button>
              </div>

              <Button
                className="w-full h-12 text-base font-bold gap-2 rounded-xl"
                style={{ background: "linear-gradient(135deg,#10b981,#047857)" }}
                onClick={handleApply}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Use This as My Logo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}