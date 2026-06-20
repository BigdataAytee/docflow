import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Square, RotateCcw, Sparkles, Loader2, FileText, FileCheck, Receipt, Truck, ArrowRight, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const DOC_OPTIONS = [
  { type: "invoice",   label: "Invoice",   icon: FileText,  gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)" },
  { type: "quotation", label: "Quotation", icon: FileCheck, gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)" },
  { type: "receipt",   label: "Receipt",   icon: Receipt,   gradient: "linear-gradient(135deg,#10b981,#047857)" },
  { type: "waybill",   label: "Waybill",   icon: Truck,     gradient: "linear-gradient(135deg,#f59e0b,#d97706)" },
];

const STEP = { IDLE: "idle", RECORDING: "recording", TRANSCRIBING: "transcribing", EXTRACTING: "extracting", REVIEW: "review", CHOOSE_DOC: "choose_doc" };

export default function VoiceRecorder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEP.IDLE);
  const [transcript, setTranscript] = useState("");
  const [liveText, setLiveText] = useState(""); // real-time interim speech
  const [extracted, setExtracted] = useState(null);
  const [error, setError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);

  const startRecording = useCallback(async () => {
    setError("");
    setTranscript("");
    setLiveText("");
    setExtracted(null);
    setRecordingSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = handleRecordingStop;
      mr.start(250);
      mediaRecorderRef.current = mr;
      setStep(STEP.RECORDING);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);

      // Start live speech-to-text for real-time display
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        let finalText = "";
        recognition.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
            else interim = e.results[i][0].transcript;
          }
          setLiveText(finalText + interim);
        };
        recognition.onerror = () => {};
        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch {
      setError("Microphone access denied.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      clearInterval(timerRef.current);
    }
  }, []);

  const handleRecordingStop = async () => {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size < 1000) { setError("Recording too short."); setStep(STEP.IDLE); return; }
    setStep(STEP.TRANSCRIBING);
    try {
      const file = new File([blob], "voice.webm", { type: "audio/webm" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const text = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      setTranscript(text || "");
      setStep(STEP.EXTRACTING);
      await extractFromTranscript(text || "");
    } catch {
      setError("Transcription failed. Please try again.");
      setStep(STEP.IDLE);
    }
  };

  const extractFromTranscript = async (text) => {
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract structured document data from this spoken description.
Transcript: "${text}"
Rules:
- Each item needs: description, quantity (number), unit_price (number), amount (qty * price)
- If price not mentioned, set unit_price to 0
- Extract customer_name and notes if mentioned
- "three chairs at 120 each" → qty:3, unit_price:120, amount:360`,
        response_json_schema: {
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unit_price: { type: "number" }, amount: { type: "number" } } } },
            customer_name: { type: "string" },
            notes: { type: "string" },
            uncertain_fields: { type: "array", items: { type: "string" } }
          }
        }
      });
      setExtracted(result);
      setStep(STEP.REVIEW);
    } catch {
      setError("AI extraction failed. Please try again.");
      setStep(STEP.IDLE);
    }
  };

  const handleCreateDocument = (docType) => {
    if (!extracted?.items?.length) return;
    const subtotal = extracted.items.reduce((s, i) => s + (i.amount || 0), 0);
    sessionStorage.setItem("voice_draft", JSON.stringify({ type: docType, customer_name: extracted.customer_name || "", notes: extracted.notes || "", items: extracted.items, subtotal, total: subtotal }));
    navigate(`/documents/new?type=${docType}&from=voice`);
  };

  const reset = () => { setStep(STEP.IDLE); setTranscript(""); setLiveText(""); setExtracted(null); setError(""); setRecordingSeconds(0); };
  const fmtSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const totalAmount = extracted?.items?.reduce((s, i) => s + (i.amount || 0), 0) || 0;
  const isProcessing = step === STEP.TRANSCRIBING || step === STEP.EXTRACTING;

  // ── IDLE / RECORDING / PROCESSING: compact card with mic icon on left ──
  if (step === STEP.IDLE || step === STEP.RECORDING || isProcessing) {
    const isRecording = step === STEP.RECORDING;

    return (
      <div className="flex flex-col gap-2">
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-600">
            <X className="h-3.5 w-3.5 shrink-0" />{error}
          </div>
        )}
        <div className="flex items-center gap-3">
          {/* Bare mic icon button — no box */}
          <button
            onClick={isRecording ? stopRecording : isProcessing ? undefined : startRecording}
            disabled={isProcessing}
            className="shrink-0 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center"
            title={isRecording ? "Stop recording" : "Start recording"}
          >
            {isProcessing
              ? <Loader2 className="h-7 w-7 text-indigo-500 animate-spin" />
              : isRecording
                ? <Square className="h-7 w-7 fill-red-500 text-red-500" />
                : <Mic className="h-7 w-7 text-indigo-500 hover:text-indigo-400 transition-colors" />
            }
          </button>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-foreground font-bold text-sm leading-tight">
              {isRecording ? `Recording… ${fmtSecs(recordingSeconds)}` : isProcessing ? (step === STEP.TRANSCRIBING ? "Transcribing…" : "Extracting…") : "Voice to Document"}
            </p>
            {isRecording && liveText ? (
              <p className="text-indigo-500 text-xs mt-1 leading-relaxed line-clamp-3 italic">{liveText}</p>
            ) : (
              <p className="text-muted-foreground text-xs mt-0.5">
                {isRecording
                  ? "Speak now…"
                  : isProcessing
                    ? "AI is processing your audio"
                    : "Tap mic, speak items & prices"}
              </p>
            )}
          </div>

          {/* Recording pulse indicator */}
          {isRecording && (
            <span className="flex h-2.5 w-2.5 shrink-0 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── REVIEW ──
  if (step === STEP.REVIEW) {
    return (
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-border"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-white" />
            <span className="text-white font-bold text-sm">Extracted Items</span>
          </div>
          <button onClick={reset} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Transcript</p>
            <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={2}
              className="w-full text-sm border border-border rounded-xl px-3 py-2.5 bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed" />
            <button onClick={() => extractFromTranscript(transcript)} className="mt-1 text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
              <RotateCcw className="h-3 w-3" /> Re-extract
            </button>
          </div>
          <div className="space-y-1.5">
            {extracted?.items?.map((item, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${extracted.uncertain_fields?.includes(item.description) ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200" : "bg-muted/40"}`}>
                <div className="flex-1 min-w-0">
                  <span className="font-medium block truncate">{item.description}</span>
                  <span className="text-xs text-muted-foreground">Qty: {item.quantity} × {item.unit_price?.toLocaleString()}</span>
                </div>
                <span className="font-bold text-foreground shrink-0">{(item.amount || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
          {extracted?.customer_name && <p className="text-xs text-muted-foreground">Customer: <span className="font-semibold text-foreground">{extracted.customer_name}</span></p>}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">{extracted?.items?.length || 0} item(s)</p>
              <p className="text-base font-bold text-foreground">{totalAmount.toLocaleString()}</p>
            </div>
            <Button size="sm" onClick={() => setStep(STEP.CHOOSE_DOC)} className="gap-1.5">
              Choose Document <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── CHOOSE DOCUMENT TYPE ──
  if (step === STEP.CHOOSE_DOC) {
    return (
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-border"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-white" />
            <span className="text-white font-bold text-sm">Choose Document Type</span>
          </div>
          <button onClick={reset} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">Where would you like to send the extracted data?</p>
          <div className="grid grid-cols-2 gap-3">
            {DOC_OPTIONS.map(({ type, label, icon: Icon, gradient }) => (
              <button key={type} onClick={() => handleCreateDocument(type)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all hover:opacity-90 active:scale-95 shadow-sm"
                style={{ background: gradient }}>
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-white font-bold text-sm">{label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(STEP.REVIEW)} className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1 transition-colors">← Back to review</button>
        </div>
      </div>
    );
  }

  return null;
}