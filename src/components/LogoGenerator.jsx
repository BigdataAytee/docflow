import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Upload, Wand2, Image, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const MODES = [
  { id: "generate", label: "AI Generate", icon: Sparkles, desc: "Describe your brand and AI creates a logo" },
  { id: "extract",  label: "Extract from Photo", icon: Image,    desc: "Upload a photo and extract the logo from it" },
  { id: "enhance",  label: "Enhance Existing",   icon: Wand2,   desc: "Upload your logo and AI enhances it" },
];

export default function LogoGenerator({ open, onClose, onApply }) {
  const [mode, setMode] = useState("generate");
  const [prompt, setPrompt] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [style, setStyle] = useState("modern");
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState(null);
  const [generatedUrl, setGeneratedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingSource, setUploadingSource] = useState(false);
  const fileRef = useRef(null);

  const reset = () => {
    setGeneratedUrl(null);
    setUploadedImageUrl(null);
    setUploadedImagePreview(null);
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

  const handleGenerate = async () => {
    setLoading(true);
    setGeneratedUrl(null);
    try {
      let fullPrompt = "";

      if (mode === "generate") {
        fullPrompt = `Create a professional, clean company logo. 
Company name: ${companyName || "the company"}.
Style: ${style}.
${prompt ? `Additional details: ${prompt}` : ""}
The logo should be on a white or transparent background, minimal, scalable, and suitable for business documents like invoices. Make it bold and memorable.`;

        const result = await base44.integrations.Core.GenerateImage({ prompt: fullPrompt });
        setGeneratedUrl(result.url);

      } else if (mode === "extract") {
        if (!uploadedImageUrl) { toast.error("Please upload a photo first."); setLoading(false); return; }
        fullPrompt = `Extract and isolate only the logo or brand mark from this image. Remove all backgrounds, people, and non-logo elements. Output a clean, crisp logo on a pure white background suitable for use on business documents.`;
        const result = await base44.integrations.Core.GenerateImage({ prompt: fullPrompt, existing_image_urls: [uploadedImageUrl] });
        setGeneratedUrl(result.url);

      } else if (mode === "enhance") {
        if (!uploadedImageUrl) { toast.error("Please upload your logo first."); setLoading(false); return; }
        fullPrompt = `Enhance and refine this logo: make it sharper, cleaner, more professional. Improve contrast, fix any jagged edges, ensure it looks crisp on a white or transparent background. Keep the original design intent but make it look polished and modern. ${prompt ? `Enhancement notes: ${prompt}` : ""}`;
        const result = await base44.integrations.Core.GenerateImage({ prompt: fullPrompt, existing_image_urls: [uploadedImageUrl] });
        setGeneratedUrl(result.url);
      }
    } catch (err) {
      toast.error("Logo generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!generatedUrl) return;
    setLoading(true);
    try {
      // Download the generated image and re-upload as a proper file
      const res = await fetch(generatedUrl);
      const blob = await res.blob();
      const file = new File([blob], "logo.png", { type: "image/png" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onApply(file_url);
      toast.success("Logo applied successfully!");
      onClose();
    } catch {
      // If download fails, apply URL directly
      onApply(generatedUrl);
      toast.success("Logo applied!");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </div>
            Logo Studio
          </DialogTitle>
        </DialogHeader>

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-2 mt-1">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); reset(); }}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all text-xs font-medium ${
                mode === m.id
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-border hover:border-indigo-300 hover:bg-indigo-50/40 text-muted-foreground"
              }`}
            >
              <m.icon className={`h-5 w-5 ${mode === m.id ? "text-indigo-600" : "text-muted-foreground"}`} />
              <span className="leading-tight">{m.label}</span>
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground -mt-1">
          {MODES.find(m => m.id === mode)?.desc}
        </p>

        <div className="space-y-3">
          {/* Generate mode */}
          {mode === "generate" && (
            <>
              <div>
                <Label className="text-xs">Company / Brand Name</Label>
                <Input className="mt-1" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Acme Ltd" />
              </div>
              <div>
                <Label className="text-xs">Style</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {["modern", "minimal", "bold", "classic", "tech", "elegant"].map(s => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border capitalize transition-all ${
                        style === s ? "bg-indigo-600 text-white border-indigo-600" : "border-border text-muted-foreground hover:border-indigo-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Additional Details (optional)</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g. Use blue and gold colors, include a shield icon, professional consulting firm"
                />
              </div>
            </>
          )}

          {/* Extract / Enhance modes */}
          {(mode === "extract" || mode === "enhance") && (
            <>
              <div>
                <Label className="text-xs">{mode === "extract" ? "Photo containing logo" : "Current logo to enhance"}</Label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`mt-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all min-h-[120px] ${
                    uploadedImagePreview ? "border-indigo-400 bg-indigo-50/30" : "border-border hover:border-indigo-300 hover:bg-indigo-50/20"
                  }`}
                >
                  {uploadingSource ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                    </div>
                  ) : uploadedImagePreview ? (
                    <div className="relative p-2">
                      <img src={uploadedImagePreview} alt="Source" className="max-h-28 object-contain rounded-lg" />
                      <button
                        onClick={e => { e.stopPropagation(); reset(); }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground p-4">
                      <Upload className="h-6 w-6 mx-auto mb-1 text-indigo-300" />
                      <p className="text-xs">Click to upload image</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSourceUpload} />
              </div>
              {mode === "enhance" && (
                <div>
                  <Label className="text-xs">Enhancement notes (optional)</Label>
                  <Input className="mt-1" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. Make colors more vibrant, sharpen edges" />
                </div>
              )}
            </>
          )}

          {/* Generate button */}
          <Button
            className="w-full gap-2 font-semibold"
            style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
            onClick={handleGenerate}
            disabled={loading || uploadingSource || (mode !== "generate" && !uploadedImageUrl)}
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> {mode === "generate" ? "Generate Logo" : mode === "extract" ? "Extract Logo" : "Enhance Logo"}</>}
          </Button>
        </div>

        {/* Result */}
        {generatedUrl && (
          <div className="border border-indigo-200 rounded-2xl p-4 bg-indigo-50/40 space-y-3">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Result</p>
            <div className="bg-white rounded-xl p-4 flex items-center justify-center border border-indigo-100 min-h-[140px]">
              <img src={generatedUrl} alt="Generated logo" className="max-h-36 max-w-full object-contain" />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2 font-bold"
                style={{ background: "linear-gradient(135deg,#10b981,#047857)" }}
                onClick={handleApply}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Use as My Logo
              </Button>
              <Button variant="outline" onClick={handleGenerate} disabled={loading} className="gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Regenerate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}