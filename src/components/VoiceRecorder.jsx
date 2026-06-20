import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Square, Sparkles, Loader2, FileText, FileCheck, Receipt, Truck, ArrowRight, X, RotateCcw, MicOff, Trash2, Plus, Edit3 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const DOC_OPTIONS = [
  { type: "invoice",   label: "Invoice",   icon: FileText,  gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)" },
  { type: "quotation", label: "Quotation", icon: FileCheck, gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)" },
  { type: "receipt",   label: "Receipt",   icon: Receipt,   gradient: "linear-gradient(135deg,#10b981,#047857)" },
  { type: "waybill",   label: "Waybill",   icon: Truck,     gradient: "linear-gradient(135deg,#f59e0b,#d97706)" },
];

const STEP = { RECORDING: "recording", PROCESSING: "processing", REVIEW: "review", CHOOSE_DOC: "choose_doc" };

export function VoiceRecorderModal({ onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEP.RECORDING);
  const [liveText, setLiveText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [extracted, setExtracted] = useState(null);
  const [error, setError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const finalTextRef = useRef("");
  const interimTextRef = useRef("");
  const livePadRef = useRef(null);

  const fmtSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const totalAmount = (extracted?.items || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  useEffect(() => {
    const t = setTimeout(() => startRecording(), 300);
    return () => clearTimeout(t);
  }, []);

  const startRecording = async () => {
    setError("");
    setLiveText("");
    setTranscript("");
    setExtracted(null);
    setRecordingSeconds(0);
    finalTextRef.current = "";
    interimTextRef.current = "";
    // Must manually clear the uncontrolled textarea DOM node
    if (livePadRef.current) {
      livePadRef.current.value = "";
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Please allow microphone access and try again.");
      return;
    }

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    const mr = new MediaRecorder(stream, { mimeType });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(100);
    mediaRecorderRef.current = mr;

    // Web Speech API for real-time live display
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      let stopped = false;
      let activeRecognition = null;

      const startSR = () => {
        if (stopped) return;
        try {
          const r = new SR();
          r.continuous = false;
          r.interimResults = true;
          r.maxAlternatives = 1;

          r.onresult = (e) => {
            let interim = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
              if (e.results[i].isFinal) {
                finalTextRef.current += e.results[i][0].transcript + " ";
                interimTextRef.current = "";
              } else {
                interim = e.results[i][0].transcript;
                interimTextRef.current = interim;
              }
            }
            const combined = finalTextRef.current + interim;
            // Direct DOM write — bypasses React render cycle entirely for zero latency
            if (livePadRef.current) {
              livePadRef.current.value = combined;
              livePadRef.current.scrollTop = livePadRef.current.scrollHeight;
            }
            // Only update React state for the AI preview panel (debounced via natural render)
            setLiveText(combined);
          };

          r.onend = () => {
            activeRecognition = null;
            if (!stopped) setTimeout(startSR, 80);
          };

          r.onerror = (ev) => {
            activeRecognition = null;
            if (!stopped && ev.error !== "aborted" && ev.error !== "not-allowed") {
              setTimeout(startSR, 200);
            }
          };

          r.start();
          activeRecognition = r;
        } catch {
          if (!stopped) setTimeout(startSR, 500);
        }
      };

      startSR();
      recognitionRef.current = {
        stop: () => {
          stopped = true;
          try { if (activeRecognition) activeRecognition.stop(); } catch {}
        }
      };
    }

    setIsRecording(true);
    setStep(STEP.RECORDING);
    timerRef.current = setInterval(() => {
      setRecordingSeconds(s => s + 1);
    }, 1000);
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    setIsRecording(false);
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (mediaRecorderRef.current) {
      setStep(STEP.PROCESSING);
      mediaRecorderRef.current.onstop = runTranscription;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
    }
  };

  const runTranscription = async () => {
    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
    const srFallback = finalTextRef.current.trim() || (livePadRef.current?.value || "").trim();

    try {
      let finalText = srFallback;

      if (blob.size >= 1000) {
        // Upload audio and use Gemini Flash — best model for multilingual/accent transcription
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `voice.${ext}`, { type: blob.type });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        // Run transcription + extraction in parallel for speed
        const [transcribed] = await Promise.all([
          base44.integrations.Core.InvokeLLM({
            prompt: "Transcribe this audio exactly as spoken. Return only the spoken words with natural punctuation. No commentary.",
            file_urls: [file_url],
            model: "gemini_3_flash",
          })
        ]);
        finalText = (typeof transcribed === "string" ? transcribed : "").trim() || srFallback;
      }

      if (!finalText) { setError("Could not hear anything. Try again."); setStep(STEP.RECORDING); return; }

      // Update textarea with clean Gemini transcript
      if (livePadRef.current) livePadRef.current.value = finalText;
      setTranscript(finalText);
      setLiveText(finalText);
      await extractData(finalText);
    } catch {
      // Fallback to SR text if Gemini fails
      if (srFallback) { setTranscript(srFallback); await extractData(srFallback); }
      else { setError("Transcription failed. Try again."); setStep(STEP.RECORDING); }
    }
  };

  const extractData = async (text) => {
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Parse this business document speech into structured JSON. Be fast and precise.
"${text}"
- items: array of {description, quantity (default 1), unit_price (default 0), amount = qty*price}
- customer_name: person or company name if mentioned
- delivery_date: any date/time reference
- notes: anything else relevant`,
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
                  quantity: { type: "number" },
                  unit_price: { type: "number" },
                  amount: { type: "number" }
                }
              }
            },
            customer_name: { type: "string" },
            delivery_date: { type: "string" },
            notes: { type: "string" },
          }
        }
      });
      setExtracted(result);
      setStep(STEP.REVIEW);
    } catch {
      setError("AI extraction failed. Try again.");
      setStep(STEP.RECORDING);
    }
  };

  const updateItem = (i, field, value) => {
    setExtracted(prev => {
      const items = prev.items.map((item, idx) => {
        if (idx !== i) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unit_price") {
          updated.amount = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0);
        }
        return updated;
      });
      return { ...prev, items };
    });
  };

  const removeItem = (i) => {
    setExtracted(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
  };

  const addItem = () => {
    setExtracted(prev => ({
      ...prev,
      items: [...(prev.items || []), { description: "", quantity: 1, unit_price: 0, amount: 0 }]
    }));
  };

  const handleCreateDocument = (docType) => {
    if (!extracted?.items?.length) return;
    const subtotal = extracted.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const notes = [
      extracted.notes,
      extracted.delivery_date ? `Delivery: ${extracted.delivery_date}` : null
    ].filter(Boolean).join("\n");
    sessionStorage.setItem("voice_draft", JSON.stringify({
      type: docType,
      customer_name: extracted.customer_name || "",
      notes,
      items: extracted.items,
      subtotal,
      total: subtotal
    }));
    onClose();
    navigate(`/documents/new?type=${docType}&from=voice`);
  };

  const reRecord = () => {
    setLiveText("");
    setTranscript("");
    setExtracted(null);
    setError("");
    setRecordingSeconds(0);
    finalTextRef.current = "";
    startRecording();
  };

  const cleanup = () => {
    clearInterval(timerRef.current);
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch {}
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
    }
  };

  const handleClose = () => { cleanup(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-2xl bg-background rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              {step === STEP.RECORDING && isRecording ? (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
              ) : step === STEP.PROCESSING ? (
                <Loader2 className="h-4 w-4 text-indigo-300 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-yellow-300" />
              )}
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">
                {step === STEP.RECORDING && (isRecording ? `Recording… ${fmtSecs(recordingSeconds)}` : "Voice Document Assistant")}
                {step === STEP.PROCESSING && "Processing…"}
                {step === STEP.REVIEW && "Review Extracted Data"}
                {step === STEP.CHOOSE_DOC && "Choose Document Type"}
              </p>
              <p className="text-white/50 text-xs mt-0.5">
                {step === STEP.RECORDING && (isRecording ? "Speak naturally — transcribing in real time" : "Tap mic to begin")}
                {step === STEP.PROCESSING && "Gemini Flash transcribing & extracting…"}
                {step === STEP.REVIEW && "Edit items if needed, then fill your document"}
                {step === STEP.CHOOSE_DOC && "Select which document to populate"}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 m-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
              <MicOff className="h-4 w-4 shrink-0" />{error}
              <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {/* RECORDING — split layout */}
          {step === STEP.RECORDING && (
            <div className="p-4 space-y-4">
              {/* Split: transcript pad + extraction preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Live Notepad */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Edit3 className="h-3.5 w-3.5 text-indigo-500" />
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Live Transcription</p>
                    {isRecording && (
                      <span className="ml-auto text-[10px] text-red-500 font-bold animate-pulse">{fmtSecs(recordingSeconds)}</span>
                    )}
                  </div>
                  <textarea
                    ref={livePadRef}
                    defaultValue=""
                    onInput={(e) => setLiveText(e.target.value)}
                    placeholder={"Start speaking…\n\nExample:\n\"10 boxes of apples at £12 each.\n25 cartons of milk at £18 each.\nDelivery next Friday for Smith & Co.\""}
                    className="w-full rounded-2xl border border-border bg-muted/20 p-4 text-sm text-foreground leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/50 placeholder:text-muted-foreground/50"
                    style={{ minHeight: 200 }}
                  />
                  <p className="text-[10px] text-muted-foreground">You can also type or edit directly in the pad above.</p>
                </div>

                {/* Right: AI Extraction Preview */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">AI Extraction Preview</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/10 p-4 text-sm" style={{ minHeight: 200 }}>
                    {liveText ? (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground italic">Detected from speech:</p>
                        {/* Simple keyword extraction display */}
                        {extractKeywordsFromText(liveText).map((kw, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-background border border-border">
                            <span className="text-[10px] font-bold text-indigo-500 uppercase mt-0.5 w-16 shrink-0">{kw.type}</span>
                            <span className="text-xs text-foreground">{kw.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground py-8">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <p className="text-xs text-center">AI will detect items, prices,<br />customers & dates as you speak</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              {isRecording ? (
                <button onClick={stopRecording}
                  className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                  style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)" }}>
                  <Square className="h-5 w-5 fill-white" /> Stop & Extract
                </button>
              ) : (
                <button onClick={startRecording}
                  className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  <Mic className="h-5 w-5" /> Start Recording
                </button>
              )}

              {/* Manual proceed if text was typed */}
              {!isRecording && liveText.trim() && (
                <button onClick={() => extractData(liveText.trim())}
                  className="w-full py-3 rounded-2xl border border-indigo-300 text-indigo-600 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors">
                  <Sparkles className="h-4 w-4" /> Extract from typed text
                </button>
              )}
            </div>
          )}

          {/* PROCESSING */}
          {step === STEP.PROCESSING && (
            <div className="p-6 space-y-4">
              <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-foreground leading-relaxed max-h-40 overflow-y-auto">
                {liveText || finalTextRef.current || "Processing audio…"}
              </div>
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
                <p className="text-sm font-bold text-foreground">AI Transcribing & Extracting…</p>
                <p className="text-xs text-muted-foreground text-center">Gemini Flash is transcribing your audio<br />and extracting structured data</p>
              </div>
            </div>
          )}

          {/* REVIEW — split: transcript + editable extracted data */}
          {step === STEP.REVIEW && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Transcript */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Transcript</p>
                  <textarea
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-muted/20 p-4 text-sm text-foreground leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                    style={{ minHeight: 180 }}
                  />
                  <button onClick={() => extractData(transcript)} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" /> Re-extract from transcript
                  </button>
                </div>

                {/* Right: Extracted Items */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Extracted Items</p>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {(extracted?.items || []).map((item, i) => (
                      <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                        <input
                          value={item.description}
                          onChange={e => updateItem(i, "description", e.target.value)}
                          placeholder="Item description"
                          className="w-full text-sm font-semibold bg-transparent border-b border-border pb-1 focus:outline-none focus:border-primary text-foreground"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">Qty</p>
                            <input type="number" value={item.quantity}
                              onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1 focus:outline-none" />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">Unit Price</p>
                            <input type="number" value={item.unit_price}
                              onChange={e => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)}
                              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1 focus:outline-none" />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">Amount</p>
                            <input type="number" value={item.amount}
                              onChange={e => updateItem(i, "amount", parseFloat(e.target.value) || 0)}
                              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1 focus:outline-none" />
                          </div>
                        </div>
                        <button onClick={() => removeItem(i)} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addItem}
                    className="w-full py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary flex items-center justify-center gap-1.5 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add Item
                  </button>
                </div>
              </div>

              {/* Summary footer */}
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
                {extracted?.customer_name && (
                  <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
                    👤 {extracted.customer_name}
                  </span>
                )}
                {extracted?.delivery_date && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                    📅 {extracted.delivery_date}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{extracted?.items?.length || 0} item(s)</p>
                    <p className="text-base font-black text-foreground">{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={reRecord}
                      className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                      <RotateCcw className="h-3 w-3" /> Re-record
                    </button>
                    <Button size="sm" onClick={() => setStep(STEP.CHOOSE_DOC)} className="gap-1.5">
                      Fill Document <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CHOOSE DOC */}
          {step === STEP.CHOOSE_DOC && (
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground text-center">Select which document type to auto-populate with your extracted data.</p>
              <div className="grid grid-cols-2 gap-3">
                {DOC_OPTIONS.map(({ type, label, icon: Icon, gradient }) => (
                  <button key={type} onClick={() => handleCreateDocument(type)}
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl transition-all hover:opacity-90 active:scale-95 shadow-sm"
                    style={{ background: gradient }}>
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-white font-bold text-sm">{label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(STEP.REVIEW)}
                className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-2 transition-colors">
                ← Back to review
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple keyword extractor for the live preview panel
function extractKeywordsFromText(text) {
  const results = [];
  const t = text.toLowerCase();

  // Numbers with units (likely quantities + items)
  const quantityMatch = text.match(/(\d+)\s+(boxes?|cartons?|units?|pieces?|bags?|bottles?|packs?|sets?|rolls?|sheets?|litres?|liters?|kgs?|tonnes?|pallets?|drums?|cans?|items?|cases?)/gi);
  if (quantityMatch) {
    quantityMatch.slice(0, 3).forEach(m => results.push({ type: "Qty", value: m }));
  }

  // Prices
  const priceMatch = text.match(/[£$€₦₵]\s*[\d,]+(\.\d+)?|\d+\s*(pounds?|dollars?|naira|euros?)/gi);
  if (priceMatch) {
    priceMatch.slice(0, 3).forEach(m => results.push({ type: "Price", value: m }));
  }

  // Dates
  const dateMatch = text.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)|tomorrow|today|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi);
  if (dateMatch) {
    results.push({ type: "Date", value: dateMatch[0] });
  }

  // Names (capitalized words after "for" or "to")
  const nameMatch = text.match(/(?:for|to|from|customer|client)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z&]+)*)/);
  if (nameMatch) {
    results.push({ type: "Customer", value: nameMatch[1] });
  }

  if (results.length === 0 && text.trim().length > 10) {
    results.push({ type: "Text", value: text.trim().slice(0, 80) + (text.length > 80 ? "…" : "") });
  }

  return results;
}

// Default export: just the mic button trigger (for inline use in home page toolbar etc.)
export default function VoiceRecorder() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="shrink-0 transition-all active:scale-95 flex items-center justify-center" title="Voice to Document">
        <Mic className="h-7 w-7 text-indigo-500 hover:text-indigo-400 transition-colors" />
      </button>
      {open && <VoiceRecorderModal onClose={() => setOpen(false)} />}
    </>
  );
}