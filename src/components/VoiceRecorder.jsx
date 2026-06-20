import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Square, Sparkles, Loader2, FileText, FileCheck, Receipt, Truck, ArrowRight, X, RotateCcw, MicOff, Trash2, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const DOC_OPTIONS = [
  { type: "invoice",   label: "Invoice",   icon: FileText,  gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)" },
  { type: "quotation", label: "Quotation", icon: FileCheck, gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)" },
  { type: "receipt",   label: "Receipt",   icon: Receipt,   gradient: "linear-gradient(135deg,#10b981,#047857)" },
  { type: "waybill",   label: "Waybill",   icon: Truck,     gradient: "linear-gradient(135deg,#f59e0b,#d97706)" },
];

const STEP = { IDLE: "idle", RECORDING: "recording", PROCESSING: "processing", REVIEW: "review", CHOOSE_DOC: "choose_doc" };

function VoiceModal({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "88vh" }}>
        {children}
      </div>
    </div>
  );
}

export default function VoiceRecorder() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(STEP.IDLE);
  const [liveText, setLiveText] = useState(""); // React state — drives the live pad
  const [transcript, setTranscript] = useState("");
  const [extracted, setExtracted] = useState(null);
  const [error, setError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const finalTextRef = useRef(""); // accumulates final SR results across restarts

  const fmtSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const totalAmount = (extracted?.items || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  // Auto-start when modal opens
  useEffect(() => {
    if (modalOpen) startRecording();
  }, [modalOpen]);

  const startRecording = async () => {
    setError("");
    setLiveText("");
    setTranscript("");
    setExtracted(null);
    setRecordingSeconds(0);
    finalTextRef.current = "";

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied.");
      return;
    }

    // MediaRecorder for Whisper final transcription
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    const mr = new MediaRecorder(stream, { mimeType });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(100);
    mediaRecorderRef.current = mr;

    // SpeechRecognition for real-time live text display
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      let stopped = false;

      const startSR = () => {
        if (stopped) return;
        const r = new SR();
        r.continuous = true;
        r.interimResults = true;
        r.maxAlternatives = 1;
        r.lang = "en-US";

        r.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
              finalTextRef.current += e.results[i][0].transcript + " ";
            } else {
              interim = e.results[i][0].transcript;
            }
          }
          // Update React state — this IS fast enough for live display
          setLiveText(finalTextRef.current + interim);
        };

        r.onend = () => { if (!stopped) startSR(); };
        r.onerror = (ev) => { if (ev.error !== "aborted" && !stopped) startSR(); };
        r.start();
        recognitionRef.current = { stop: () => { stopped = true; try { r.stop(); } catch {} } };
      };

      startSR();
    }

    setStep(STEP.RECORDING);
    timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (mediaRecorderRef.current) {
      setStep(STEP.PROCESSING);
      mediaRecorderRef.current.onstop = runWhisper;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
    }
  };

  const runWhisper = async () => {
    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
    if (blob.size < 500) { setError("Recording too short."); setStep(STEP.IDLE); return; }
    try {
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `voice.${ext}`, { type: blob.type });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const text = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      const finalText = (text || "").trim();
      if (!finalText) { setError("Could not hear anything. Try again."); setStep(STEP.IDLE); return; }
      setTranscript(finalText);
      await extractData(finalText);
    } catch {
      setError("Transcription failed. Try again.");
      setStep(STEP.IDLE);
    }
  };

  const extractData = async (text) => {
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract structured document data from this spoken description.
Transcript: "${text}"
Rules:
- Each item: description, quantity (number), unit_price (number), amount (qty * price)
- If price not mentioned, set unit_price to 0
- Extract customer_name and notes if mentioned`,
        response_json_schema: {
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unit_price: { type: "number" }, amount: { type: "number" } } } },
            customer_name: { type: "string" },
            notes: { type: "string" },
          }
        }
      });
      setExtracted(result);
      setStep(STEP.REVIEW);
    } catch {
      setError("AI extraction failed. Try again.");
      setStep(STEP.IDLE);
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
    sessionStorage.setItem("voice_draft", JSON.stringify({
      type: docType,
      customer_name: extracted.customer_name || "",
      notes: extracted.notes || "",
      items: extracted.items,
      subtotal,
      total: subtotal
    }));
    closeModal();
    navigate(`/documents/new?type=${docType}&from=voice`);
  };

  const closeModal = () => {
    clearInterval(timerRef.current);
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (mediaRecorderRef.current) { try { mediaRecorderRef.current.stop(); } catch {} mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop()); mediaRecorderRef.current = null; }
    setModalOpen(false);
    setStep(STEP.IDLE);
    setLiveText("");
    setTranscript("");
    setExtracted(null);
    setError("");
    setRecordingSeconds(0);
    finalTextRef.current = "";
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

  return (
    <>
      <button onClick={() => setModalOpen(true)} className="shrink-0 transition-all active:scale-95 flex items-center justify-center" title="Voice to Document">
        <Mic className="h-7 w-7 text-indigo-500 hover:text-indigo-400 transition-colors" />
      </button>

      {modalOpen && (
        <VoiceModal onClose={closeModal}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0"
            style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)" }}>
            <div className="flex items-center gap-3">
              {step === STEP.RECORDING && (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
              )}
              {step === STEP.PROCESSING && <Loader2 className="h-4 w-4 text-indigo-300 animate-spin" />}
              {(step === STEP.REVIEW || step === STEP.CHOOSE_DOC) && <Sparkles className="h-4 w-4 text-yellow-300" />}
              <div>
                <p className="text-white font-bold text-sm leading-tight">
                  {step === STEP.RECORDING && `Recording… ${fmtSecs(recordingSeconds)}`}
                  {step === STEP.PROCESSING && "Processing with Whisper AI…"}
                  {step === STEP.REVIEW && "Review & Edit Extracted Data"}
                  {step === STEP.CHOOSE_DOC && "Choose Document Type"}
                  {step === STEP.IDLE && "Voice to Document"}
                </p>
                <p className="text-white/50 text-xs mt-0.5">
                  {step === STEP.RECORDING && "Transcribing in real time"}
                  {step === STEP.PROCESSING && "Whisper multilingual model"}
                  {step === STEP.REVIEW && "Edit items, then choose document"}
                  {step === STEP.CHOOSE_DOC && "Select where to send your data"}
                </p>
              </div>
            </div>
            <button onClick={closeModal} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                <MicOff className="h-4 w-4 shrink-0" />{error}
              </div>
            )}

            {/* RECORDING */}
            {step === STEP.RECORDING && (
              <div className="space-y-4">
                <div className="relative rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 p-4 overflow-y-auto" style={{ minHeight: 160, maxHeight: 260 }}>
                  {liveText ? (
                    <p className="text-indigo-900 text-base leading-relaxed font-medium whitespace-pre-wrap">{liveText}</p>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-indigo-300 pointer-events-none">
                      <Mic className="h-10 w-10 opacity-30" />
                      <p className="text-sm font-medium">Start speaking…</p>
                    </div>
                  )}
                </div>
                <button onClick={stopRecording}
                  className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                  style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)" }}>
                  <Square className="h-5 w-5 fill-white" /> Stop & Extract
                </button>
              </div>
            )}

            {/* PROCESSING */}
            {step === STEP.PROCESSING && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-foreground leading-relaxed max-h-40 overflow-y-auto">
                  {liveText || "Processing…"}
                </div>
                <div className="flex items-center justify-center gap-3 py-4">
                  <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Whisper AI transcribing…</p>
                    <p className="text-xs text-muted-foreground">Then extracting items automatically</p>
                  </div>
                </div>
              </div>
            )}

            {/* REVIEW — fully editable */}
            {step === STEP.REVIEW && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Transcript</p>
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground leading-relaxed max-h-20 overflow-y-auto">
                    {transcript}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Extracted Items</p>
                  <div className="space-y-2">
                    {(extracted?.items || []).map((item, i) => (
                      <div key={i} className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
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
                              className="w-full text-sm bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring text-foreground" />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">Unit Price</p>
                            <input type="number" value={item.unit_price}
                              onChange={e => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)}
                              className="w-full text-sm bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring text-foreground" />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">Amount</p>
                            <input type="number" value={item.amount}
                              onChange={e => updateItem(i, "amount", parseFloat(e.target.value) || 0)}
                              className="w-full text-sm bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring text-foreground" />
                          </div>
                        </div>
                        <button onClick={() => removeItem(i)} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addItem}
                    className="mt-2 w-full py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary flex items-center justify-center gap-1.5 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add Item
                  </button>
                </div>

                {extracted?.customer_name && (
                  <p className="text-xs text-muted-foreground">Customer: <span className="font-semibold text-foreground">{extracted.customer_name}</span></p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">{extracted?.items?.length || 0} item(s)</p>
                    <p className="text-lg font-bold text-foreground">{totalAmount.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={reRecord}
                      className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                      <RotateCcw className="h-3 w-3" /> Re-record
                    </button>
                    <Button size="sm" onClick={() => setStep(STEP.CHOOSE_DOC)} className="gap-1.5">
                      Create Doc <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* CHOOSE DOC */}
            {step === STEP.CHOOSE_DOC && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">Where would you like to send the extracted data?</p>
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

            {/* IDLE fallback */}
            {step === STEP.IDLE && !error && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <button onClick={startRecording}
                  className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  <Mic className="h-9 w-9 text-white" />
                </button>
                <p className="text-sm text-muted-foreground font-medium">Tap to start recording</p>
              </div>
            )}
          </div>
        </VoiceModal>
      )}
    </>
  );
}