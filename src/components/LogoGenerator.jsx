import { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, Upload, X, Loader2, CheckCircle2, ArrowRight, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";

// ─── Data ───────────────────────────────────────────────────────────────────
const STYLES = [
  { id: "modern",   label: "Modern",   emoji: "⚡", bg: "linear-gradient(135deg,#6366f1,#8b5cf6)", prompt: "ultra-modern flat geometric logo, bold sans-serif, sharp angles, contemporary, white background" },
  { id: "minimal",  label: "Minimal",  emoji: "○",  bg: "linear-gradient(135deg,#64748b,#94a3b8)", prompt: "minimalist logo, extreme simplicity, thin elegant lines, generous white space, white background" },
  { id: "bold",     label: "Bold",     emoji: "◼",  bg: "linear-gradient(135deg,#dc2626,#f97316)", prompt: "bold impactful logo, strong heavy typography, high contrast, powerful solid fills, white background" },
  { id: "classic",  label: "Classic",  emoji: "🏛", bg: "linear-gradient(135deg,#92400e,#d97706)", prompt: "classic traditional crest badge logo, timeless serif typography, established professional, white background" },
  { id: "tech",     label: "Tech",     emoji: "◈",  bg: "linear-gradient(135deg,#0ea5e9,#6366f1)", prompt: "futuristic tech startup logo, circuit or data-inspired icon, electric palette, cutting-edge digital, white background" },
  { id: "elegant",  label: "Elegant",  emoji: "✦",  bg: "linear-gradient(135deg,#be185d,#9333ea)", prompt: "luxury brand logo, gold and black palette, thin stroke serifs, high-end fashion aesthetic, white background" },
  { id: "playful",  label: "Playful",  emoji: "★",  bg: "linear-gradient(135deg,#f59e0b,#ec4899)", prompt: "playful fun logo, rounded bubbly shapes, bright cheerful multi-color, friendly energetic, white background" },
  { id: "nature",   label: "Nature",   emoji: "🌿", bg: "linear-gradient(135deg,#16a34a,#065f46)", prompt: "organic eco-friendly logo, leaf or plant motif, earthy greens, sustainability brand, white background" },
];

const LOGO_TYPES = [
  { id: "lettermark", label: "Letter",   desc: "Initials only" },
  { id: "icon",       label: "Icon+Name",desc: "Symbol & text" },
  { id: "wordmark",   label: "Wordmark", desc: "Stylised name" },
  { id: "emblem",     label: "Emblem",   desc: "Badge / crest" },
];

const COLORS = [
  { id: "indigo",  hex: "#6366f1", dark: "#3730a3" },
  { id: "blue",    hex: "#3b82f6", dark: "#1d4ed8" },
  { id: "teal",    hex: "#14b8a6", dark: "#134e4a" },
  { id: "green",   hex: "#10b981", dark: "#065f46" },
  { id: "amber",   hex: "#f59e0b", dark: "#92400e" },
  { id: "orange",  hex: "#f97316", dark: "#c2410c" },
  { id: "red",     hex: "#ef4444", dark: "#991b1b" },
  { id: "pink",    hex: "#ec4899", dark: "#9d174d" },
  { id: "purple",  hex: "#8b5cf6", dark: "#6d28d9" },
  { id: "slate",   hex: "#475569", dark: "#1e293b" },
];

// ─── Live Canvas Logo Preview ────────────────────────────────────────────────
function drawLogoToCanvas(canvas, { name, color, logoType, style }) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const hex = color?.hex || "#6366f1";
  const dark = color?.dark || "#3730a3";

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.roundRect(0, 0, W, H, 16);
  ctx.fill();

  const initials = name
    ? name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("")
    : "?";
  const displayName = name || "Your Brand";

  if (logoType === "lettermark") {
    // Big initials in a circle/gradient pill
    const grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, hex);
    grd.addColorStop(1, dark);
    const r = Math.min(W, H) * 0.38;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${r * 0.9}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials.slice(0, 2), W / 2, H / 2);

  } else if (logoType === "wordmark") {
    // Company name in large styled text
    const fontSize = name.length > 10 ? 28 : name.length > 6 ? 36 : 46;
    ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const grd = ctx.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, hex);
    grd.addColorStop(1, dark);
    ctx.fillStyle = grd;
    ctx.fillText(displayName, W / 2, H / 2);

  } else if (logoType === "emblem") {
    // Hexagon emblem
    const cx = W / 2, cy = H * 0.42, r = Math.min(W, H) * 0.36;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    const grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, hex);
    grd.addColorStop(1, dark);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${r * 0.65}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials.slice(0, 2), cx, cy);
    // Name below
    ctx.fillStyle = hex;
    const nameFontSize = Math.min(16, W / (displayName.length * 0.85));
    ctx.font = `600 ${nameFontSize}px Inter, system-ui, sans-serif`;
    ctx.fillText(displayName, W / 2, cy + r + 20);

  } else {
    // icon + name (default)
    const iconR = Math.min(W, H) * 0.22;
    const iconY = H * 0.38;
    const iconX = W / 2;
    // Icon circle with initials
    const grd = ctx.createLinearGradient(iconX - iconR, iconY - iconR, iconX + iconR, iconY + iconR);
    grd.addColorStop(0, hex);
    grd.addColorStop(1, dark);
    ctx.beginPath();
    ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${iconR * 0.9}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials.slice(0, 1), iconX, iconY);
    // Name below
    const nameSize = Math.min(22, W / (displayName.length * 0.72));
    ctx.font = `700 ${nameSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(displayName, W / 2, H * 0.72);
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function LogoGenerator({ open, onClose, onApply }) {
  const [companyName, setCompanyName]   = useState("");
  const [style, setStyle]               = useState("modern");
  const [logoType, setLogoType]         = useState("icon");
  const [color, setColor]               = useState(COLORS[0]);
  const [extraDetails, setExtraDetails] = useState("");
  const [phase, setPhase]               = useState("design"); // "design" | "generating" | "result"
  const [generatedUrl, setGeneratedUrl] = useState(null);
  const [applying, setApplying]         = useState(false);
  const canvasRef = useRef(null);

  // Redraw canvas whenever any parameter changes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawLogoToCanvas(canvas, { name: companyName, color, logoType, style });
  }, [companyName, color, logoType, style]);

  useEffect(() => { redraw(); }, [redraw]);

  const getCanvasDataUrl = () => canvasRef.current?.toDataURL("image/png");

  // Generate AI version
  const handleAIGenerate = async () => {
    setPhase("generating");
    const selectedStyle = STYLES.find(s => s.id === style);
    const colorObj = color;
    const typeObj = LOGO_TYPES.find(t => t.id === logoType);
    const prompt = `Create a professional company logo for "${companyName || "the company"}".
Logo type: ${typeObj?.label} (${typeObj?.desc}).
Visual style: ${selectedStyle?.prompt}.
Primary color: ${colorObj.hex} with dark variant ${colorObj.dark}.
${extraDetails ? `Extra details: ${extraDetails}.` : ""}
Pure white background, centered, high resolution, crisp vector quality, suitable for business documents.`;

    try {
      const result = await base44.integrations.Core.GenerateImage({ prompt });
      setGeneratedUrl(result.url);
      setPhase("result");
    } catch {
      toast.error("AI generation failed. Please try again.");
      setPhase("design");
    }
  };

  // Apply canvas logo directly
  const handleApplyCanvas = async () => {
    setApplying(true);
    try {
      const dataUrl = getCanvasDataUrl();
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "logo.png", { type: "image/png" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onApply(file_url);
      toast.success("Logo applied!");
      onClose();
    } catch {
      toast.error("Failed to apply logo.");
    } finally {
      setApplying(false);
    }
  };

  // Apply AI generated logo
  const handleApplyAI = async () => {
    setApplying(true);
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
      setApplying(false);
    }
  };

  const resetState = () => {
    setCompanyName("");
    setStyle("modern");
    setLogoType("icon");
    setColor(COLORS[0]);
    setExtraDetails("");
    setPhase("design");
    setGeneratedUrl(null);
    setApplying(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-white text-base leading-tight">Logo Studio</h2>
            <p className="text-white/70 text-xs">Design live, then optionally enhance with AI</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── DESIGN PHASE ── */}
          {(phase === "design" || phase === "generating") && (
            <div className="flex flex-col md:flex-row gap-0 min-h-full">

              {/* Left: Controls */}
              <div className="flex-1 p-5 space-y-5 border-r border-border">

                {/* Company name */}
                <div>
                  <Label className="text-xs font-bold text-foreground">Company / Brand Name</Label>
                  <Input
                    className="mt-1.5 text-base font-semibold"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Ltd"
                    autoFocus
                  />
                  {companyName && (
                    <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Live preview updating →</p>
                  )}
                </div>

                {/* Logo Type */}
                <div>
                  <Label className="text-xs font-bold text-foreground mb-2 block">Logo Type</Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {LOGO_TYPES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setLogoType(t.id)}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-center transition-all ${
                          logoType === t.id
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-border hover:border-indigo-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className={`text-[10px] font-bold leading-tight ${logoType === t.id ? "text-indigo-700" : "text-foreground"}`}>{t.label}</span>
                        <span className="text-[9px] text-muted-foreground leading-tight">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Color */}
                <div>
                  <Label className="text-xs font-bold text-foreground mb-2 block">Primary Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setColor(c)}
                        title={c.id}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          color.id === c.id
                            ? "border-foreground ring-2 ring-offset-2 ring-foreground/30 scale-110"
                            : "border-white shadow-sm"
                        }`}
                        style={{ background: `linear-gradient(135deg,${c.hex},${c.dark})` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Visual Style */}
                <div>
                  <Label className="text-xs font-bold text-foreground mb-2 block">Visual Style <span className="text-muted-foreground font-normal">(used for AI generation)</span></Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {STYLES.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setStyle(s.id)}
                        className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 text-center transition-all ${
                          style === s.id
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-border hover:border-indigo-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-sm" style={{ background: s.bg }}>
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
                </div>

                {/* Extra for AI */}
                <div>
                  <Label className="text-xs font-bold text-foreground">AI Hint (optional)</Label>
                  <Input
                    className="mt-1.5 text-sm"
                    value={extraDetails}
                    onChange={e => setExtraDetails(e.target.value)}
                    placeholder="e.g. include a shield, no text, very simple"
                  />
                </div>
              </div>

              {/* Right: Live Preview */}
              <div className="w-full md:w-72 p-5 flex flex-col gap-4 bg-slate-50/60">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Live Preview</p>

                {/* Canvas preview */}
                <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow-sm flex items-center justify-center p-4">
                  <canvas
                    ref={canvasRef}
                    width={220}
                    height={220}
                    className="rounded-xl"
                    style={{ maxWidth: "100%", display: "block" }}
                  />
                </div>

                {/* Mock on document */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">On document</p>
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
                    <canvas
                      width={40}
                      height={40}
                      className="rounded-md shrink-0"
                      ref={el => { if (el) drawLogoToCanvas(el, { name: companyName, color, logoType, style }); }}
                    />
                    <div>
                      <div className="h-2.5 bg-slate-200 rounded w-24 mb-1" />
                      <div className="h-2 bg-slate-100 rounded w-16" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 bg-slate-100 rounded w-full" />
                    <div className="h-1.5 bg-slate-100 rounded w-3/4" />
                  </div>
                </div>

                {/* CTA buttons */}
                <Button
                  className="w-full gap-2 font-bold"
                  onClick={handleApplyCanvas}
                  disabled={!companyName.trim() || applying}
                  style={{ background: "linear-gradient(135deg,#10b981,#047857)" }}
                >
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Use This Logo
                </Button>

                <div className="relative flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground shrink-0">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <Button
                  variant="outline"
                  className="w-full gap-2 font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  onClick={handleAIGenerate}
                  disabled={!companyName.trim() || phase === "generating"}
                >
                  {phase === "generating" ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating with AI…</>
                  ) : (
                    <><Wand2 className="h-4 w-4" /> Generate AI Version</>
                  )}
                </Button>

                {phase === "generating" && (
                  <p className="text-center text-xs text-muted-foreground animate-pulse">AI is crafting your logo… ~15s</p>
                )}
              </div>
            </div>
          )}

          {/* ── RESULT PHASE ── */}
          {phase === "result" && generatedUrl && (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {/* Canvas version */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Your Design</p>
                  <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 flex items-center justify-center">
                    <canvas
                      width={160}
                      height={160}
                      className="rounded-xl"
                      ref={el => { if (el) drawLogoToCanvas(el, { name: companyName, color, logoType, style }); }}
                    />
                  </div>
                  <Button
                    className="w-full gap-1.5 text-sm"
                    onClick={handleApplyCanvas}
                    disabled={applying}
                    style={{ background: "linear-gradient(135deg,#10b981,#047857)" }}
                  >
                    {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Use This
                  </Button>
                </div>

                {/* AI version */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider text-center">✨ AI Generated</p>
                  <div className="bg-white rounded-2xl border-2 border-indigo-200 p-4 flex items-center justify-center">
                    <img src={generatedUrl} alt="AI logo" className="max-h-40 max-w-full object-contain rounded-xl" />
                  </div>
                  <Button
                    className="w-full gap-1.5 text-sm"
                    onClick={handleApplyAI}
                    disabled={applying}
                    style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
                  >
                    {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Use This
                  </Button>
                </div>
              </div>

              {/* Document mock */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-3 text-center">AI logo on document</p>
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-3">
                  <img src={generatedUrl} alt="AI logo" className="h-10 w-10 object-contain rounded-lg border border-slate-100" />
                  <div>
                    <div className="h-3 bg-slate-200 rounded w-32 mb-1.5" />
                    <div className="h-2 bg-slate-100 rounded w-20" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 bg-slate-100 rounded w-full" />
                  <div className="h-2 bg-slate-100 rounded w-4/5" />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => { setPhase("design"); setGeneratedUrl(null); }}>
                  <ArrowRight className="h-4 w-4 rotate-180" /> Back to Design
                </Button>
                <Button variant="outline" className="flex-1 gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={handleAIGenerate}>
                  <RefreshCw className="h-4 w-4" /> Regenerate AI
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}