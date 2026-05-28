import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { CheckCircle, PenLine, Printer, Upload, Trash2, X, ChevronRight, Package, Clock, User } from "lucide-react";

// ─── Signature Canvas ────────────────────────────────────────────────────────
function SignatureCanvas({ onApply }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPoint = useRef(null);
  const [hasSig, setHasSig] = useState(false);

  const getPoint = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = e.touches?.[0] || e;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current;
    const pt = getPoint(e, canvas);
    lastPoint.current = pt;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#1d4ed8";
    ctx.fill();
    setHasSig(true);
  }, []);

  const draw = useCallback((e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pt = getPoint(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.quadraticCurveTo(
      lastPoint.current.x, lastPoint.current.y,
      (pt.x + lastPoint.current.x) / 2,
      (pt.y + lastPoint.current.y) / 2
    );
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPoint.current = pt;
  }, []);

  const stopDraw = useCallback(() => { drawing.current = false; }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  const apply = () => {
    if (!hasSig) return;
    onApply(canvasRef.current.toDataURL("image/png"));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDraw);
    return () => {
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDraw);
    };
  }, [startDraw, draw, stopDraw]);

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative border-2 border-slate-200 rounded-2xl bg-white overflow-hidden shadow-inner"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          width={1200}
          height={500}
          className="w-full"
          style={{ display: "block", cursor: "crosshair", minHeight: 200 }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
        />
        {!hasSig && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
            <PenLine className="h-8 w-8 text-slate-200" />
            <p className="text-slate-300 text-sm select-none font-medium">Sign here using finger, mouse or stylus</p>
          </div>
        )}
        {/* Signature line */}
        <div className="absolute bottom-12 left-10 right-10 flex items-end gap-3">
          <div className="flex-1 border-b-2 border-slate-300" />
          <span className="text-xs text-slate-300 pb-0.5 shrink-0">Receiver Signature</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={clear} className="gap-2 flex-1" disabled={!hasSig}>
          <Trash2 className="h-4 w-4" /> Clear
        </Button>
        <Button onClick={apply} disabled={!hasSig} className="gap-2 flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white">
          <CheckCircle className="h-4 w-4" /> Apply Signature
        </Button>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function WaybillSignatureModal({ doc, onClose, onSaved }) {
  const [mode, setMode] = useState("digital");
  const [step, setStep] = useState("info"); // "info" | "sign"
  const [receiverName, setReceiverName] = useState(doc.receiver_name || doc.customer_name || "");
  const [saving, setSaving] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState(doc.delivery_proof_url || "");
  const proofInputRef = useRef(null);

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().slice(0, 5);
  const displayDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const uploadSig = async (dataUrl) => {
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const file = new File([arr], 'signature.png', { type: mime });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  const handleDigitalSign = async (sigDataUrl) => {
    setSaving(true);
    const sigUrl = await uploadSig(sigDataUrl);
    const updates = {
      customer_signature: sigUrl,
      receiver_name: receiverName,
      receiver_date: todayStr,
      receiver_time: timeStr,
      delivery_signed_at: now.toISOString(),
      status: "delivered",
    };
    await base44.entities.Document.update(doc.id, updates);
    onSaved({ ...doc, ...updates });
    setSaving(false);
    onClose();
  };

  const handleProofUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const updates = {
      delivery_proof_url: file_url,
      receiver_name: receiverName,
      receiver_date: todayStr,
      receiver_time: timeStr,
      delivery_signed_at: now.toISOString(),
      status: "delivered",
    };
    await base44.entities.Document.update(doc.id, updates);
    setProofUrl(file_url);
    onSaved({ ...doc, ...updates });
    setUploadingProof(false);
    onClose();
  };

  const canProceed = receiverName.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80" onClick={onClose}>
      <div
        className="flex flex-col bg-white w-full h-full max-w-2xl mx-auto shadow-2xl overflow-hidden"
        style={{ maxHeight: "100dvh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="shrink-0 bg-slate-900 text-white">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Package className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-bold text-base leading-tight">Proof of Delivery</h2>
                <p className="text-xs text-slate-400">{doc.number} · {doc.customer_name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex border-t border-slate-800">
            <button
              onClick={() => { setMode("digital"); setStep("info"); }}
              className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                mode === "digital" ? "text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50" : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <PenLine className="h-4 w-4" /> Digital Signature
            </button>
            <button
              onClick={() => { setMode("paper"); setStep("info"); }}
              className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                mode === "paper" ? "text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50" : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <Printer className="h-4 w-4" /> Paper Mode
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* STEP: Info */}
          {step === "info" && (
            <div className="p-5 space-y-5">

              {/* Delivery summary card */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Delivery Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Package className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-slate-400">Waybill</p><p className="font-semibold text-slate-800">{doc.number}</p></div>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-slate-400">Recipient</p><p className="font-semibold text-slate-800">{doc.customer_name}</p></div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-slate-400">Date &amp; Time</p><p className="font-semibold text-slate-800">{displayDate} · {timeStr}</p></div>
                  </div>
                  {doc.driver_name && (
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div><p className="text-xs text-slate-400">Driver</p><p className="font-semibold text-slate-800">{doc.driver_name}</p></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Receiver info form */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Receiver Information</p>
                <div>
                  <Label className="text-sm font-semibold">Receiver Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    placeholder="Enter receiver's full name"
                    className="mt-1.5 h-11 text-base"
                    autoComplete="name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-semibold">Date Received</Label>
                    <Input value={displayDate} readOnly className="mt-1.5 h-11 bg-slate-50 cursor-default text-slate-600" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Time Received</Label>
                    <Input value={timeStr} readOnly className="mt-1.5 h-11 bg-slate-50 cursor-default text-slate-600" />
                  </div>
                </div>
              </div>

              {mode === "digital" ? (
                <Button
                  className="w-full h-12 text-base font-bold bg-slate-900 hover:bg-slate-800 gap-2"
                  disabled={!canProceed}
                  onClick={() => setStep("sign")}
                >
                  <PenLine className="h-5 w-5" /> Proceed to Sign
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              ) : (
                <div className="space-y-4">
                  {/* Paper mode actions */}
                  <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center bg-slate-50 space-y-3">
                    <Printer className="h-10 w-10 text-slate-300 mx-auto" />
                    <div>
                      <p className="font-semibold text-sm text-slate-700">Paper Signature Mode</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                        Print the waybill, have the receiver sign physically, then upload the signed copy or a photo of the signed document.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
                      <Button variant="outline" onClick={() => window.print()} className="gap-2">
                        <Printer className="h-4 w-4" /> Print Waybill
                      </Button>
                      <Button
                        onClick={() => proofInputRef.current?.click()}
                        disabled={uploadingProof || !canProceed}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Upload className="h-4 w-4" />
                        {uploadingProof ? "Uploading…" : "Upload Signed Copy"}
                      </Button>
                      <input ref={proofInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleProofUpload} />
                    </div>
                    {!canProceed && (
                      <p className="text-xs text-amber-600 font-medium">⚠ Please enter receiver's name first</p>
                    )}
                  </div>

                  {proofUrl && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
                      <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-800">Proof of Delivery Uploaded ✓</p>
                        <a href={proofUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline truncate block">
                          View uploaded document
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP: Sign (Digital only) */}
          {step === "sign" && mode === "digital" && (
            <div className="p-5 space-y-4">
              {/* Receiver recap */}
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Signing as</p>
                    <p className="text-sm font-bold text-slate-800">{receiverName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{displayDate}</p>
                  <p className="text-xs text-slate-500">{timeStr}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Receiver Signature</p>
                <SignatureCanvas onApply={handleDigitalSign} />
              </div>

              {saving && (
                <div className="text-center py-2">
                  <p className="text-sm text-slate-500 animate-pulse font-medium">Saving signature and marking as delivered…</p>
                </div>
              )}

              <button
                onClick={() => setStep("info")}
                className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors py-2"
              >
                ← Back to receiver details
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-5 py-4 border-t bg-slate-50 flex items-center gap-2">
          <div className="flex-1">
            {doc.status === "delivered" ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">Delivery Confirmed</span>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Completing this will mark the delivery as <strong>Delivered</strong></p>
            )}
          </div>
          <Button variant="outline" onClick={onClose} size="sm">Cancel</Button>
        </div>
      </div>
    </div>
  );
}