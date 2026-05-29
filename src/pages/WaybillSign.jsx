import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { CheckCircle2, Loader2, Package, Truck, MapPin, User, Calendar, Hash, AlertCircle, PenLine, Type, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", EUR: "€", GBP: "£" };

// Signature canvas component
function SignatureCanvas({ onSave, disabled }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPos = useRef(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => setIsDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const save = () => {
    if (!hasDrawn) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className="space-y-3">
      <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden"
           style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <PenLine className="h-7 w-7 text-slate-300 mx-auto mb-1" />
              <p className="text-sm text-slate-400">Sign here using finger or mouse</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={clear} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </button>
        <button
          onClick={save}
          disabled={!hasDrawn}
          className="flex-1 bg-slate-900 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Use This Signature
        </button>
      </div>
    </div>
  );
}

export default function WaybillSign() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const legacyId = params.get("id");

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);

  // Signing flow state
  const [sigMode, setSigMode] = useState("draw"); // draw | type
  const [typedSig, setTypedSig] = useState("");
  const [signerName, setSignerName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [capturedSig, setCapturedSig] = useState(null); // dataUrl
  const [step, setStep] = useState("info"); // info | sign | submitting | done

  useEffect(() => {
    if (!token && !legacyId) { setError("Invalid signing link."); setLoading(false); return; }

    if (token) {
      base44.functions.invoke("waybillSigning", { action: "getByToken", token })
        .then(res => {
          setDoc(res.data.doc);
          setSignerName(res.data.doc?.customer_name || "");
          if (res.data.doc?.status === "signed" || res.data.doc?.customer_signature) setSigned(true);
          setLoading(false);
        })
        .catch(() => { setError("This signing link is invalid or has expired."); setLoading(false); });
    } else {
      // Legacy fallback: get by docId
      base44.functions.invoke("waybillPublic", { action: "get", docId: legacyId })
        .then(res => {
          setDoc(res.data.doc);
          setSignerName(res.data.doc?.customer_name || "");
          if (res.data.doc?.customer_signature) setSigned(true);
          setLoading(false);
        })
        .catch(() => { setError("Document not found or link is invalid."); setLoading(false); });
    }
  }, [token, legacyId]);

  const uploadSigDataUrl = async (dataUrl) => {
    const [header, data] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const file = new File([arr], "signature.png", { type: mime });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  const generateTypedSigDataUrl = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 400, 120);
    ctx.font = "italic 42px Georgia, serif";
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedSig, 200, 60);
    return canvas.toDataURL("image/png");
  };

  const handleSubmit = async () => {
    setSaving(true);
    setStep("submitting");
    let sigDataUrl = capturedSig;
    if (sigMode === "type" && typedSig.trim()) {
      sigDataUrl = generateTypedSigDataUrl();
    }
    if (!sigDataUrl) { setSaving(false); setStep("sign"); return; }
    const sigUrl = await uploadSigDataUrl(sigDataUrl);
    if (token) {
      await base44.functions.invoke("waybillSigning", { action: "submitSignature", token, signature: sigUrl, signerName });
    } else {
      await base44.functions.invoke("waybillPublic", { action: "sign", docId: legacyId, signature: sigUrl });
    }
    setSaving(false);
    setSigned(true);
    setStep("done");
  };

  const sym = CURRENCY_SYMBOLS[doc?.currency] || "₦";
  const items = doc?.items || [];
  const fmt = (n) => `${sym}${(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`;

  // ── LOADING ──
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Loading waybill…</p>
      </div>
    </div>
  );

  // ── ERROR ──
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl border border-red-100 shadow-lg p-8 max-w-sm w-full text-center">
        <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Link Unavailable</h2>
        <p className="text-slate-500 text-sm">{error}</p>
        <p className="text-xs text-slate-400 mt-3">Contact the sender for a new link.</p>
      </div>
    </div>
  );

  // ── ALREADY SIGNED ──
  if (signed || (doc?.status === "signed" && doc?.customer_signature)) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-50 px-4">
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-xl p-8 max-w-sm w-full text-center">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Delivery Confirmed!</h2>
        <p className="text-slate-500 text-sm mb-5">
          Waybill <strong>{doc?.number}</strong> has been signed by <strong>{doc?.signed_by || doc?.customer_name}</strong>.
        </p>
        {doc?.signed_at && (
          <p className="text-xs text-slate-400 mb-5">
            Signed {format(new Date(doc.signed_at), "dd MMM yyyy 'at' HH:mm")}
          </p>
        )}
        {doc?.customer_signature && (
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-semibold">Signature on file</p>
            <img src={doc.customer_signature} alt="Signature" className="h-14 object-contain mx-auto" />
          </div>
        )}
        <p className="text-xs text-slate-400 mt-5">This page is your confirmation. You may close it safely.</p>
      </div>
    </div>
  );

  if (!doc) return null;

  // ── INFO STEP ──
  if (step === "info") return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        {doc.logo_url ? (
          <img src={doc.logo_url} alt="Logo" className="h-8 object-contain" />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
            <Package className="h-4 w-4 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{doc.company_name || "Delivery Confirmation"}</p>
          <p className="text-xs text-slate-400 truncate">Waybill {doc.number}</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-100">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400 inline-block" />
          Awaiting Signature
        </span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Document summary */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-900 px-6 py-4 text-white">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Waybill Number</p>
            <p className="text-2xl font-black tracking-tight">{doc.number}</p>
            {doc.issue_date && (
              <p className="text-xs text-slate-400 mt-1">{format(new Date(doc.issue_date), "dd MMMM yyyy")}</p>
            )}
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
            <div className="px-5 py-4">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-1.5">Sender</p>
              <p className="font-semibold text-slate-800 text-sm">{doc.company_name || "—"}</p>
              {doc.company_address && <p className="text-xs text-slate-500 mt-0.5">{doc.company_address}</p>}
              {doc.company_phone && <p className="text-xs text-slate-500">{doc.company_phone}</p>}
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-1.5">Receiver</p>
              <p className="font-semibold text-slate-800 text-sm">{doc.customer_name || "—"}</p>
              {doc.customer_address && <p className="text-xs text-slate-500 mt-0.5">{doc.customer_address}</p>}
              {doc.customer_phone && <p className="text-xs text-slate-500">{doc.customer_phone}</p>}
            </div>
          </div>

          {/* Logistics */}
          <div className="px-5 py-4 border-b border-slate-100 grid grid-cols-3 gap-3 text-xs">
            {doc.driver_name && (
              <div>
                <div className="flex items-center gap-1 text-slate-400 mb-0.5"><User className="h-3 w-3" /> Driver</div>
                <p className="font-semibold text-slate-700">{doc.driver_name}</p>
              </div>
            )}
            {doc.vehicle_number && (
              <div>
                <div className="flex items-center gap-1 text-slate-400 mb-0.5"><Truck className="h-3 w-3" /> Vehicle</div>
                <p className="font-semibold text-slate-700">{doc.vehicle_number}</p>
              </div>
            )}
            {doc.tracking_number && (
              <div>
                <div className="flex items-center gap-1 text-slate-400 mb-0.5"><Hash className="h-3 w-3" /> Tracking</div>
                <p className="font-semibold text-slate-700">{doc.tracking_number}</p>
              </div>
            )}
            {doc.due_date && (
              <div>
                <div className="flex items-center gap-1 text-slate-400 mb-0.5"><Calendar className="h-3 w-3" /> Delivery</div>
                <p className="font-semibold text-slate-700">{format(new Date(doc.due_date), "dd MMM yyyy")}</p>
              </div>
            )}
            {doc.customer_address && (
              <div className="col-span-2">
                <div className="flex items-center gap-1 text-slate-400 mb-0.5"><MapPin className="h-3 w-3" /> Destination</div>
                <p className="font-semibold text-slate-700">{doc.customer_address}</p>
              </div>
            )}
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-3">Goods Description</p>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between items-start text-sm">
                    <span className="text-slate-700 flex-1">{item.description}</span>
                    <span className="text-slate-500 ml-4 shrink-0 font-medium">×{item.quantity}</span>
                  </div>
                ))}
              </div>
              {doc.total > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between font-bold text-sm">
                  <span className="text-slate-600">Total Value</span>
                  <span className="text-slate-800">{fmt(doc.total)}</span>
                </div>
              )}
            </div>
          )}

          {doc.notes && (
            <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
              <p className="text-xs font-semibold text-amber-700 mb-1">Delivery Notes</p>
              <p className="text-xs text-amber-600">{doc.notes}</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div>
            <h3 className="font-bold text-slate-800">Ready to Sign?</h3>
            <p className="text-sm text-slate-500 mt-1">
              Please confirm your name and sign to acknowledge receipt of the goods listed above.
            </p>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Your Full Name</Label>
            <Input
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Enter your full name"
              className="mt-1"
            />
          </div>
          <Button
            className="w-full h-12 text-base font-bold bg-slate-900 hover:bg-slate-800 gap-2"
            disabled={!signerName.trim()}
            onClick={() => setStep("sign")}
          >
            <PenLine className="h-5 w-5" /> Proceed to Sign
          </Button>
        </div>

        <p className="text-center text-xs text-slate-400 pb-4">
          Secured by {doc.company_name || "your delivery partner"} · This link is unique to you
        </p>
      </div>
    </div>
  );

  // ── SIGN STEP ──
  if (step === "sign") return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => setStep("info")} className="text-slate-500 hover:text-slate-700 text-sm">← Back</button>
        <div className="flex-1 text-center">
          <p className="font-bold text-slate-800 text-sm">{doc.number}</p>
          <p className="text-xs text-slate-400">Sign to confirm delivery</p>
        </div>
        <div className="w-16" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Signer info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="font-bold text-slate-800">{signerName}</p>
            <p className="text-xs text-slate-400">Signing as receiver for Waybill {doc.number}</p>
          </div>
        </div>

        {/* Signature area */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <h3 className="font-bold text-slate-800 mb-1">Your Signature</h3>
            <p className="text-sm text-slate-500">Draw your signature or type your name below.</p>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setSigMode("draw")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${sigMode === "draw" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              <PenLine className="h-4 w-4" /> Draw
            </button>
            <button
              onClick={() => setSigMode("type")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${sigMode === "type" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              <Type className="h-4 w-4" /> Type
            </button>
          </div>

          {sigMode === "draw" ? (
            <SignatureCanvas
              onSave={(dataUrl) => {
                setCapturedSig(dataUrl);
              }}
            />
          ) : (
            <div className="space-y-3">
              <Input
                value={typedSig}
                onChange={e => setTypedSig(e.target.value)}
                placeholder="Type your full name…"
                className="h-12 text-base"
              />
              {typedSig && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-center">
                  <p style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 32, color: "#1e293b" }}>
                    {typedSig}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Preview of typed signature</p>
                </div>
              )}
            </div>
          )}

          {/* Signature captured confirm */}
          {(capturedSig && sigMode === "draw") || (typedSig && sigMode === "type") ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700 font-medium">Signature ready</p>
            </div>
          ) : null}
        </div>

        {/* Confirmation checkbox */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-800"
            />
            <span className="text-sm text-slate-600">
              I confirm that I have received all goods listed in Waybill <strong>{doc.number}</strong> in good condition, and I agree to this delivery confirmation.
            </span>
          </label>
        </div>

        {/* Submit */}
        <Button
          className="w-full h-13 text-base font-bold bg-emerald-600 hover:bg-emerald-700 gap-2 py-4"
          disabled={
            !confirmed ||
            (sigMode === "draw" && !capturedSig) ||
            (sigMode === "type" && !typedSig.trim()) ||
            saving
          }
          onClick={handleSubmit}
        >
          {saving ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting…</> : <><CheckCircle2 className="h-5 w-5" /> Submit Signature</>}
        </Button>

        <p className="text-center text-xs text-slate-400 pb-6">
          By submitting, you confirm you are authorized to sign on behalf of {doc.customer_name}.
        </p>
      </div>
    </div>
  );

  // ── SUBMITTING ──
  if (step === "submitting") return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500 mx-auto mb-3" />
        <p className="font-semibold text-slate-800">Securing your signature…</p>
        <p className="text-sm text-slate-400 mt-1">Please do not close this page</p>
      </div>
    </div>
  );

  return null;
}