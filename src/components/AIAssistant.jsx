import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Sparkles, X, ArrowRight, Check, ChevronLeft, FileText, FileCheck, Receipt, Truck, Loader2, Wand2, MessageSquare, ImagePlus, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import CameraScanner from "./CameraScanner";

const DOC_TYPES = [
{ type: "invoice", label: "Invoice", icon: FileText, gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)", desc: "Bill a client" },
{ type: "quotation", label: "Quotation", icon: FileCheck, gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)", desc: "Send a price proposal" },
{ type: "receipt", label: "Receipt", icon: Receipt, gradient: "linear-gradient(135deg,#10b981,#047857)", desc: "Confirm a payment" },
{ type: "waybill", label: "Waybill", icon: Truck, gradient: "linear-gradient(135deg,#f59e0b,#d97706)", desc: "Track a delivery" }];


export default function AIAssistant() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState("idle");
  const [inputText, setInputText] = useState("");
  const [extractedItems, setExtractedItems] = useState([]);
  const [extractedNotes, setExtractedNotes] = useState("");
  const textareaRef = useRef(null);

  const [attachedImage, setAttachedImage] = useState(null); // { url, dataUrl, name }
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cameraStream, setCameraStream] = useState(null); // non-null = camera open
  const imageInputRef = useRef(null);

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleImageUpload = async (file) => {
    setUploadingImage(true);
    // Convert to base64 data URL for reliable vision model access
    const dataUrl = await fileToDataUrl(file);
    // Also upload for storage/preview URL
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAttachedImage({ url: file_url, dataUrl, name: file.name || "scanned-document.jpg" });
    setUploadingImage(false);
  };

  const handleCameraCapture = async (blob) => {
    setCameraStream(null);
    const file = new File([blob], "scan.jpg", { type: "image/jpeg" });
    await handleImageUpload(file);
  };

  const openCamera = (e) => {
    if (e) e.stopPropagation();
    if (!navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).
    then((stream) => setCameraStream(stream)).
    catch((err) => console.error("Camera error:", err.name, err.message));
  };

  const reset = () => {setStage("idle");setInputText("");setExtractedItems([]);setExtractedNotes("");setAttachedImage(null);setCameraStream(null);};
  const close = () => {setOpen(false);setTimeout(reset, 400);};

  useEffect(() => {
    if (stage === "input" && textareaRef.current) textareaRef.current.focus();
  }, [stage]);

  // Listen for scan from Home page
  useEffect(() => {
    const handler = () => {
      const stored = sessionStorage.getItem("ai_scan_image");
      if (stored) {
        const img = JSON.parse(stored);
        sessionStorage.removeItem("ai_scan_image");
        setAttachedImage(img);
        setOpen(true);
        setStage("input");
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
   - description: the full item name/description text (e.g. "HOSE ASSEMBLY RL618365", "BRAKE RL616561")
   - quantity: the numeric quantity (e.g. 05 → 5, 20 → 20)
   - unit_price: the UNIT PRICE column value as a plain number with NO currency symbols or commas (e.g. "N150,000" → 150000, "N2,750,000" → 2750000)
3. IMPORTANT: unit_price is the "Unit Price" or "Rate" column — NOT the "Amount" or "Total" column.
4. Nigerian Naira prices appear as "N150,000" or "₦150,000" or "N2,750,000" — strip all letters, symbols and commas, keep only digits and decimal point.
5. Do NOT skip any rows. Do NOT include subtotal, tax, or grand total rows.
6. Also extract: customer_name (who the document is addressed to), document_number, document_date, and notes (delivery terms, validity, VAT notes, etc).
${inputText.trim() ? `\nAdditional context from user:\n"""\n${inputText}\n"""` : ""}`
      : `You are a precise invoice data extraction AI. Extract every line item from the text below.

RULES:
- Each item must have: description (exact wording), quantity (default 1), unit_price (plain number, no currency symbols or commas).
- Parse natural language like "5 bags of cement @ ₦5,000", "2hrs labour - $100/hr", "3x iPhone cases N3500 each".
- Nigerian Naira: "N150,000" → 150000, "N2,750,000" → 2750000.
- Also extract: customer name, document number, document date, notes or payment terms.

TEXT:
"""
${inputText}
"""`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: basePrompt,
      ...(hasImage ? { file_urls: [attachedImage.dataUrl || attachedImage.url] } : {}),
      model: "claude_sonnet_4_6",
      response_json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit_price: { type: "number" }
              }
            }
          },
          notes: { type: "string" },
          customer_name: { type: "string" },
          document_number: { type: "string" },
          document_date: { type: "string" }
        }
      }
    });

    const items = (result?.items || []).filter((it) => it.description?.trim());
    setExtractedItems(items.length > 0 ? items : [{ description: inputText.trim() || "Item", quantity: 1, unit_price: 0 }]);

    // Combine all extracted metadata into notes
    const metaParts = [];
    if (result?.customer_name) metaParts.push(`Customer: ${result.customer_name}`);
    if (result?.document_number) metaParts.push(`Ref: ${result.document_number}`);
    if (result?.document_date) metaParts.push(`Date: ${result.document_date}`);
    if (result?.notes) metaParts.push(result.notes);
    setExtractedNotes(metaParts.join("\n").trim());

    setStage("confirm");
  };

  const handleProceed = (docType) => {
    sessionStorage.setItem("ai_prefill", JSON.stringify({ items: extractedItems, notes: extractedNotes }));
    close();
    navigate(`/documents/new?type=${docType}`);
  };

  const stepIndex = { idle: -1, input: 0, extracting: 0, confirm: 1, doctype: 2 }[stage] ?? -1;

  return (
    <>
      {/* Live camera scanner — only mounts when we have a live stream */}
      {cameraStream &&
      <CameraScanner
        initialStream={cameraStream}
        onCapture={handleCameraCapture}
        onClose={() => {cameraStream?.getTracks().forEach((t) => t.stop());setCameraStream(null);}} />

      }

      {/* Floating launcher */}
      <div
        className="fixed z-40 group"
        style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))", right: 16 }}>
        
        {/* Desktop tooltip */}
        <div className="hidden lg:block absolute bottom-full right-0 mb-3 w-56 pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 leading-relaxed">
            <p className="font-bold mb-1">✨ AI Document Assistant</p>
            <p className="text-white/75">Type or paste a list of items — the AI extracts them and pre-fills your document instantly.</p>
            <div className="absolute bottom-0 right-5 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
          </div>
        </div>

        <button
          onClick={() => {setOpen(true);if (stage === "idle") setStage("input");}}
          className="flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
            boxShadow: "0 8px 32px rgba(99,102,241,0.45), 0 2px 8px rgba(0,0,0,0.2)"
          }}>
          
          <div className="relative">
            <Sparkles className="h-5 w-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full" />
          </div>
          <span className="text-white font-bold text-sm hidden sm:block">AI Assistant</span>
        </button>

        {/* Tablet / mobile helper text */}
        <p className="lg:hidden text-center text-[10px] text-indigo-400 font-medium mt-1 whitespace-nowrap">
          Tap to create docs with AI
        </p>
      </div>

      {/* Panel */}
      {open &&
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
        onClick={close}
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
        
          <div
          className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
          style={{ maxHeight: "90dvh", display: "flex", flexDirection: "column" }}
          onClick={(e) => e.stopPropagation()}>
          
            {/* Header */}
            <div
            className="relative px-6 pt-6 pb-5 shrink-0 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #a855f7 100%)" }}>
            
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -bottom-10 -left-6 w-28 h-28 rounded-full bg-black/10 pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                    <Wand2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg leading-tight">AI Document Assistant</h2>
                    <p className="text-white/60 text-xs">Paste text, scan a document, or attach an image</p>
                  </div>
                </div>
                <button onClick={close} className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Camera scan button */}
              <button
              onClick={openCamera}
              disabled={uploadingImage}
              className="relative z-10 mt-4 flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-60">
              
                {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
                {uploadingImage ? "Uploading scan…" : "Scan Document with Camera"}
                {!uploadingImage &&
              <span className="ml-1 text-[9px] font-black uppercase tracking-widest bg-yellow-400/30 text-yellow-300 px-1.5 py-0.5 rounded-full">Live</span>
              }
              </button>

              {/* Step pills */}
              <div className="relative z-10 flex items-center gap-2 mt-4">
                {["Paste", "Review", "Choose Type"].map((label, i) =>
              <div key={label} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${i < stepIndex ? "bg-emerald-400 text-white" : i === stepIndex ? "bg-white text-indigo-700" : "bg-white/15 text-white/40"}`}>
                      {i < stepIndex ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                      <span>{label}</span>
                    </div>
                    {i < 2 && <div className="w-3 h-px bg-white/25" />}
                  </div>
              )}
              </div>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1">

              {/* STEP 1 — INPUT */}
              {(stage === "input" || stage === "extracting") &&
            <div className="p-5 space-y-4">
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
                className="w-full border border-border rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-muted/20 placeholder:text-muted-foreground/50 disabled:opacity-60 leading-relaxed" />
              

                  {/* Image attachment */}
                  {attachedImage ?
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
                      <button onClick={() => setAttachedImage(null)} className="text-indigo-300 hover:text-red-400 transition-colors shrink-0"><X className="h-4 w-4" /></button>
                    </div> :

              <div className={`flex items-stretch gap-2 ${uploadingImage ? "opacity-60 pointer-events-none" : ""}`}>
                      {/* Gallery upload */}
                      <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-indigo-200 rounded-2xl py-3 text-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer text-xs font-medium">
                        {uploadingImage ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><ImagePlus className="h-4 w-4" /> From Gallery</>}
                        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0])} />
                      </label>
                      {/* Camera scan */}
                      <button
                  type="button"
                  onClick={openCamera}
                  className="flex items-center justify-center gap-2 border-2 border-dashed border-violet-300 bg-violet-50 hover:bg-violet-100 rounded-2xl px-4 text-violet-600 transition-colors text-xs font-bold">
                  
                        <ScanSearch className="h-4 w-4" /> Scan
                      </button>
                    </div>
              }

                  <p className="text-xs text-muted-foreground">Type text, paste a list, or attach a photo — the AI will extract what matters.</p>
                  <Button
                className="w-full h-12 font-bold gap-2 rounded-xl text-white"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                onClick={handleExtract}
                disabled={!inputText.trim() && !attachedImage || stage === "extracting"}>
                
                    {stage === "extracting" ?
                <><Loader2 className="h-4 w-4 animate-spin" /> Extracting items…</> :
                <><Wand2 className="h-4 w-4" /> Extract Items with AI</>
                }
                  </Button>
                </div>
            }

              {/* STEP 2 — CONFIRM */}
              {stage === "confirm" &&
            <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      Found {extractedItems.length} item{extractedItems.length !== 1 ? "s" : ""} — review &amp; edit
                    </p>
                    <button onClick={() => setStage("input")} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                      <ChevronLeft className="h-3 w-3" /> Edit text
                    </button>
                  </div>

                  <div className="space-y-2">
                    {extractedItems.map((item, i) =>
                <div key={i} className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-3.5">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0 space-y-2">
                            <input
                        value={item.description}
                        onChange={(e) => setExtractedItems((prev) => prev.map((it, idx) => idx === i ? { ...it, description: e.target.value } : it))}
                        className="w-full bg-white/80 border border-indigo-200 rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="Item description" />
                      
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 text-xs text-indigo-600">
                                <span className="font-medium">Qty</span>
                                <input
                            type="text"
                            inputMode="decimal"
                            value={item.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setExtractedItems((prev) => prev.map((it, idx) => idx === i ? { ...it, quantity: e.target.value } : it))}
                            onBlur={(e) => setExtractedItems((prev) => prev.map((it, idx) => idx === i ? { ...it, quantity: parseFloat(e.target.value) || 0 } : it))}
                            className="w-16 bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-indigo-600">
                                <span className="font-medium">Price</span>
                                <input
                            type="text"
                            inputMode="decimal"
                            value={item.unit_price}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setExtractedItems((prev) => prev.map((it, idx) => idx === i ? { ...it, unit_price: e.target.value } : it))}
                            onBlur={(e) => setExtractedItems((prev) => prev.map((it, idx) => idx === i ? { ...it, unit_price: parseFloat(e.target.value) || 0 } : it))}
                            className="w-24 bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          
                              </label>
                            </div>
                          </div>
                          <button
                      onClick={() => setExtractedItems((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-indigo-200 hover:text-red-400 transition-colors shrink-0 mt-1">
                      
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                )}
                  </div>

                  <button
                onClick={() => setExtractedItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0 }])}
                className="w-full border-2 border-dashed border-indigo-200 rounded-2xl py-2.5 text-xs text-indigo-500 hover:bg-indigo-50 transition-colors font-medium">
                
                    + Add another item
                  </button>

                  {extractedNotes &&
              <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Notes / Additional info</label>
                      <textarea
                  value={extractedNotes}
                  onChange={(e) => setExtractedNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-border rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-muted/20" />
                
                    </div>
              }

                  <Button
                className="w-full h-12 font-bold gap-2 rounded-xl text-white"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                onClick={() => setStage("doctype")}
                disabled={extractedItems.filter((it) => it.description.trim()).length === 0}>
                
                    Confirm — Choose Document Type <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
            }

              {/* STEP 3 — DOCUMENT TYPE */}
              {stage === "doctype" &&
            <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Which document type would you like?</p>
                    <button onClick={() => setStage("confirm")} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                      <ChevronLeft className="h-3 w-3" /> Back
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {DOC_TYPES.map(({ type, label, icon: Icon, gradient, desc }) =>
                <button
                  key={type}
                  onClick={() => handleProceed(type)}
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
                )}
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3">
                    <p className="text-xs text-indigo-700 font-medium">
                      {extractedItems.filter((it) => it.description.trim()).length} item{extractedItems.filter((it) => it.description.trim()).length !== 1 ? "s" : ""} will be pre-filled into the editor. You can continue editing before saving.
                    </p>
                  </div>
                </div>
            }
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-indigo-400" /> Powered by AI
              </p>
              

            
            </div>
          </div>
        </div>
      }
    </>);

}