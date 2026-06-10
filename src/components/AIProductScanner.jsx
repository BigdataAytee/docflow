import { useState, useRef, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Camera, X, Loader2, ScanLine, CheckCircle2, Copy, Download,
  Package, Tag, DollarSign, BarChart2, ChevronDown, ChevronUp,
  RefreshCw, Save, AlertCircle, ImagePlus, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Camera Viewfinder ───────────────────────────────────────────────────────
function CameraView({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => { if (!cancelled) setReady(true); };
      }
    }).catch(() => { if (!cancelled) onClose(); });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => { onCapture(blob); }, "image/jpeg", 0.95);
  }, [capturing, onCapture]);

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col" style={{ touchAction: "none" }}>
      {/* Flash overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-100"
        style={{ background: "white", opacity: flash ? 0.8 : 0 }} />

      <video ref={videoRef} autoPlay playsInline muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: ready ? 1 : 0 }} />
      <canvas ref={canvasRef} className="hidden" />

      {!ready && (
        <div className="flex-1 flex items-center justify-center gap-3 flex-col">
          <Loader2 className="h-10 w-10 text-white animate-spin" />
          <p className="text-white/60 text-sm">Starting camera…</p>
        </div>
      )}

      {ready && (
        <>
          {/* Top bar */}
          <div className="relative z-20 flex items-center justify-between px-5 pt-5 pb-3"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}>
            <button onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white">
              <X className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-white font-bold text-sm">AI Product Scanner</p>
              <p className="text-white/50 text-[10px]">Point at product label or packaging</p>
            </div>
            <div className="w-10" />
          </div>

          {/* Scan frame */}
          <div className="relative z-20 flex-1 flex items-center justify-center px-8">
            <div className="relative w-full" style={{ maxWidth: 340, aspectRatio: "4/3" }}>
              {/* Corner brackets */}
              {[
                { top: 0, left: 0, borderTop: "3px solid #10b981", borderLeft: "3px solid #10b981", borderRadius: "10px 0 0 0" },
                { top: 0, right: 0, borderTop: "3px solid #10b981", borderRight: "3px solid #10b981", borderRadius: "0 10px 0 0" },
                { bottom: 0, left: 0, borderBottom: "3px solid #10b981", borderLeft: "3px solid #10b981", borderRadius: "0 0 0 10px" },
                { bottom: 0, right: 0, borderBottom: "3px solid #10b981", borderRight: "3px solid #10b981", borderRadius: "0 0 10px 0" },
              ].map((s, i) => <div key={i} className="absolute w-8 h-8" style={s} />)}

              {/* Scanning line */}
              <div className="absolute left-2 right-2 h-0.5 rounded-full pointer-events-none"
                style={{
                  background: "linear-gradient(90deg, transparent, #10b981, #6ee7b7, #10b981, transparent)",
                  boxShadow: "0 0 10px rgba(16,185,129,0.8)",
                  animation: "productscan 2s ease-in-out infinite"
                }} />

              <div className="absolute -bottom-9 left-0 right-0 flex items-center justify-center gap-1.5">
                <ScanLine className="h-3 w-3 text-emerald-400" />
                <span className="text-[11px] text-white/50 font-medium">Align product label within frame</span>
              </div>
            </div>
          </div>

          {/* Shutter */}
          <div className="relative z-20 flex items-center justify-center pb-10 pt-4"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}>
            <button
              onClick={capture}
              disabled={capturing}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center transition-all active:scale-90 shadow-2xl"
              style={{ boxShadow: "0 0 0 5px rgba(255,255,255,0.2), 0 6px 24px rgba(0,0,0,0.5)" }}
            >
              {capturing
                ? <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                : <Camera className="h-8 w-8 text-slate-800" />}
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes productscan {
          0%   { top: 5%;  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 95%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Confidence Badge ─────────────────────────────────────────────────────────
function ConfBadge({ value }) {
  if (!value) return null;
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? "bg-emerald-100 text-emerald-700" : pct >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${color}`}>{pct}%</span>;
}

// ─── Field Row ────────────────────────────────────────────────────────────────
function FieldRow({ label, value, onChange, confidence }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <input
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
      />
      <ConfBadge value={confidence} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIProductScanner({ onClose }) {
  const [stage, setStage] = useState("intro"); // intro | camera | uploading | scanning | result | saved
  const [capturedImageUrl, setCapturedImageUrl] = useState(null);
  const [product, setProduct] = useState(null);
  const [confidence, setConfidence] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef(null);

  const updateField = (key, val) => setProduct(p => ({ ...p, [key]: val }));

  const handleCapture = async (blob) => {
    setCameraOpen(false);
    setStage("uploading");
    const file = new File([blob], "product-scan.jpg", { type: "image/jpeg" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setCapturedImageUrl(file_url);
    await runExtraction(file_url);
  };

  const handleFileUpload = async (file) => {
    setStage("uploading");
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setCapturedImageUrl(file_url);
    await runExtraction(file_url);
  };

  const runExtraction = async (imageUrl) => {
    setStage("scanning");
    const result = await base44.integrations.Core.InvokeLLM({
      model: "claude_sonnet_4_6",
      file_urls: [imageUrl],
      prompt: `You are an expert AI product data extraction engine with OCR capabilities.

Analyze this image carefully. It may contain product packaging, labels, spec sheets, catalogs, flyers, brochures, or any printed product information.

EXTRACTION TASK:
Extract all available product information with maximum accuracy. Support all languages (English, Arabic, French, Spanish, Chinese, etc.) — translate field values to English where relevant.

RULES:
1. Extract every visible field — don't skip partially visible text.
2. For prices: strip currency symbols, return numeric values only.
3. For quantities: include the unit (e.g. "500 Sheets", "1 kg").
4. Correct obvious OCR errors using context (e.g. "0fficeMax" → "OfficeMax").
5. Suggest a category even if not explicitly stated.
6. Generate a clean professional description if one is not present.
7. Assign confidence scores (0.0–1.0) for each extracted field based on how clearly it was visible.
8. Suggest 3–5 relevant tags/keywords for the product.

Return all fields as a JSON object.`,
      response_json_schema: {
        type: "object",
        properties: {
          name:           { type: "string" },
          description:    { type: "string" },
          sku:            { type: "string" },
          brand:          { type: "string" },
          category:       { type: "string" },
          model_number:   { type: "string" },
          manufacturer:   { type: "string" },
          barcode:        { type: "string" },
          cost_price:     { type: "number" },
          selling_price:  { type: "number" },
          quantity:       { type: "string" },
          unit:           { type: "string" },
          packaging_type: { type: "string" },
          weight:         { type: "string" },
          dimensions:     { type: "string" },
          specifications: { type: "string" },
          warranty:       { type: "string" },
          tags:           { type: "array", items: { type: "string" } },
          raw_scan_text:  { type: "string" },
          confidence: {
            type: "object",
            properties: {
              name: { type: "number" }, description: { type: "number" },
              sku: { type: "number" }, brand: { type: "number" },
              selling_price: { type: "number" }, quantity: { type: "number" },
              category: { type: "number" }
            }
          }
        }
      }
    });

    const { confidence: conf = {}, ...fields } = result || {};
    setConfidence(conf);
    setProduct({
      name: fields.name || "",
      description: fields.description || "",
      sku: fields.sku || "",
      brand: fields.brand || "",
      category: fields.category || "",
      model_number: fields.model_number || "",
      manufacturer: fields.manufacturer || "",
      barcode: fields.barcode || "",
      cost_price: fields.cost_price || 0,
      selling_price: fields.selling_price || 0,
      quantity: fields.quantity || "",
      unit: fields.unit || "",
      packaging_type: fields.packaging_type || "",
      weight: fields.weight || "",
      dimensions: fields.dimensions || "",
      specifications: fields.specifications || "",
      warranty: fields.warranty || "",
      tags: fields.tags || [],
      image_url: imageUrl,
      raw_scan_text: fields.raw_scan_text || "",
      status: "active",
    });
    setStage("result");
  };

  const handleSave = async (status = "active") => {
    setSaving(true);
    await base44.entities.Product.create({ ...product, status });
    setSaving(false);
    setSaved(true);
    setStage("saved");
  };

  const handleCopy = () => {
    const text = Object.entries(product)
      .filter(([k, v]) => v && k !== "image_url" && k !== "raw_scan_text" && k !== "tags" && k !== "status")
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenCamera = () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      fileInputRef.current?.click();
      return;
    }
    setCameraOpen(true);
  };

  // ── Stages ──────────────────────────────────────────────────────────────────
  if (cameraOpen) {
    return <CameraView onCapture={handleCapture} onClose={() => setCameraOpen(false)} />;
  }

  if (stage === "uploading" || stage === "scanning") {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 min-h-[280px]">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-2xl overflow-hidden border-2 border-emerald-200">
            {capturedImageUrl && <img src={capturedImageUrl} className="w-full h-full object-cover" alt="" />}
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
            <Loader2 className="h-4 w-4 text-white animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-bold text-sm text-foreground">
            {stage === "uploading" ? "Uploading image…" : "AI is scanning product…"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {stage === "scanning" ? "Extracting product name, price, SKU, brand, and more" : "Please wait"}
          </p>
        </div>
        <div className="flex gap-1.5">
          {["Name", "Brand", "SKU", "Price", "Category"].map((f, i) => (
            <div key={f} className="px-2 py-1 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600 animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}>
              {f}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stage === "saved") {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 min-h-[280px] text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <div>
          <p className="font-bold text-foreground">Product Saved!</p>
          <p className="text-xs text-muted-foreground mt-1">{product?.name} has been added to your product database.</p>
        </div>
        <div className="flex gap-2 w-full">
          <button onClick={() => { setStage("intro"); setProduct(null); setCapturedImageUrl(null); setSaved(false); }}
            className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted/40 transition-colors">
            Scan Another
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors"
            style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
            Done
          </button>
        </div>
      </div>
    );
  }

  if (stage === "result" && product) {
    const overallConf = Object.values(confidence).length
      ? Math.round(Object.values(confidence).reduce((a, b) => a + b, 0) / Object.values(confidence).length * 100)
      : null;

    return (
      <div className="flex flex-col" style={{ maxHeight: "60dvh" }}>
        {/* Image + confidence header */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-border shrink-0">
          {capturedImageUrl && (
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-emerald-200 shrink-0">
              <img src={capturedImageUrl} alt="scan" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground truncate">{product.name || "Unnamed Product"}</p>
            <div className="flex items-center gap-2 mt-1">
              {product.brand && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{product.brand}</span>}
              {product.category && <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{product.category}</span>}
              {overallConf && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${overallConf >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {overallConf}% confidence
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setStage("intro")} className="p-1.5 text-muted-foreground hover:text-foreground shrink-0">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {/* Core fields */}
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Package className="h-3 w-3" /> Product Info
          </p>
          <FieldRow label="Name" value={product.name} onChange={v => updateField("name", v)} confidence={confidence.name} />
          <FieldRow label="Brand" value={product.brand} onChange={v => updateField("brand", v)} confidence={confidence.brand} />
          <FieldRow label="Category" value={product.category} onChange={v => updateField("category", v)} confidence={confidence.category} />
          <FieldRow label="SKU" value={product.sku} onChange={v => updateField("sku", v)} confidence={confidence.sku} />
          <FieldRow label="Barcode" value={product.barcode} onChange={v => updateField("barcode", v)} />
          <FieldRow label="Description" value={product.description} onChange={v => updateField("description", v)} confidence={confidence.description} />

          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 pt-1">
            <DollarSign className="h-3 w-3" /> Pricing & Inventory
          </p>
          <FieldRow label="Selling Price" value={product.selling_price} onChange={v => updateField("selling_price", parseFloat(v) || 0)} confidence={confidence.selling_price} />
          <FieldRow label="Cost Price" value={product.cost_price} onChange={v => updateField("cost_price", parseFloat(v) || 0)} />
          <FieldRow label="Quantity" value={product.quantity} onChange={v => updateField("quantity", v)} confidence={confidence.quantity} />
          <FieldRow label="Unit" value={product.unit} onChange={v => updateField("unit", v)} />

          {/* Advanced (toggle) */}
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 pt-1 w-full"
          >
            <BarChart2 className="h-3 w-3" /> Advanced Details
            {showAdvanced ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
          </button>
          {showAdvanced && (
            <>
              <FieldRow label="Manufacturer" value={product.manufacturer} onChange={v => updateField("manufacturer", v)} />
              <FieldRow label="Model #" value={product.model_number} onChange={v => updateField("model_number", v)} />
              <FieldRow label="Packaging" value={product.packaging_type} onChange={v => updateField("packaging_type", v)} />
              <FieldRow label="Weight" value={product.weight} onChange={v => updateField("weight", v)} />
              <FieldRow label="Dimensions" value={product.dimensions} onChange={v => updateField("dimensions", v)} />
              <FieldRow label="Warranty" value={product.warranty} onChange={v => updateField("warranty", v)} />
              <FieldRow label="Specs" value={product.specifications} onChange={v => updateField("specifications", v)} />
            </>
          )}

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Tag className="h-3 w-3" /> Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 pt-3 border-t border-border shrink-0 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => handleSave("active")}
              disabled={saving || !product.name}
              className="h-10 text-xs font-bold text-white gap-1.5"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Product
            </Button>
            <Button
              onClick={() => handleSave("draft")}
              disabled={saving || !product.name}
              variant="outline"
              className="h-10 text-xs font-bold gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Save as Draft
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted/40 transition-colors"
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Text"}
            </button>
            <button
              onClick={() => { setStage("intro"); setProduct(null); setCapturedImageUrl(null); }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Scan Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Intro / Entry ──────────────────────────────────────────────────────────
  return (
    <div className="p-5 space-y-4">
      <div className="rounded-2xl overflow-hidden border border-emerald-100"
        style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)" }}>
        <div className="px-4 py-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow">
            <Camera className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-emerald-900 text-sm">AI Product Scanner</p>
            <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
              Point your camera at any product label, packaging, or catalog page. The AI extracts name, price, SKU, brand, and more automatically.
            </p>
          </div>
        </div>
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {["Packaging", "Labels", "Catalogs", "Flyers", "Spec Sheets"].map(t => (
            <span key={t} className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{t}</span>
          ))}
        </div>
      </div>

      {/* Primary CTA */}
      <button
        onClick={handleOpenCamera}
        className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-95"
        style={{
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          boxShadow: "0 6px 24px rgba(16,185,129,0.35)"
        }}
      >
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Camera className="h-5 w-5 text-white" />
        </div>
        <div className="text-left flex-1">
          <p className="font-black">📷 Scan Product Information</p>
          <p className="text-white/70 text-xs font-normal mt-0.5">Opens camera — point at any product</p>
        </div>
      </button>

      {/* Upload alternative */}
      <label className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 border-dashed border-emerald-200 cursor-pointer hover:bg-emerald-50 transition-colors">
        <ImagePlus className="h-5 w-5 text-emerald-500 shrink-0" />
        <div className="text-left flex-1">
          <p className="text-sm font-bold text-emerald-800">Upload Product Image</p>
          <p className="text-xs text-emerald-600 mt-0.5">From your device gallery or files</p>
        </div>
        <input type="file" accept="image/*" className="hidden" ref={fileInputRef}
          onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
      </label>

      {/* Capabilities list */}
      <div className="bg-muted/30 rounded-2xl px-4 py-3 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">What gets extracted</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            "Product Name & Brand", "SKU & Barcode",
            "Selling & Cost Price", "Quantity & Units",
            "Category & Tags", "Specs & Dimensions",
            "Warranty Info", "Multi-language support",
          ].map(item => (
            <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1">
        <Sparkles className="h-3 w-3 text-indigo-400" />
        Powered by AI vision — supports 10+ languages
      </p>
    </div>
  );
}