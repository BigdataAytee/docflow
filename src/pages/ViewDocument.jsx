import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SignaturePad from "../components/SignaturePad";

const TYPE_LABELS = {
  invoice: "INVOICE", quotation: "QUOTATION", receipt: "RECEIPT",
  waybill: "WAYBILL", delivery_note: "DELIVERY NOTE",
  purchase_order: "PURCHASE ORDER", credit_note: "CREDIT NOTE",
  letterhead: "LETTER",
};

const TYPE_ACCENTS = {
  invoice: "#4F46E5", quotation: "#0891b2", receipt: "#059669",
  waybill: "#1e293b", delivery_note: "#1e293b",
  purchase_order: "#b45309", credit_note: "#dc2626", letterhead: "#4F46E5",
};

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-500", sent: "bg-blue-50 text-blue-600",
  paid: "bg-emerald-50 text-emerald-600", overdue: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-500", accepted: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-600",
};

const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", EUR: "€", GBP: "£" };

// Type-specific labels
const AMOUNT_LABEL = { receipt: "Amount Paid", credit_note: "Amount Credited", quotation: "Quoted Amount", purchase_order: "Order Total" };
const CUSTOMER_LABEL = { purchase_order: "Vendor", waybill: "Receiver", delivery_note: "Receiver", letterhead: "Addressed To" };

export default function ViewDocument() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Document.get(docId).then(d => { setDoc(d); setLoading(false); });
  }, [docId]);

  const updateStatus = async (status) => {
    await base44.entities.Document.update(docId, { status });
    setDoc(prev => ({ ...prev, status }));
  };

  const saveManagerSig = async (sig) => {
    await base44.entities.Document.update(docId, { manager_signature: sig });
    setDoc(prev => ({ ...prev, manager_signature: sig }));
  };

  const saveCustomerSig = async (sig) => {
    await base44.entities.Document.update(docId, { customer_signature: sig });
    setDoc(prev => ({ ...prev, customer_signature: sig }));
  };

  const handleDelete = async () => {
    await base44.entities.Document.delete(docId);
    navigate("/documents");
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!doc) return <div className="text-center py-12 text-muted-foreground">Document not found</div>;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 print:hidden">
        <div className="flex items-center gap-3">
          <Link to="/documents" className="p-2 hover:bg-muted rounded-lg"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-xl font-bold">{doc.number}</h1>
            <p className="text-xs text-muted-foreground">{TYPE_LABELS[doc.type]}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[doc.status]}`}>{doc.status}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={doc.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["draft","sent","paid","overdue","cancelled","accepted","rejected"].map(s => (
                <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {doc.status === "draft" && (
        <div className="print:hidden mb-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">What's next?</p>
            <p className="text-xs text-amber-700">Send this document to your customer or mark it as Sent.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateStatus("sent")}><Send className="h-3 w-3 mr-1.5" />Mark as Sent</Button>
          </div>
        </div>
      )}

      <UnifiedTemplate doc={doc} onSaveManagerSig={saveManagerSig} onSaveCustomerSig={saveCustomerSig} />
    </div>
  );
}

function UnifiedTemplate({ doc, onSaveManagerSig, onSaveCustomerSig }) {
  const items = doc.items || [];
  const sym = CURRENCY_SYMBOLS[doc.currency] || doc.currency || "₦";
  const curr = doc.currency || "NGN";
  const accent = TYPE_ACCENTS[doc.type] || "#4F46E5";
  const fmtAmt = (n) => `${(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`;
  const fmtCurr = (n) => `${curr} ${fmtAmt(n)}`;
  const isLetter = doc.type === "letterhead";
  const showFinancials = !isLetter;
  const customerLabel = CUSTOMER_LABEL[doc.type] || "Bill To";
  const amountLabel = AMOUNT_LABEL[doc.type] || "Balance Due";

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden print:shadow-none print:border-0" style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>

      {/* Header */}
      <div style={{ borderTop: `5px solid ${accent}` }} className="px-12 py-8">
        <div className="flex justify-between items-start">
          {/* Logo + Company */}
          <div className="flex-1">
            {doc.logo_url
              ? <img src={doc.logo_url} alt="Logo" className="h-16 w-auto object-contain mb-3" style={{ maxWidth: 180 }} />
              : <div className="h-16 w-40 bg-gray-50 rounded-lg flex items-center justify-center text-gray-300 text-xs border border-dashed border-gray-200 mb-3">No Logo</div>
            }
            {doc.company_name && <p className="font-black text-gray-900 text-base">{doc.company_name}</p>}
            {doc.company_address && <p className="text-gray-500 text-xs whitespace-pre-line mt-0.5 leading-relaxed">{doc.company_address}</p>}
            {doc.company_phone && <p className="text-gray-500 text-xs mt-0.5">{doc.company_phone}</p>}
            {doc.company_email && <p className="text-gray-500 text-xs">{doc.company_email}</p>}
            {doc.company_website && <p className="text-gray-500 text-xs">{doc.company_website}</p>}
          </div>

          {/* Document type + number + amount */}
          <div className="text-right ml-8">
            <h1 className="font-black tracking-widest text-gray-800" style={{ fontSize: 30, color: accent }}>{TYPE_LABELS[doc.type]}</h1>
            <p className="text-gray-400 text-sm font-mono mt-1">{doc.number}</p>
            {showFinancials && (
              <div className="mt-4 rounded-xl px-5 py-3 text-right" style={{ background: `${accent}12`, border: `1px solid ${accent}30` }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>{amountLabel}</p>
                <p className="text-2xl font-black text-gray-900 mt-0.5">{fmtCurr(doc.balance_due || doc.total)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 2, background: `linear-gradient(to right, ${accent}, ${accent}22)` }} />

      {/* From / To / Dates */}
      <div className="px-12 py-6 grid grid-cols-3 gap-8 bg-gray-50/60">
        {/* From */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">From</p>
          <p className="font-semibold text-gray-800 text-sm">{doc.company_name || "—"}</p>
          {doc.company_address && <p className="text-gray-500 text-xs whitespace-pre-line mt-0.5">{doc.company_address}</p>}
          {doc.company_email && <p className="text-gray-500 text-xs mt-0.5">{doc.company_email}</p>}
          {doc.company_phone && <p className="text-gray-500 text-xs">{doc.company_phone}</p>}
        </div>

        {/* To */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{customerLabel}</p>
          <p className="font-semibold text-gray-800 text-sm">{doc.customer_name || "—"}</p>
          {doc.customer_address && <p className="text-gray-500 text-xs whitespace-pre-line mt-0.5">{doc.customer_address}</p>}
          {doc.customer_email && <p className="text-gray-500 text-xs mt-0.5">{doc.customer_email}</p>}
        </div>

        {/* Dates */}
        <div className="text-right">
          {doc.issue_date && (
            <div className="mb-2">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Date</p>
              <p className="font-semibold text-gray-700 text-sm">{format(new Date(doc.issue_date), "dd MMM yyyy")}</p>
            </div>
          )}
          {doc.due_date && (
            <div className="mb-2">
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                {doc.type === "purchase_order" ? "Required By" : doc.type === "quotation" ? "Valid Until" : "Due Date"}
              </p>
              <p className="font-semibold text-gray-700 text-sm">{format(new Date(doc.due_date), "dd MMM yyyy")}</p>
            </div>
          )}
          {doc.terms_label && !isLetter && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Terms</p>
              <p className="text-gray-700 text-sm">{doc.terms_label}</p>
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="px-12 py-8">
        {isLetter ? (
          /* Letter body */
          <div>
            {doc.terms_label && doc.terms_label !== "Due on Receipt" && (
              <p className="font-bold text-gray-900 underline text-sm mb-5">Re: {doc.terms_label}</p>
            )}
            <div className="text-gray-700 text-sm whitespace-pre-wrap min-h-56" style={{ lineHeight: 2 }}>
              {doc.notes || <span className="text-gray-300 italic">No content</span>}
            </div>
            {doc.terms && <p className="mt-8 text-sm text-gray-600">{doc.terms}</p>}
          </div>
        ) : (
          /* Items table */
          <>
            <table className="w-full text-sm mb-2">
              <thead>
                <tr style={{ borderBottom: `2px solid ${accent}` }} className="text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-3 text-left w-8">#</th>
                  <th className="pb-3 text-left">Description</th>
                  <th className="pb-3 text-right px-4">Qty</th>
                  <th className="pb-3 text-right px-4">Rate</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 text-gray-400">{i + 1}</td>
                    <td className="py-3 text-gray-800">{item.description}</td>
                    <td className="py-3 text-right px-4 text-gray-500">{(item.quantity || 0).toFixed(2)}</td>
                    <td className="py-3 text-right px-4 text-gray-500">{fmtAmt(item.unit_price)}</td>
                    <td className="py-3 text-right font-semibold text-gray-800">{fmtAmt(item.amount)}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-300 text-xs">No items</td></tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mt-4 mb-8">
              <div className="w-72 text-sm space-y-2">
                <div className="flex justify-between py-1"><span className="text-gray-400">Subtotal</span><span className="text-gray-700">{fmtAmt(doc.subtotal)}</span></div>
                {doc.tax_amount > 0 && <div className="flex justify-between py-1"><span className="text-gray-400">VAT ({doc.tax_rate}%)</span><span className="text-gray-700">{fmtAmt(doc.tax_amount)}</span></div>}
                {doc.shipping > 0 && <div className="flex justify-between py-1"><span className="text-gray-400">Shipping</span><span className="text-gray-700">{fmtAmt(doc.shipping)}</span></div>}
                {doc.paid_amount > 0 && <div className="flex justify-between py-1 text-emerald-600"><span>Payment Made</span><span>(-) {fmtCurr(doc.paid_amount)}</span></div>}
                <div className="flex justify-between py-3 border-t-2" style={{ borderColor: accent }}>
                  <span className="font-black text-gray-900 uppercase text-sm">{amountLabel}</span>
                  <span className="font-black text-lg" style={{ color: accent }}>{fmtCurr(doc.balance_due || doc.total)}</span>
                </div>
              </div>
            </div>

            {/* Notes / Terms / Payment */}
            {(doc.notes || doc.terms || doc.payment_instructions) && (
              <div className="border-t border-gray-100 pt-6 mb-8 space-y-4 text-sm text-gray-600">
                {doc.notes && <p>{doc.notes}</p>}
                {doc.terms && <div><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Terms &amp; Conditions</p><p>{doc.terms}</p></div>}
                {doc.payment_instructions && <div><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Payment Instructions</p><p>{doc.payment_instructions}</p></div>}
              </div>
            )}
          </>
        )}

        {/* Signatures */}
        <div className="border-t border-gray-200 pt-8 mt-8 grid grid-cols-2 gap-12">
          {/* Manager Signature */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Authorized Signatory</p>
            {doc.manager_signature ? (
              <div>
                <img src={doc.manager_signature} alt="Manager Signature" className="h-16 object-contain mb-2" />
                <div className="border-t border-gray-300 pt-1">
                  <p className="text-xs text-gray-500">{doc.company_name || "Company"}</p>
                </div>
                <button
                  className="text-xs text-primary mt-1 hover:underline print:hidden"
                  onClick={() => onSaveManagerSig("")}
                >Re-sign</button>
              </div>
            ) : (
              <div className="print:hidden">
                <SignaturePad label="" onSave={onSaveManagerSig} />
                <p className="text-xs text-gray-400 mt-1">{doc.company_name || "Company"}</p>
              </div>
            )}
          </div>

          {/* Customer Signature */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              {doc.type === "waybill" || doc.type === "delivery_note" ? "Receiver Signature" : "Customer Signature"}
            </p>
            {doc.customer_signature ? (
              <div>
                <img src={doc.customer_signature} alt="Customer Signature" className="h-16 object-contain mb-2" />
                <div className="border-t border-gray-300 pt-1">
                  <p className="text-xs text-gray-500">{doc.customer_name}</p>
                </div>
                <button
                  className="text-xs text-primary mt-1 hover:underline print:hidden"
                  onClick={() => onSaveCustomerSig("")}
                >Re-sign</button>
              </div>
            ) : (
              <div className="print:hidden">
                <SignaturePad label="" onSave={onSaveCustomerSig} />
                <p className="text-xs text-gray-400 mt-1">{doc.customer_name}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: `${accent}08`, borderTop: `1px solid ${accent}20` }} className="px-12 py-4 text-center">
        <p className="text-xs text-gray-400">
          {[doc.company_name, doc.company_phone, doc.company_email, doc.company_website].filter(Boolean).join("  ·  ")}
        </p>
      </div>
    </div>
  );
}