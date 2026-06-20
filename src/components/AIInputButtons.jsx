import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, FileText, Loader2, Wand2, X, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AIInputButtons() {
  const navigate = useNavigate();
  const [stage, setStage] = useState("idle"); // idle | text_input | uploading | extracting | choose_doc
  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const imageInputRef = useRef(null);

  const DOC_OPTIONS = [
    { type: "invoice", label: "Invoice", gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)" },
    { type: "quotation", label: "Quotation", gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)" },
    { type: "receipt", label: "Receipt", gradient: "linear-gradient(135deg,#10b981,#047857)" },
    { type: "waybill", label: "Waybill", gradient: "linear-gradient(135deg,#f59e0b,#d97706)" },
  ];

  const reset = () => {
    setStage("idle");
    setInputText("");
    setAttachedImage(null);
    setExtractedData(null);
    setUploadingImage(false);
  };

  const handleImageUpload = async (file) => {
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAttachedImage({ url: file_url, name: file.name || "image.jpg" });
    setUploadingImage(false);
    // Trigger extraction immediately
    await extractFromImage(file_url);
  };

  const extractFromImage = async (imageUrl) => {
    setStage("extracting");
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert OCR and document data extraction AI. Carefully read the attached document image and extract every line item.

RULES:
1. Extract items with: description, quantity (number), unit_price (number)
2. unit_price is the unit/rate column — NOT the total amount column
3. Strip all currency symbols and commas from numbers
4. Also extract: customer_name, notes
5. Do NOT include subtotal, tax, or grand total rows as items`,
      file_urls: [imageUrl],
      model: "gemini_3_1_pro",
      response_json_schema: {
        type: "object",
        properties: {
          items: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unit_price: { type: "number" } } } },
          customer_name: { type: "string" },
          notes: { type: "string" },
        }
      }
    });
    setExtractedData(result);
    setStage("choose_doc");
  };

  const extractFromText = async () => {
    if (!inputText.trim()) return;
    setStage("extracting");
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract every line item from this text for a business document.

RULES:
- Each item: description (exact wording), quantity (default 1), unit_price (plain number, no symbols/commas)
- Parse natural language: "5 bags @ ₦5,000", "2hrs labour $100/hr"
- Also extract: customer_name, notes

TEXT:
"""
${inputText}
"""`,
      response_json_schema: {
        type: "object",
        properties: {
          items: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unit_price: { type: "number" } } } },
          customer_name: { type: "string" },
          notes: { type: "string" },
        }
      }
    });
    setExtractedData(result);
    setStage("choose_doc");
  };

  const handleProceed = (docType) => {
    if (!extractedData) return;
    sessionStorage.setItem("ai_prefill", JSON.stringify({
      items: extractedData.items || [],
      notes: [extractedData.customer_name && `Customer: ${extractedData.customer_name}`, extractedData.notes].filter(Boolean).join("\n"),
    }));
    reset();
    navigate(`/documents/new?type=${docType}`);
  };

  // ── idle: two compact buttons ──
  if (stage === "idle") {
    return (
      <div className="flex flex-col gap-2 h-full">
        {/* Image / Scan button */}
        <label className="flex-1 flex flex-col items-center justify-center gap-2 rounded-2xl cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] shadow-lg text-center px-3 py-4"
          style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e293b 100%)", border: "1px solid rgba(99,102,241,0.25)" }}>
          {uploadingImage
            ? <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
            : <ImagePlus className="h-6 w-6 text-indigo-400" />}
          <span className="text-white font-bold text-sm leading-tight">Scan Document</span>
          <span className="text-white/50 text-xs">Upload image, AI extracts items</span>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0])} />
        </label>

        {/* Text / Paste button */}
        <button
          onClick={() => setStage("text_input")}
          className="flex-1 flex flex-col items-center justify-center gap-2 rounded-2xl transition-all hover:opacity-90 active:scale-[0.98] shadow-lg text-center px-3 py-4"
          style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e293b 100%)", border: "1px solid rgba(99,102,241,0.25)" }}>
          <FileText className="h-6 w-6 text-purple-400" />
          <span className="text-white font-bold text-sm leading-tight">Paste Text</span>
          <span className="text-white/50 text-xs">Describe items, AI fills the doc</span>
        </button>
      </div>
    );
  }

  // ── text input ──
  if (stage === "text_input") {
    return (
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
        <div className="px-3 py-2.5 flex items-center justify-between border-b border-border"
          style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
          <div className="flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5 text-white" />
            <span className="text-white font-bold text-xs">Paste Text</span>
          </div>
          <button onClick={reset} className="text-white/60 hover:text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="p-3 flex flex-col gap-2 flex-1">
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            rows={5}
            autoFocus
            placeholder={"e.g. 3 office chairs @ £120 each, 2 desks £250 each, delivery £40"}
            className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed flex-1"
          />
          <button
            onClick={extractFromText}
            disabled={!inputText.trim()}
            className="w-full py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            <Wand2 className="h-3.5 w-3.5 inline mr-1" />Extract with AI
          </button>
        </div>
      </div>
    );
  }

  // ── extracting ──
  if (stage === "extracting") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full rounded-2xl border border-border bg-card shadow-sm px-4 py-6">
        <Loader2 className="h-7 w-7 text-indigo-500 animate-spin" />
        <p className="text-sm font-bold text-foreground">Extracting…</p>
        <p className="text-xs text-muted-foreground text-center">AI is identifying items & prices</p>
      </div>
    );
  }

  // ── choose doc type ──
  if (stage === "choose_doc") {
    const itemCount = extractedData?.items?.filter(i => i.description?.trim()).length || 0;
    return (
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 py-2.5 flex items-center justify-between border-b border-border"
          style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
          <div className="flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5 text-white" />
            <span className="text-white font-bold text-xs">{itemCount} item{itemCount !== 1 ? "s" : ""} found — choose type</span>
          </div>
          <button onClick={reset} className="text-white/60 hover:text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="p-3 grid grid-cols-2 gap-2">
          {DOC_OPTIONS.map(({ type, label, gradient }) => (
            <button key={type} onClick={() => handleProceed(type)}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-white text-xs font-bold transition-all hover:opacity-90 active:scale-95"
              style={{ background: gradient }}>
              {label}
              <ArrowRight className="h-3 w-3 opacity-70" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}