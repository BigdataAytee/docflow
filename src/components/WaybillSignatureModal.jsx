import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { CheckCircle, PenLine, Printer, Upload, Trash2, X } from "lucide-react";

function SignatureCanvas({ onSave, onClear }) {
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
    ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "#1e293b";
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
    ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, (pt.x + lastPoint.current.x) / 2, (pt.y + lastPoint.current.y) / 2);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
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
    onClear?.();
  };

  const save = () => {
    if (!hasSig) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onSave(dataUrl);
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
    <div className="flex flex-col gap-3">
      <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden"
        style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          width={900}
          height={320}
          className="w-full"
          style={{ display: "block", cursor: "crosshair" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
        />
        {!hasSig && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-300 text-sm select-none">Sign here using finger, mouse or stylus</p>
          </div>
        )}
        <div className="absolute bottom-0 left-8 right-8 h-px bg-slate-200" />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear} className="gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </Button>
        <Button size="sm" onClick={save} disabled={!hasSig} className="gap-1.5 flex-1">
          <CheckCircle className="h-3.5 w-3.5" /> Apply Signature
        </Button>
      </div>
    </div>
  );
}

export default function WaybillSignatureModal({ doc, onClose, onSaved }) {
  const [mode, setMode] = useState("digital"); // "digital" | "paper"
  const [receiverName, setReceiverName] = useState(doc.receiver_name || doc.customer_name || "");
  const [saving, setSaving] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState(doc.delivery_proof_url || "");
  const proofInputRef = useRef(null);

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().slice(0, 5);

  const handleDigitalSign = async (sigDataUrl) => {
    setSaving(true);
    const updates = {
      customer_signature: sigDataUrl,
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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col" onClick={onClose}>
      <div
        className="flex flex-col bg-white w-full h-full max-w-2xl mx-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: "100dvh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-900 text-white shrink-0">
          <div>
            <h2 className="font-bold text-base">Confirm Delivery</h2>
            <p className="text-xs text-slate-400">{doc.number} — {doc.customer_name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setMode("digital")}
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mode === "digital" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:bg-muted"}`}
          >
            <PenLine className="h-4 w-4" /> Digital Signature
          </button>
          <button
            onClick={() => setMode("paper")}
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mode === "paper" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Printer className="h-4 w-4" /> Paper Signature
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Receiver Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Receiver Full Name</Label>
              <Input
                value={receiverName}
                onChange={e => setReceiverName(e.target.value)}
                placeholder="Enter receiver's full name"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Date Received</Label>
              <Input value={todayStr} readOnly className="mt-1 bg-muted/40 cursor-default" />
            </div>
            <div>
              <Label>Time Received</Label>
              <Input value={timeStr} readOnly className="mt-1 bg-muted/40 cursor-default" />
            </div>
          </div>

          {mode === "digital" && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">Receiver Signature</Label>
                <p className="text-xs text-muted-foreground mb-2">Sign in the box below using finger, mouse, or stylus</p>
              </div>
              <SignatureCanvas onSave={handleDigitalSign} />
              {saving && <p className="text-xs text-center text-muted-foreground animate-pulse">Saving signature and marking as delivered…</p>}
            </div>
          )}

          {mode === "paper" && (
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50">
                <Printer className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-sm text-slate-700 mb-1">Paper Signature Mode</p>
                <p className="text-xs text-muted-foreground mb-4">Print the waybill, have the receiver sign it physically, then upload the signed copy or proof of delivery photo below.</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
                    <Printer className="h-4 w-4" /> Print Waybill
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => proofInputRef.current?.click()}
                    disabled={uploadingProof}
                    className="gap-1.5"
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingProof ? "Uploading…" : "Upload Signed Copy"}
                  </Button>
                  <input ref={proofInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleProofUpload} />
                </div>
              </div>

              {proofUrl && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-800">Proof of Delivery Uploaded</p>
                    <a href={proofUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline truncate block">View document</a>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery Log Preview</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground text-xs">Signed By</span><p className="font-medium">{receiverName || "—"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Date</span><p className="font-medium">{todayStr}</p></div>
                  <div><span className="text-muted-foreground text-xs">Time</span><p className="font-medium">{timeStr}</p></div>
                  <div><span className="text-muted-foreground text-xs">Status</span><p className="font-medium text-emerald-600">Delivered</p></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}