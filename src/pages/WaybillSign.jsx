import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import SignaturePad from "../components/SignaturePad";
import { CheckCircle2, Loader2, Package } from "lucide-react";

const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", EUR: "€", GBP: "£" };

export default function WaybillSign() {
  const params = new URLSearchParams(window.location.search);
  const docId = params.get("id");

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (!docId) { setError("Invalid link."); setLoading(false); return; }
    base44.functions.invoke("waybillPublic", { action: "get", docId })
      .then(res => { setDoc(res.data.doc); setLoading(false); })
      .catch(() => { setError("Document not found or link is invalid."); setLoading(false); });
  }, [docId]);

  const handleSign = async (sig) => {
    setSaving(true);
    await base44.functions.invoke("waybillPublic", { action: "sign", docId, signature: sig });
    setSaving(false);
    setSigned(true);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-red-500 font-semibold">{error}</p>
        <p className="text-sm text-gray-400 mt-1">Please request a new link from the sender.</p>
      </div>
    </div>
  );

  if (!doc) return null;

  const sym = CURRENCY_SYMBOLS[doc.currency] || "₦";
  const items = doc.items || [];
  const fmt = (n) => `${sym}${(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`;

  if (signed || doc.customer_signature) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Signature Saved</h2>
        <p className="text-gray-500 text-sm">
          Thank you, <strong>{doc.customer_name}</strong>. Your signature for waybill <strong>{doc.number}</strong> has been recorded.
        </p>
        {doc.customer_signature && (
          <div className="mt-6 border border-gray-200 rounded-xl p-4 bg-white inline-block">
            <img src={doc.customer_signature} alt="Your Signature" className="h-16 object-contain mx-auto" />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Package className="h-6 w-6 text-primary" />
          </div>
          {doc.logo_url && <img src={doc.logo_url} alt="Logo" className="h-10 object-contain mx-auto mb-3" />}
          <h1 className="text-xl font-bold text-gray-800">{doc.company_name || "Delivery"}</h1>
          <p className="text-sm text-gray-500 mt-1">Please review and sign to confirm receipt</p>
        </div>

        {/* Document summary card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Waybill</p>
              <p className="font-bold text-gray-800">{doc.number}</p>
            </div>
            {doc.issue_date && (
              <p className="text-sm text-gray-500">{format(new Date(doc.issue_date), "dd MMM yyyy")}</p>
            )}
          </div>

          <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mb-1">From</p>
              <p className="font-semibold text-gray-800">{doc.company_name || "—"}</p>
              {doc.company_address && <p className="text-gray-500 text-xs mt-0.5">{doc.company_address}</p>}
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mb-1">Receiver</p>
              <p className="font-semibold text-gray-800">{doc.customer_name || "—"}</p>
              {doc.customer_address && <p className="text-gray-500 text-xs mt-0.5">{doc.customer_address}</p>}
            </div>
          </div>

          {items.length > 0 && (
            <div className="px-6 py-4">
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mb-3">Items</p>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.description}</span>
                    <span className="text-gray-500 ml-4 shrink-0">×{item.quantity}</span>
                  </div>
                ))}
              </div>
              {doc.total > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between font-bold text-sm">
                  <span>Total</span>
                  <span>{fmt(doc.total)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Signature section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-6">
          <h3 className="font-bold text-gray-800 mb-1">Sign to Confirm Receipt</h3>
          <p className="text-sm text-gray-500 mb-5">
            By signing below, you confirm that you have received the items listed above in good condition.
          </p>
          {saving ? (
            <div className="flex items-center justify-center py-8 gap-3 text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Saving your signature...</span>
            </div>
          ) : (
            <SignaturePad label="Your Signature" onSave={handleSign} />
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          This document is from {doc.company_name}{doc.company_phone ? ` · ${doc.company_phone}` : ""}
        </p>
      </div>
    </div>
  );
}