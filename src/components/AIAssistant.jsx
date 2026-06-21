import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  Sparkles, X, ArrowRight, Check, ChevronLeft,
  FileText, FileCheck, Receipt, Truck, Loader2,
  Wand2, MessageSquare, ImagePlus, Camera,
  ScanText, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";

const DOC_TYPES = [
  { type: "invoice",   label: "Invoice",   icon: FileText,  gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)", desc: "Bill a client" },
  { type: "quotation", label: "Quotation", icon: FileCheck,  gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)", desc: "Send a price proposal" },
  { type: "receipt",   label: "Receipt",   icon: Receipt,    gradient: "linear-gradient(135deg,#10b981,#047857)", desc: "Confirm a payment" },
  { type: "waybill",   label: "Waybill",   icon: Truck,      gradient: "linear-gradient(135deg,#f59e0b,#d97706)", desc: "Track a delivery" },
];

export default function AIAssistant({ inlineTrigger = false }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState("idle"); // idle | input | extracting | confirm | doctype
  const [inputText, setInputText] = useState("");
  const [extractedItems, setExtractedItems] = useState([]);
  const [extractedNotes, setExtractedNotes] = useState("");
  const textareaRef = useRef(null);

  // Multiple images support
  const [attachedImages, setAttachedImages] = useState([]); // [{ id, url, name, uploading }]
  const [scanHint, setScanHint] = useState(false);
  const imageInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const scanHintTimerRef = useRef(null);

  const addImageFile = async (file, name = "image.jpg") => {
    const id = Date.now() + Math.random();
    const localUrl = URL.createObjectURL(file);
    setAttachedImages(prev => [...prev, { id, url: localUrl, name, uploading: true }]);
    if (stage === "idle") setStage("input");
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    URL.revokeObjectURL(localUrl);
    setAttachedImages(prev => prev.map(img => img.id === id ? { id, url: file_url, name, uploading: false } : img));
  };

  const removeImage = (id) => {
    setAttachedImages(prev => prev.filter(img => img.id !== id));
  };

  const reset = () => {
    setStage("idle");
    setInputText("");
    setExtractedItems([]);
    setExtractedNotes("");
    setAttachedImages([]);
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
        setAttachedImages([{ id: Date.now(), url: img.url, name: img.name || "scan.jpg", uploading: false }]);
        setOpen(true);
        setStage("input");
      }
    };
    window.addEventListener("open-ai-assistant-scan", handler);
    return () => window.removeEventListener("open-ai-assistant-scan", handler);
  }, []);

  const anyUploading = attachedImages.some(img => img.uploading);
  const readyImageUrls = attachedImages.filter(img => !img.uploading).map(img => img.url);

  const handleExtract = async () => {
    if (!inputText.trim() && attachedImages.length === 0) return;
    setStage("extracting");
    const hasImages = readyImageUrls.length > 0;

    const basePrompt = hasImages
      ? `You are an expert OCR and product/document data extraction AI. Analyze the attached image(s) carefully.

Each image could be:
A) A product or item (e.g. a packaged food, retail item, product label) — extract the product name and details as a line item.
B) An invoice, receipt, or document with a table of items — extract every row from the table.
C) A handwritten or printed list of goods/services.

EXTRACTION RULES:
1. If it is a PRODUCT IMAGE (no invoice table visible):
   - description: the full product name (brand + variant)
   - quantity: 1
   - unit_price: 0 (price unknown from image)

2. If it is a DOCUMENT/INVOICE with a table:
   - Extract EACH row: description, quantity (numeric), unit_price (plain number, strip currency symbols/commas).
   - unit_price = "Unit Price"/"Rate" column only — NOT "Amount"/"Total".
   - Nigerian Naira: "N150,000" or "₦150,000" → 150000.
   - Skip subtotal, tax, and grand total rows.
   - Also extract: customer_name, document_number, document_date.

3. If multiple images are provided, combine ALL items from ALL images into one list.

Always return at least ONE item — never return an empty items array.
${inputText.trim() ? `\nAdditional context from user:\n"""\n${inputText}\n"""` : ""}`
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
      ...(hasImages ? { file_urls: readyImageUrls } : {}),
      model: "gemini_3_flash",
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

  const triggerButton = (
    <button
      onClick={() => { setOpen(true); if (stage === "idle") setStage("input"); }}
      className="relative flex items-center justify-center w-11 h-11 rounded-2xl shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
      style={{ background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%)", boxShadow: "0 4px 16px rgba(99,102,241,0.5)" }}
      title="AI Assistant — scan & extract from images">
      <span className="absolute inset-0 rounded-2xl animate-ping opacity-40" style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }} />
      <ScanText className="h-5 w-5 text-white relative z-10" />
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-300 rounded-full border-2 border-white animate-pulse z-10" />
    </button>
  );

  return (
    <>
      {inlineTrigger ? triggerButton : (
        <div className="fixed z-40" style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))", right: 16 }}>
          {triggerButton}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={close}
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
          <div
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
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
                    <p className="text-white/55 text-[11px]">Type, paste, or snap multiple items</p>
                  </div>
                </div>
                <button onClick={close} className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Step pills — only in flow steps */}
              {isInFlow && (
                <div className="relative z-10 flex items-center gap-2">
                  {["Input", "Review", "Choose Type"].map((label, i) => (
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

              {/* INPUT STAGE */}
              {!isInFlow && (stage === "input" || stage === "extracting") && (
                <div className="p-5 space-y-4">

                  {scanHint && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                      <span className="text-lg shrink-0">📷</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-800">Camera didn't open?</p>
                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                          Use <strong>"Add image from gallery"</strong> below instead, or type / paste your items here.
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
                    rows={attachedImages.length > 0 ? 3 : 6}
                    disabled={stage === "extracting"}
                    placeholder={"Examples:\n• 5 bags of cement @ ₦5,000 each\n• 2 hours plumbing service — bathroom\n\nOr paste any text — the AI will extract what matters!"}
                    className="w-full border border-border rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-muted/20 placeholder:text-muted-foreground/50 disabled:opacity-60 leading-relaxed"
                  />

                  {/* Attached images grid */}
                  {attachedImages.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {attachedImages.length} image{attachedImages.length !== 1 ? "s" : ""} attached — AI will scan all of them
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {attachedImages.map((img, i) => (
                          <div key={img.id} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-indigo-200 shrink-0 group">
                            <img src={img.url} alt={`scan ${i + 1}`} className="w-full h-full object-cover" />
                            {img.uploading ? (
                              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1">
                                <Loader2 className="h-4 w-4 text-white animate-spin" />
                                <span className="text-[9px] text-white/80">Uploading…</span>
                              </div>
                            ) : (
                              <>
                                <div className="absolute top-1 left-1 bg-indigo-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                  {i + 1}
                                </div>
                                <button
                                  onClick={() => removeImage(img.id)}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        ))}

                        {/* Add more snap button */}
                        <label
                          className="w-20 h-20 rounded-xl border-2 border-dashed border-indigo-300 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-indigo-50 transition-colors shrink-0"
                          onClick={() => {
                            clearTimeout(scanHintTimerRef.current);
                            scanHintTimerRef.current = setTimeout(() => setScanHint(true), 3000);
                          }}>
                          <Plus className="h-5 w-5 text-indigo-400" />
                          <span className="text-[10px] text-indigo-400 font-semibold text-center leading-tight">Snap<br/>more</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              clearTimeout(scanHintTimerRef.current);
                              setScanHint(false);
                              if (e.target.files[0]) addImageFile(e.target.files[0], "scan.jpg");
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Action buttons when no images yet */}
                  {attachedImages.length === 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {/* Camera snap */}
                      <label
                        className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-indigo-200 rounded-2xl py-4 text-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer"
                        onClick={() => {
                          clearTimeout(scanHintTimerRef.current);
                          scanHintTimerRef.current = setTimeout(() => setScanHint(true), 3000);
                        }}>
                        <Camera className="h-5 w-5" />
                        <span className="text-xs font-semibold">Snap a photo</span>
                        <span className="text-[10px] text-indigo-400">Use camera</span>
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            clearTimeout(scanHintTimerRef.current);
                            setScanHint(false);
                            if (e.target.files[0]) addImageFile(e.target.files[0], "scan.jpg");
                            e.target.value = "";
                          }}
                        />
                      </label>

                      {/* Gallery pick */}
                      <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-indigo-200 rounded-2xl py-4 text-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer">
                        <ImagePlus className="h-5 w-5" />
                        <span className="text-xs font-semibold">From gallery</span>
                        <span className="text-[10px] text-indigo-400">Pick an image</span>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files[0]) addImageFile(e.target.files[0], e.target.files[0].name);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  )}

                  <Button
                    className="w-full h-12 font-bold gap-2 rounded-xl text-white"
                    style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
                    onClick={handleExtract}
                    disabled={(!inputText.trim() && attachedImages.length === 0) || stage === "extracting" || anyUploading}>
                    {stage === "extracting"
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Extracting items…</>
                      : anyUploading
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading images…</>
                      : <><Wand2 className="h-4 w-4" /> Extract Items with AI</>}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Snap multiple items one by one — all images will be scanned together.
                  </p>
                </div>
              )}

              {/* STEP 2 — CONFIRM */}
              {stage === "confirm" && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      Found {extractedItems.length} item{extractedItems.length !== 1 ? "s" : ""} — review & edit
                    </p>
                    <button onClick={() => setStage("input")}
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                      <ChevronLeft className="h-3 w-3" /> Back
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
              {anyUploading && (
                <p className="text-xs text-indigo-500 flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}