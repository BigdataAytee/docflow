import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, Square, RotateCcw, Sparkles, Loader2, ChevronDown, ChevronUp, FileText, FileCheck, Receipt, Truck, ArrowRight, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const DOC_OPTIONS = [
  { type: "invoice", label: "Invoice", icon: FileText, color: "#3b82f6" },
  { type: "quotation", label: "Quotation", icon: FileCheck, color: "#8b5cf6" },
  { type: "receipt", label: "Receipt", icon: Receipt, color: "#10b981" },
  { type: "waybill", label: "Waybill", icon: Truck, color: "#f59e0b" },
];

export default function VoiceRecorder() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState("invoice");
  const [error, setError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = useCallback(async () => {
    setError("");
    setTranscript("");
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
      setIsRecording(true);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      setError("Microphone access denied. Please allow microphone permission.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      clearInterval(timerRef.current);
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleRecordingStop = async () => {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size < 1000) { setError("Recording too short. Please try again."); return; }
    setTranscribing(true);
    try {
      const file = new File([blob], "voice.webm", { type: "audio/webm" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const text = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      setTranscript(text || "");
      if (text) await extractFromTranscript(text);
    } catch {
      setError("Transcription failed. Please try again.");
    } finally {
      setTranscribing(false);
    }
  };

  const extractFromTranscript = async (text) => {
    setExtracting(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract structured document data from this spoken description for a ${selectedDocType}. Return items with descriptions, quantities, and unit prices. Also extract any customer name, notes, or totals mentioned.

Transcript: "${text}"

Rules:
- Each item needs: description, quantity (number), unit_price (number), amount (qty * price)
- If price not mentioned for an item, set unit_price to 0
- Extract notes if any general instructions or remarks are mentioned
- Extract customer_name if mentioned
- Be generous in interpretation — "three chairs at 120 each" → qty:3, unit_price:120`,
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
            notes: { type: "string" },
            uncertain_fields: { type: "array", items: { type: "string" } }
          }
        }
      });
      setExtracted(result);
    } catch {
      setError("AI extraction failed. You can still edit the transcript manually.");
    } finally {
      setExtracting(false);
    }
  };

  const handleReExtract = () => { if (transcript) extractFromTranscript(transcript); };

  const handleCreateDocument = () => {
    if (!extracted?.items?.length) return;
    const subtotal = extracted.items.reduce((s, i) => s + (i.amount || 0), 0);
    const draft = {
      type: selectedDocType,
      customer_name: extracted.customer_name || "",
      notes: extracted.notes || "",
      items: extracted.items,
      subtotal,
      total: subtotal,
    };
    sessionStorage.setItem("voice_draft", JSON.stringify(draft));
    navigate(`/documents/new?type=${selectedDocType}&from=voice`);
  };

  const reset = () => {
    setTranscript("");
    setExtracted(null);
    setError("");
    setRecordingSeconds(0);
  };

  const fmtSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const totalItems = extracted?.items?.length || 0;
  const totalAmount = extracted?.items?.reduce((s, i) => s + (i.amount || 0), 0) || 0;

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(v => !v)}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: isRecording ? "#ef4444" : "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: isRecording ? "0 0 0 4px rgba(239,68,68,0.2)" : undefined }}>
          {isRecording ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Voice to Document</p>
          <p className="text-xs text-muted-foreground">
            {isRecording ? `Recording… ${fmtSecs(recordingSeconds)}` : transcribing ? "Transcribing…" : extracting ? "Extracting data…" : "Tap to speak your items and prices"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRecording && <span className="flex h-2 w-2"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>}
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t border-border px-4 pb-5 pt-4 space-y-4">

          {/* Doc type selector */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Document Type</p>
            <div className="flex gap-2 flex-wrap">
              {DOC_OPTIONS.map(({ type, label, icon: Icon, color }) => (
                <button key={type} onClick={() => setSelectedDocType(type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background: selectedDocType === type ? color + "18" : "transparent",
                    borderColor: selectedDocType === type ? color : "hsl(var(--border))",
                    color: selectedDocType === type ? color : "hsl(var(--muted-foreground))"
                  }}>
                  <Icon className="h-3 w-3" />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Record button */}
          <div className="flex flex-col items-center gap-3 py-2">
            {!isRecording ? (
              <button onClick={startRecording}
                className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 hover:scale-105"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 8px 32px rgba(99,102,241,0.45)" }}>
                <Mic className="h-8 w-8 text-white" />
              </button>
            ) : (
              <button onClick={stopRecording}
                className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 animate-pulse"
                style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 8px 32px rgba(239,68,68,0.45)" }}>
                <Square className="h-7 w-7 text-white fill-white" />
              </button>
            )}
            <p className="text-xs text-muted-foreground text-center">
              {isRecording ? (
                <span className="font-bold text-red-500">{fmtSecs(recordingSeconds)} — tap to stop</span>
              ) : "Tap to start recording"}
            </p>
          </div>

          {/* Loading states */}
          {(transcribing || extracting) && (
            <div className="flex items-center gap-2 justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">{transcribing ? "Transcribing audio…" : "Extracting document data…"}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
              <X className="h-3.5 w-3.5 shrink-0" />{error}
            </div>
          )}

          {/* Transcript */}
          {transcript && !isRecording && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transcript</p>
                <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                rows={3}
                className="w-full text-sm border border-border rounded-xl px-3 py-2.5 bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
                placeholder="Transcript will appear here…"
              />
              {!extracting && (
                <button onClick={handleReExtract} className="mt-1.5 text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                  <Sparkles className="h-3 w-3" /> Re-extract from edited transcript
                </button>
              )}
            </div>
          )}

          {/* Extracted items */}
          {extracted && !extracting && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Extracted Items</p>
              <div className="space-y-1.5">
                {extracted.items?.map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${extracted.uncertain_fields?.includes(item.description) ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" : "bg-muted/40"}`}>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{item.description}</span>
                      <span className="text-xs text-muted-foreground">Qty: {item.quantity} × £{item.unit_price?.toLocaleString()}</span>
                    </div>
                    <span className="font-bold text-foreground shrink-0">£{(item.amount || 0).toLocaleString()}</span>
                    {extracted.uncertain_fields?.includes(item.description) && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full shrink-0">Review</span>
                    )}
                  </div>
                ))}
              </div>
              {extracted.customer_name && (
                <p className="text-xs text-muted-foreground mt-2">Customer: <span className="font-semibold text-foreground">{extracted.customer_name}</span></p>
              )}
              {extracted.notes && (
                <p className="text-xs text-muted-foreground mt-1">Notes: <span className="text-foreground">{extracted.notes}</span></p>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">{totalItems} item{totalItems !== 1 ? "s" : ""}</p>
                  <p className="text-base font-bold text-foreground">£{totalAmount.toLocaleString()}</p>
                </div>
                <Button size="sm" onClick={handleCreateDocument} className="gap-1.5">
                  Create {DOC_OPTIONS.find(d => d.type === selectedDocType)?.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}