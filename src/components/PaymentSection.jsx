import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CreditCard, Link2, Loader2, CheckCircle2, Clock, XCircle, AlertCircle, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STATUS_CONFIG = {
  unpaid:         { label: "Unpaid",          color: "bg-slate-100 text-slate-600",   icon: AlertCircle },
  pending:        { label: "Pending",         color: "bg-amber-100 text-amber-700",   icon: Clock },
  paid:           { label: "Paid",            color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  failed:         { label: "Failed",          color: "bg-red-100 text-red-700",       icon: XCircle },
  partially_paid: { label: "Partially Paid",  color: "bg-blue-100 text-blue-700",     icon: AlertCircle },
};

export default function PaymentSection({ document, onStatusChange }) {
  const [paymentRecord, setPaymentRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const isPayable = document?.type === "invoice" || document?.type === "quotation";

  useEffect(() => {
    if (!document?.id || !isPayable) { setLoading(false); return; }
    base44.entities.PaymentRecord.filter({ document_id: document.id }).then(records => {
      setPaymentRecord(records[0] || null);
      setLoading(false);
    });
  }, [document?.id]);

  const generateLink = async () => {
    setGenerating(true);
    const res = await base44.functions.invoke("generatePaymentLink", { document_id: document.id });
    if (res.data?.payment_link) {
      setPaymentRecord(prev => ({
        ...(prev || {}),
        payment_link: res.data.payment_link,
        payment_reference: res.data.payment_reference,
        payment_status: "unpaid",
      }));
      toast.success("Payment link generated!");
    }
    setGenerating(false);
  };

  const copyLink = () => {
    if (paymentRecord?.payment_link) {
      navigator.clipboard.writeText(paymentRecord.payment_link);
      toast.success("Payment link copied!");
    }
  };

  const refreshStatus = async () => {
    const records = await base44.entities.PaymentRecord.filter({ document_id: document.id });
    if (records[0]) {
      setPaymentRecord(records[0]);
      if (onStatusChange) onStatusChange(records[0].payment_status);
    }
  };

  if (!isPayable) return null;
  if (loading) return <div className="h-12 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading payment info…</div>;

  const status = paymentRecord?.payment_status || "unpaid";
  const S = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;
  const StatusIcon = S.icon;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <CreditCard className="h-4 w-4 text-indigo-600" />
          <h3 className="font-semibold text-sm">Payment</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${S.color}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {S.label}
          </span>
          <button onClick={refreshStatus} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors" title="Refresh status">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Amount summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/30 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Amount Due</p>
            <p className="font-bold text-sm text-foreground">{document.currency || ""} {(document.balance_due || document.total || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Amount Paid</p>
            <p className="font-bold text-sm text-emerald-600">{document.currency || ""} {(document.paid_amount || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Balance</p>
            <p className={`font-bold text-sm ${(document.balance_due || 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {document.currency || ""} {Math.max(0, document.balance_due || 0).toLocaleString("en", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Payment link */}
        {paymentRecord?.payment_link ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Payment Link</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted/40 rounded-lg px-3 py-2 text-xs font-mono text-foreground truncate border border-border">
                  {paymentRecord.payment_link}
                </div>
                <button onClick={copyLink} className="shrink-0 p-2 border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Copy link">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <a href={paymentRecord.payment_link} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 p-2 border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Open link">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
            {paymentRecord.payment_reference && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-mono font-semibold">{paymentRecord.payment_reference}</span>
              </div>
            )}
            {paymentRecord.payment_provider && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-semibold capitalize">{paymentRecord.payment_provider}</span>
              </div>
            )}
            {paymentRecord.payment_date && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Payment Date</span>
                <span className="font-semibold">{new Date(paymentRecord.payment_date).toLocaleDateString()}</span>
              </div>
            )}
            {paymentRecord.transaction_id && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Transaction ID</span>
                <span className="font-mono font-semibold text-xs">{paymentRecord.transaction_id}</span>
              </div>
            )}
            {paymentRecord.receipt_number && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-emerald-800">Receipt Generated</p>
                  <p className="text-xs text-emerald-600 font-mono">{paymentRecord.receipt_number}</p>
                </div>
              </div>
            )}
            {status !== "paid" && (
              <Button size="sm" variant="outline" onClick={generateLink} disabled={generating} className="w-full gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                {generating ? "Regenerating…" : "Regenerate Link"}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">No payment link yet. Generate one to let your customer pay online.</p>
            <Button onClick={generateLink} disabled={generating} className="w-full gap-2 font-semibold" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Link2 className="h-4 w-4" /> Generate Pay Now Link</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}