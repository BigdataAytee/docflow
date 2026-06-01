import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Receipt, X, ArrowRight, CalendarDays, Truck } from "lucide-react";
import { format } from "date-fns";

const today = () => new Date().toISOString().split("T")[0];
const addDays = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};

export default function ConvertDocumentModal({ doc, targetType, onConfirm, onClose }) {
  const isInvoice = targetType === "invoice";
  const isReceipt = targetType === "receipt";
  const isWaybill = targetType === "waybill";

  const prefix = isInvoice ? "INV" : isReceipt ? "REC" : "WB";
  const suggestedNumber = doc.number
    .replace(/^INV/i, prefix)
    .replace(/^QUO/i, prefix)
    .replace(/^QU/i, prefix);

  const [form, setForm] = useState({
    number: suggestedNumber,
    issue_date: today(),
    due_date: isInvoice ? addDays(14) : isWaybill ? "" : today(),
    payment_method: doc.payment_method || "",
    notes: doc.notes || "",
  });

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleConfirm = () => {
    if (!form.number.trim()) return;
    onConfirm(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-5 flex items-center gap-3 ${isInvoice ? "bg-indigo-600" : isWaybill ? "bg-orange-600" : "bg-emerald-600"}`}>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            {isInvoice ? <FileText className="h-5 w-5 text-white" /> : isWaybill ? <Truck className="h-5 w-5 text-white" /> : <Receipt className="h-5 w-5 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-white text-base leading-tight">
              Convert to {isInvoice ? "Invoice" : isWaybill ? "Waybill" : "Receipt"}
            </h2>
            <p className="text-white/70 text-xs mt-0.5 truncate">
              From: {doc.number} · {doc.customer_name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Info strip */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-start gap-2">
          <span className="text-amber-500 mt-0.5">ℹ️</span>
          <p className="text-xs text-amber-800">
            The original quotation <strong>{doc.number}</strong> will remain unchanged.
            A new {isInvoice ? "invoice" : isWaybill ? "waybill" : "receipt"} document will be created and opened.
          </p>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <Label className="text-xs font-semibold">{isInvoice ? "Invoice" : isWaybill ? "Waybill" : "Receipt"} Number</Label>
            <Input
              className="mt-1 font-mono"
              value={form.number}
              onChange={e => update("number", e.target.value)}
              placeholder={isInvoice ? "INV-0001" : isWaybill ? "WB-0001" : "REC-0001"}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Issue Date</Label>
              <Input className="mt-1" type="date" value={form.issue_date} onChange={e => update("issue_date", e.target.value)} />
            </div>
            {isInvoice && (
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Due Date</Label>
                <Input className="mt-1" type="date" value={form.due_date} onChange={e => update("due_date", e.target.value)} />
              </div>
            )}
            {isReceipt && (
              <div>
                <Label className="text-xs font-semibold">Payment Date</Label>
                <Input className="mt-1" type="date" value={form.due_date} onChange={e => update("due_date", e.target.value)} />
              </div>
            )}
          </div>



          {isInvoice && (
            <div>
              <Label className="text-xs font-semibold">Payment Method <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Select value={form.payment_method} onValueChange={v => update("payment_method", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select payment method" /></SelectTrigger>
                <SelectContent>
                  {["Cash","Bank Transfer","POS","Credit Card","Mobile Money","Cheque"].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold">Additional Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <textarea
              className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
              value={form.notes}
              onChange={e => update("notes", e.target.value)}
              placeholder="Any additional notes for this document…"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className={`flex-1 gap-2 font-bold ${isInvoice ? "bg-indigo-600 hover:bg-indigo-700" : isWaybill ? "bg-orange-600 hover:bg-orange-700" : "bg-emerald-600 hover:bg-emerald-700"} text-white`}
            onClick={handleConfirm}
            disabled={!form.number.trim()}
          >
            <ArrowRight className="h-4 w-4" />
            Create {isInvoice ? "Invoice" : isWaybill ? "Waybill" : "Receipt"}
          </Button>
        </div>
      </div>
    </div>
  );
}