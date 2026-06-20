import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, FileText, Loader2, Wand2, X, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DOC_OPTIONS = [
  { type: "invoice",   label: "Invoice",   gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)" },
  { type: "quotation", label: "Quotation", gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)" },
  { type: "receipt",   label: "Receipt",   gradient: "linear-gradient(135deg,#10b981,#047857)" },
  { type: "waybill",   label: "Waybill",   gradient: "linear-gradient(135deg,#f59e0b,#d97706)" },
];

export default function AIInputButtons() {
  const navigate = useNavigate();
  const [stage, setStage] = useState("idle"); // idle | text_input | extracting | choose_doc
  const [inputText, setInputText] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const imageInputRef = useRef(null);

  const reset = () => { setStage("idle"); setInputText(""); setExtractedData(null); setUploadingImage(false); };

  const handleImageUpload = async (file) => {
    setUploadingImage(true);
    setStage("extracting");
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract every line item from this document image. For each item return: description, quantity (number), unit_price (number). Also extract customer_name and notes. Do NOT include subtotal/tax/total rows.`,
      file_urls: [file_url],
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
    setUploadingImage(false);
    setStage("choose_doc");
  };

  const extractFromText = async () => {
    if (!inputText.trim()) return;
    setStage("extracting");
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract every line item from this text. Each item: description, quantity (default 1), unit_price (plain number). Also extract customer_name, notes.\n\nTEXT:\n"""\n${inputText}\n"""`,
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
    sessionStorage.setItem("ai_prefill", JSON.stringify({
      items: extractedData?.items || [],
      notes: [extractedData?.customer_name && `Customer: ${extractedData.customer_name}`, extractedData?.notes].filter(Boolean).join("\n"),
    }));
    reset();
    navigate(`/documents/new?type=${docType}`);
  };

  // ── idle: two stacked icon buttons ──
  if (stage === "idle") {
    return (
      <div className="flex flex-col gap-2 h-full">
        {/* Scan / Image */}
        <label
          className="flex flex-col items-center justify-center gap-1.5 w-[72px] h-full min-h-[52px] rounded-2xl cursor-pointer transition-all hover:opacity-90 active:scale-95 flex-1"
          style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", border: "1px solid rgba(99,102,241,0.25)" }}
          title="Scan document image">
          {uploadingImage
            ? <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
            : <ImagePlus className="h-5 w-5 text-indigo-400" />}
          <span className="text-white text-[10px] font-semibold leading-tight text-center">Scan</span>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0])} />
        </label>

        {/* Paste Text */}
        <button
          onClick={() => setStage("text_input")}
          className="flex flex-col items-center justify-center gap-1.5 w-[72px] flex-1 min-h-[52px] rounded-2xl transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", border: "1px solid rgba(99,102,241,0.25)" }}
          title="Paste text">
          <FileText className="h-5 w-5 text-purple-400" />
          <span className="text-white text-[10px] font-semibold leading-tight text-center">Paste</span>
        </button>
      </div>
    );
  }

  // ── text input modal-style overlay within the row ──
  if (stage === "text_input") {
    return (
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden w-[220px]">
        <div className="px-3 py-2 flex items-center justify-between border-b border-border"
          style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
          <span className="text-white font-bold text-xs flex items-center gap-1"><Wand2 className="h-3 w-3" /> Paste Text</span>
          <button onClick={reset} className="text-white/60 hover:text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="p-3 flex flex-col gap-2">
          <textarea value={inputText} onChange={e => setInputText(e.target.value)} rows={4} autoFocus
            placeholder={"e.g. 3 chairs @ £120, 2 desks £250, delivery £40"}
            className="w-full text-xs border border-border rounded-xl px-2.5 py-2 bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed" />
          <button onClick={extractFromText} disabled={!inputText.trim()}
            className="w-full py-2 rounded-xl text-white text-xs font-bold disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            Extract with AI
          </button>
        </div>
      </div>
    );
  }

  // ── extracting ──
  if (stage === "extracting") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 w-[72px] h-full rounded-2xl border border-border bg-card shadow-sm py-4">
        <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
        <span className="text-[10px] text-muted-foreground text-center font-medium leading-tight">AI working…</span>
      </div>
    );
  }

  // ── choose doc ──
  if (stage === "choose_doc") {
    const count = extractedData?.items?.filter(i => i.description?.trim()).length || 0;
    return (
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden w-[220px]">
        <div className="px-3 py-2 flex items-center justify-between border-b border-border"
          style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
          <span className="text-white font-bold text-xs">{count} item{count !== 1 ? "s" : ""} — choose type</span>
          <button onClick={reset} className="text-white/60 hover:text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="p-2.5 grid grid-cols-2 gap-2">
          {DOC_OPTIONS.map(({ type, label, gradient }) => (
            <button key={type} onClick={() => handleProceed(type)}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-white text-[11px] font-bold transition-all hover:opacity-90 active:scale-95"
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