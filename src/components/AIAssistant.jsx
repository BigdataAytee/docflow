import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  Sparkles, X, ArrowRight, Check, ChevronLeft,
  FileText, FileCheck, Receipt, Truck, Loader2,
  Wand2, MessageSquare, ImagePlus, Camera,
  ScanLine, ZoomIn, Zap, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";

const DOC_TYPES = [
  { type: "invoice",   label: "Invoice",   icon: FileText,  gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)", desc: "Bill a client" },
  { type: "quotation", label: "Quotation", icon: FileCheck,  gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)", desc: "Send a price proposal" },
  { type: "receipt",   label: "Receipt",   icon: Receipt,    gradient: "linear-gradient(135deg,#10b981,#047857)", desc: "Confirm a payment" },
  { type: "waybill",   label: "Waybill",   icon: Truck,      gradient: "linear-gradient(135deg,#f59e0b,#d97706)", desc: "Track a delivery" },
];

/* ─── Inline Camera Tab (kept for potential future use) ─────────────────── */
function InlineCameraTab({ initialStream, onCapture, onUploading }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState(null);

  // Attach the stream passed in from the click handler
  useEffect(() => {
    let cancelled = false;

    const attach = (stream) => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      // Try to upgrade to max resolution
      const track = stream.getVideoTracks()[0];
      track.applyConstraints({
        facingMode: { ideal: "environment" },
        width: { ideal: 3840 }, height: { ideal: 2160 },
      }).catch(() => {}).finally(() => {
        if (videoRef.current && !cancelled) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => { if (!cancelled) setReady(true); };
          videoRef.current.play().catch(() => {});
        }
        if (track.getCapabilities?.()?.torch) setTorchOk(true);
      });
    };

    if (initialStream) {
      attach(initialStream);
    } else {
      // Fallback: browser already granted permission (e.g. retake flow)
      navigator.mediaDevices?.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      }).then(attach).catch(() => {
        if (!cancelled) setError("Camera access denied. Please allow camera permission and try again.");
      });
    }

    return () => {
      cancelled = true;
      // Do NOT stop the stream here — parent owns the stream lifecycle
    };
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch;
    await track.applyConstraints({ advanced: [{ torch: next }] });
    setTorch(next);
  }, [torch]);

  const snap = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    // Auto-levels + sharpening
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    let min = 255, max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    const range = max - min || 1;
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = (d[i + c] - min) / range;
        v = v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;
        d[i + c] = Math.min(255, Math.max(0, Math.round(v * 255)));
      }
    }
    ctx.putImageData(imageData, 0, 0);

    canvas.toBlob((blob) => {
      const previewUrl = URL.createObjectURL(blob);
      setCaptured({ blob, previewUrl });
      setCapturing(false);
      // Keep stream alive for retake — stopped only when tab unmounts
    }, "image/jpeg", 0.97);
  }, [capturing]);

  const retake = () => {
    if (captured?.previewUrl) URL.revokeObjectURL(captured.previewUrl);
    setCaptured(null);
    setReady(false);
    setCapturing(false);
    // Re-use existing stream if still alive, otherwise request again
    if (streamRef.current?.active) {
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.onloadedmetadata = () => setReady(true);
        videoRef.current.play().catch(() => {});
      }
    } else {
      navigator.mediaDevices?.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      }).then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
          videoRef.current.play().catch(() => {});
        }
      }).catch(() => setError("Camera unavailable."));
    }
  };

  const useCapture = async () => {
    if (!captured?.blob) return;
    onUploading(true);
    const file = new File([captured.blob], "scan.jpg", { type: "image/jpeg" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onUploading(false);
    onCapture({ url: file_url, name: "scan.jpg" });
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
        <Camera className="h-6 w-6 text-red-400" />
      </div>
      <p className="text-sm font-semibold text-foreground">Camera Unavailable</p>
      <p className="text-xs text-muted-foreground">{error}</p>
    </div>
  );

  // Preview after capture
  if (captured) return (
    <div className="flex flex-col gap-3 p-4">
      <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-200 shadow-lg">
        <img src={captured.previewUrl} alt="captured" className="w-full object-contain max-h-64" />
        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Captured
        </div>
      </div>
      <p className="text-xs text-center text-muted-foreground">Looks good? Use this image or retake.</p>
      <div className="flex gap-2">
        <button onClick={retake}
          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-colors">
          ↩ Retake
        </button>
        <button onClick={useCapture}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          Use This Image ✓
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* Viewfinder */}
      <div className="relative bg-black overflow-hidden" style={{ aspectRatio: "4/3" }}>
        {/* Flash overlay */}
        <div className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-100"
          style={{ background: "white", opacity: flash ? 0.85 : 0 }} />

        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
            <p className="text-white/60 text-xs">Starting camera…</p>
          </div>
        )}

        <video ref={videoRef} autoPlay playsInline muted
          className="w-full h-full object-cover"
          style={{ display: ready ? "block" : "none" }} />

        <canvas ref={canvasRef} className="hidden" />

        {/* Corner guides */}
        {ready && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-4/5 h-4/5">
              {[
                { top: 0, left: 0, borderTop: "2px solid #6366f1", borderLeft: "2px solid #6366f1", borderRadius: "8px 0 0 0" },
                { top: 0, right: 0, borderTop: "2px solid #6366f1", borderRight: "2px solid #6366f1", borderRadius: "0 8px 0 0" },
                { bottom: 0, left: 0, borderBottom: "2px solid #6366f1", borderLeft: "2px solid #6366f1", borderRadius: "0 0 0 8px" },
                { bottom: 0, right: 0, borderBottom: "2px solid #6366f1", borderRight: "2px solid #6366f1", borderRadius: "0 0 8px 0" },
              ].map((s, i) => <div key={i} className="absolute w-7 h-7" style={s} />)}
              {/* Scan line */}
              <div className="absolute left-2 right-2 h-0.5 rounded-full"
                style={{ background: "linear-gradient(90deg,transparent,#6366f1,#a5b4fc,#6366f1,transparent)", boxShadow: "0 0 8px rgba(99,102,241,0.9)", animation: "scanline 2.2s ease-in-out infinite" }} />
            </div>
          </div>
        )}

        {/* Torch button */}
        {ready && torchOk && (
          <button onClick={toggleTorch}
            className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-base transition-all z-20 ${torch ? "bg-yellow-400 text-black" : "bg-black/50 text-white"}`}>
            <Zap className="h-4 w-4" />
          </button>
        )}

        {/* Tip */}
        {ready && (
          <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1 z-20">
            <ScanLine className="h-3 w-3 text-indigo-300" />
            <span className="text-[10px] text-white/60 font-medium">Good lighting • flat surface • fill the frame</span>
          </div>
        )}
      </div>

      {/* Capture button row */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/90">
        <div className="flex items-center gap-1.5 text-white/30 text-[11px]">
          <ZoomIn className="h-3.5 w-3.5" /><span>Pinch to zoom</span>
        </div>
        <button onClick={snap} disabled={!ready || capturing}
          className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
          style={{ background: capturing ? "rgba(99,102,241,0.6)" : "white", boxShadow: "0 0 0 4px rgba(255,255,255,0.2)" }}>
          {capturing
            ? <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            : <Camera className="h-7 w-7 text-slate-800" />}
        </button>
        <div className="w-20" />
      </div>

      <style>{`
        @keyframes scanline {
          0%   { top: 6%;  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 94%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function AIAssistant() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("type"); // "type" | "scan"
  const [stage, setStage] = useState("idle"); // idle | input | extracting | confirm | doctype
  const [inputText, setInputText] = useState("");
  const [extractedItems, setExtractedItems] = useState([]);
  const [extractedNotes, setExtractedNotes] = useState("");
  const textareaRef = useRef(null);

  const [attachedImage, setAttachedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [scanHint, setScanHint] = useState(false);
  const imageInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleImageUpload = async (file) => {
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAttachedImage({ url: file_url, name: file.name || "image.jpg" });
    setUploadingImage(false);
  };

  const handleCameraScan = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    setActiveTab("type");
    if (stage === "idle") setStage("input");
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAttachedImage({ url: file_url, name: "scan.jpg" });
    setUploadingImage(false);
  };

  const reset = () => {
    setStage("idle");
    setInputText("");
    setExtractedItems([]);
    setExtractedNotes("");
    setAttachedImage(null);
    setActiveTab("type");
    setScanHint(false);
  };
  const close = () => {
    setOpen(false);
    setTimeout(reset, 400);
  };

  useEffect(() => {
    if (stage === "input" && textareaRef.current) textareaRef.current.focus();
  }, [stage]);

  // Listen for scan trigger from Home page
  useEffect(() => {
    const handler = () => {
      const stored = sessionStorage.getItem("ai_scan_image");
      if (stored) {
        const img = JSON.parse(stored);
        sessionStorage.removeItem("ai_scan_image");
        setAttachedImage(img);
        setOpen(true);
        setStage("input");
        setActiveTab("type");
      }
    };
    window.addEventListener("open-ai-assistant-scan", handler);
    return () => window.removeEventListener("open-ai-assistant-scan", handler);
  }, []);

  const handleExtract = async () => {
    if (!inputText.trim() && !attachedImage) return;
    setStage("extracting");
    const hasImage = !!attachedImage;

    const basePrompt = hasImage
      ? `You are an expert OCR and document data extraction AI. Carefully read the attached document image and extract every line item from any table or list present.

CRITICAL EXTRACTION RULES:
1. Look for any table with columns like: S/N, QTY/Qty/Quantity, Description/Item, Unit Price/Rate, Amount/Total.
2. For EACH row in the table extract:
   - description: the full item name/description text
   - quantity: the numeric quantity (e.g. 05 → 5)
   - unit_price: the UNIT PRICE column value as a plain number (e.g. "N150,000" → 150000)
3. unit_price is the "Unit Price" or "Rate" column — NOT the "Amount" or "Total" column.
4. Nigerian Naira: "N150,000" or "₦150,000" → 150000. Strip all letters, symbols, commas.
5. Do NOT skip any rows. Do NOT include subtotal, tax, or grand total rows.
6. Also extract: customer_name, document_number, document_date, and notes.
${inputText.trim() ? `\nAdditional context:\n"""\n${inputText}\n"""` : ""}`
      : `You are a precise invoice data extraction AI. Extract every line item from the text below.

RULES:
- Each item: description (exact wording), quantity (default 1), unit_price (plain number, no symbols/commas).
- Parse natural language: "5 bags of cement @ ₦5,000", "2hrs labour - $100/hr", "3x iPhone cases N3500 each".
- Nigerian Naira: "N150,000" → 150000.
- Also extract: customer name, document number, document date, notes or payment terms.

TEXT:
"""
${inputText}
"""`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: basePrompt,
      ...(hasImage ? { file_urls: [attachedImage.url] } : {}),
      model: "gemini_3_1_pro",
      response_json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity:    { type: "number" },
                unit_price:  { type: "number" },
              },
            },
          },
          notes:           { type: "string" },
          customer_name:   { type: "string" },
          document_number: { type: "string" },
          document_date:   { type: "string" },
        },
      },
    });

    const items = (result?.items || []).filter((it) => it.description?.trim());
    setExtractedItems(
      items.length > 0 ? items : [{ description: inputText.trim() || "Item", quantity: 1, unit_price: 0 }]
    );

    const metaParts = [];
    if (result?.customer_name)   metaParts.push(`Customer: ${result.customer_name}`);
    if (result?.document_number) metaParts.push(`Ref: ${result.document_number}`);
    if (result?.document_date)   metaParts.push(`Date: ${result.document_date}`);
    if (result?.notes)           metaParts.push(result.notes);
    setExtractedNotes(metaParts.join("\n").trim());
    setStage("confirm");
  };

  const handleProceed = (docType) => {
    sessionStorage.setItem("ai_prefill", JSON.stringify({ items: extractedItems, notes: extractedNotes }));
    close();
    navigate(`/documents/new?type=${docType}`);
  };

  const stepIndex = { idle: -1, input: 0, extracting: 0, confirm: 1, doctype: 2 }[stage] ?? -1;
  const isInFlow = stage === "confirm" || stage === "doctype";

  return (
    <>
      {/* Floating launcher */}
      <div className="fixed z-40 group" style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))", right: 16 }}>
        <div className="hidden lg:block absolute bottom-full right-0 mb-3 w-56 pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 leading-relaxed">
            <p className="font-bold mb-1">✨ AI Document Assistant</p>
            <p className="text-white/75">Type items or scan a document — AI pre-fills your invoice instantly.</p>
            <div className="absolute bottom-0 right-5 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
          </div>
        </div>
        <button
          onClick={() => { setOpen(true); if (stage === "idle") setStage("input"); }}
          className="flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%)", boxShadow: "0 8px 32px rgba(99,102,241,0.45),0 2px 8px rgba(0,0,0,0.2)" }}>
          <div className="relative">
            <Sparkles className="h-5 w-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full" />
          </div>
          <span className="text-white font-bold text-sm hidden sm:block">AI Assistant</span>
        </button>
        <p className="lg:hidden text-center text-[10px] text-indigo-400 font-medium mt-1 whitespace-nowrap">Tap to create docs with AI</p>
      </div>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
          onClick={close}
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
          <div
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
            style={{ maxHeight: "92dvh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}>

            {/* ── Header ── */}
            <div className="relative px-6 pt-5 pb-4 shrink-0 overflow-hidden"
              style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 60%,#a855f7 100%)" }}>
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -bottom-10 -left-6 w-28 h-28 rounded-full bg-black/10 pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                    <Wand2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-base leading-tight">AI Document Assistant</h2>
                    <p className="text-white/55 text-[11px]">Type, paste, or scan your document</p>
                  </div>
                </div>
                <button onClick={close} className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Tabs — only visible in input stage */}
              {!isInFlow && (
                <div className="relative z-10 flex gap-1 bg-white/10 rounded-xl p-1">
                  <button
                    onClick={() => { setActiveTab("type"); if (stage === "idle") setStage("input"); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${activeTab === "type" ? "bg-white text-indigo-700 shadow-sm" : "text-white/60 hover:text-white/90"}`}>
                    ✏️ Type / Paste
                  </button>
                  <label
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 text-center cursor-pointer ${activeTab === "scan" ? "bg-white text-indigo-700 shadow-sm" : "text-white/60 hover:text-white/90"}`}
                    onClick={() => setScanHint(true)}
                  >
                    📷 Scan Document
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        setScanHint(false);
                        if (e.target.files[0]) handleCameraScan(e.target.files[0]);
                      }}
                    />
                  </label>
                </div>
              )}

              {/* Step pills — only in flow steps */}
              {isInFlow && (
                <div className="relative z-10 flex items-center gap-2">
                  {["Paste", "Review", "Choose Type"].map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        i < stepIndex ? "bg-emerald-400 text-white"
                        : i === stepIndex ? "bg-white text-indigo-700"
                        : "bg-white/15 text-white/40"
                      }`}>
                        {i < stepIndex ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                        <span>{label}</span>
                      </div>
                      {i < 2 && <div className="w-3 h-px bg-white/25" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Scrollable Body ── */}
            <div className="overflow-y-auto flex-1">

              {/* TYPE TAB — input stage */}
              {!isInFlow && activeTab === "type" && (stage === "input" || stage === "extracting") && (
                <div className="p-5 space-y-4">
                  {scanHint && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                      <span className="text-lg shrink-0">📷</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-800">Camera didn't open?</p>
                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                          Your device may not support the scan shortcut. Instead, use <strong>"Attach image from gallery"</strong> below to pick a photo, or type / paste your document details here.
                        </p>
                      </div>
                      <button onClick={() => setScanHint(false)} className="text-amber-400 hover:text-amber-600 shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MessageSquare className="h-4 w-4 text-indigo-500" />
                    Describe your products or services
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    rows={attachedImage ? 3 : 7}
                    disabled={stage === "extracting"}
                    placeholder={"Examples:\n• 5 bags of cement @ ₦5,000 each\n• 2 hours plumbing service — bathroom\n\nOr paste any text — the AI will extract what matters!"}
                    className="w-full border border-border rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-muted/20 placeholder:text-muted-foreground/50 disabled:opacity-60 leading-relaxed"
                  />

                  {/* Image attachment preview */}
                  {attachedImage ? (
                    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-indigo-200 shrink-0">
                        <img src={attachedImage.url} alt="attached" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-indigo-700 truncate">{attachedImage.name}</p>
                        <p className="text-xs text-indigo-500 mt-0.5">
                          {attachedImage.name === "scan.jpg" ? "📷 Camera scan ready — AI will extract all text" : "AI will read text from this image"}
                        </p>
                      </div>
                      <button onClick={() => setAttachedImage(null)} className="text-indigo-300 hover:text-red-400 transition-colors shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex items-center justify-center gap-2 border-2 border-dashed border-indigo-200 rounded-2xl py-3 text-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer text-xs font-medium ${uploadingImage ? "opacity-60 pointer-events-none" : ""}`}>
                      {uploadingImage ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><ImagePlus className="h-4 w-4" /> Attach image from gallery</>}
                      <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0])} />
                    </label>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Type text, paste a list, or attach a photo — the AI will extract what matters.
                  </p>

                  <Button
                    className="w-full h-12 font-bold gap-2 rounded-xl text-white"
                    style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
                    onClick={handleExtract}
                    disabled={(!inputText.trim() && !attachedImage) || stage === "extracting"}>
                    {stage === "extracting"
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Extracting items…</>
                      : <><Wand2 className="h-4 w-4" /> Extract Items with AI</>}
                  </Button>
                </div>
              )}

              {/* STEP 2 — CONFIRM */}
              {stage === "confirm" && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      Found {extractedItems.length} item{extractedItems.length !== 1 ? "s" : ""} — review & edit
                    </p>
                    <button onClick={() => { setStage("input"); setActiveTab("type"); }}
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                      <ChevronLeft className="h-3 w-3" /> Edit text
                    </button>
                  </div>

                  <div className="space-y-2">
                    {extractedItems.map((item, i) => (
                      <div key={i} className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-3.5">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0 space-y-2">
                            <input
                              value={item.description}
                              onChange={(e) => setExtractedItems(prev => prev.map((it, idx) => idx === i ? { ...it, description: e.target.value } : it))}
                              className="w-full bg-white/80 border border-indigo-200 rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              placeholder="Item description" />
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 text-xs text-indigo-600">
                                <span className="font-medium">Qty</span>
                                <input type="text" inputMode="decimal" value={item.quantity}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => setExtractedItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: e.target.value } : it))}
                                  onBlur={(e) => setExtractedItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: parseFloat(e.target.value) || 0 } : it))}
                                  className="w-16 bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-indigo-600">
                                <span className="font-medium">Price</span>
                                <input type="text" inputMode="decimal" value={item.unit_price}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => setExtractedItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit_price: e.target.value } : it))}
                                  onBlur={(e) => setExtractedItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit_price: parseFloat(e.target.value) || 0 } : it))}
                                  className="w-24 bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                              </label>
                            </div>
                          </div>
                          <button onClick={() => setExtractedItems(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-indigo-200 hover:text-red-400 transition-colors shrink-0 mt-1">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setExtractedItems(prev => [...prev, { description: "", quantity: 1, unit_price: 0 }])}
                    className="w-full border-2 border-dashed border-indigo-200 rounded-2xl py-2.5 text-xs text-indigo-500 hover:bg-indigo-50 transition-colors font-medium">
                    + Add another item
                  </button>

                  {extractedNotes && (
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Notes / Additional info</label>
                      <textarea value={extractedNotes} onChange={(e) => setExtractedNotes(e.target.value)} rows={2}
                        className="w-full border border-border rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-muted/20" />
                    </div>
                  )}

                  <Button
                    className="w-full h-12 font-bold gap-2 rounded-xl text-white"
                    style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
                    onClick={() => setStage("doctype")}
                    disabled={extractedItems.filter(it => it.description.trim()).length === 0}>
                    Confirm — Choose Document Type <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* STEP 3 — DOC TYPE */}
              {stage === "doctype" && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Which document type would you like?</p>
                    <button onClick={() => setStage("confirm")}
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                      <ChevronLeft className="h-3 w-3" /> Back
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {DOC_TYPES.map(({ type, label, icon: Icon, gradient, desc }) => (
                      <button key={type} onClick={() => handleProceed(type)}
                        className="relative rounded-2xl p-4 text-left overflow-hidden transition-all duration-200 hover:scale-[1.04] active:scale-95 group"
                        style={{ background: gradient, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                        <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <p className="font-bold text-white text-sm leading-tight">{label}</p>
                        <p className="text-white/70 text-xs mt-0.5 mb-3">{desc}</p>
                        <div className="flex items-center gap-1 text-white/90 text-xs font-bold">
                          Open Editor <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3">
                    <p className="text-xs text-indigo-700 font-medium">
                      {extractedItems.filter(it => it.description.trim()).length} item
                      {extractedItems.filter(it => it.description.trim()).length !== 1 ? "s" : ""} will be pre-filled into the editor.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-indigo-400" /> Powered by AI
              </p>
              {uploadingImage && (
                <p className="text-xs text-indigo-500 flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading image…
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}