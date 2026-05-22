import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Printer, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SignaturePad from "../components/SignaturePad";

const typeLabels = {
  invoice: "INVOICE", quotation: "QUOTATION", receipt: "RECEIPT",
  waybill: "WAYBILL", delivery_note: "DELIVERY NOTE",
  purchase_order: "PURCHASE ORDER", credit_note: "CREDIT NOTE",
};

const statusColors = {
  draft: "bg-gray-100 text-gray-500",
  sent: "bg-blue-50 text-blue-600",
  paid: "bg-emerald-50 text-emerald-600",
  overdue: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
  accepted: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-600",
};

const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", EUR: "€", GBP: "£" };

export default function ViewDocument() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clientSig, setClientSig] = useState(null);

  useEffect(() => {
    base44.entities.Document.get(docId).then(d => { setDoc(d); setLoading(false); });
  }, [docId]);

  const updateStatus = async (status) => {
    await base44.entities.Document.update(docId, { status });
    setDoc(prev => ({ ...prev, status }));
  };

  const handleDelete = async () => {
    await base44.entities.Document.delete(docId);
    navigate("/documents");
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!doc) return <div className="text-center py-12 text-muted-foreground">Document not found</div>;

  const isWaybill = doc.type === "waybill" || doc.type === "delivery_note";
  const sym = CURRENCY_SYMBOLS[doc.currency] || doc.currency || "₦";
  const curr = doc.currency || "NGN";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 print:hidden">
        <div className="flex items-center gap-3">
          <Link to="/documents" className="p-2 hover:bg-muted rounded-lg"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-xl font-bold">{doc.number}</h1>
            <p className="text-xs text-muted-foreground">{typeLabels[doc.type]}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[doc.status]}`}>{doc.status}</span>
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

      {/* Status action banner */}
      {doc.status === "draft" && (
        <div className="print:hidden mb-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">✦ WHAT'S NEXT?</p>
            <p className="text-xs text-amber-700">Send this {typeLabels[doc.type].toLowerCase()} to your customer or mark it as Sent.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateStatus("sent")}><Send className="h-3 w-3 mr-1.5" />Send Invoice</Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus("sent")}>Mark As Sent</Button>
          </div>
        </div>
      )}

      {isWaybill ? (
        <WaybillTemplate doc={doc} sym={sym} curr={curr} clientSig={clientSig} setClientSig={setClientSig} />
      ) : (
        <ZohoTemplate doc={doc} sym={sym} curr={curr} clientSig={clientSig} setClientSig={setClientSig} />
      )}
    </div>
  );
}

function ZohoTemplate({ doc, sym, curr, clientSig, setClientSig }) {
  const items = doc.items || [];
  const fmtAmt = (n) => `${(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`;
  const fmtCurr = (n) => `${curr}${fmtAmt(n)}`;

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden" style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Draft watermark */}
      {doc.status === "draft" && (
        <div className="absolute pointer-events-none" style={{ top: 120, left: 30, transform: "rotate(-30deg)", opacity: 0.08, fontSize: 80, fontWeight: 900, color: "#000", zIndex: 0 }}>Draft</div>
      )}

      <div className="relative px-12 py-10">
        {/* Header: Logo left | Doc type + number + balance right */}
        <div className="flex justify-between items-start mb-10">
          <div className="flex-1">
            {doc.logo_url ? (
              <img src={doc.logo_url} alt="Company Logo" className="h-28 w-auto object-contain" style={{ maxWidth: 200 }} />
            ) : (
              <div className="h-28 w-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">No Logo</div>
            )}
          </div>
          <div className="text-right">
            <h1 className="text-5xl font-light text-gray-700 tracking-wide">{typeLabels[doc.type]}</h1>
            <p className="text-gray-500 mt-2 text-sm font-medium">{doc.number}</p>
            <div className="mt-3">
              <p className="text-gray-500 text-xs">Balance Due</p>
              <p className="text-2xl font-extrabold text-gray-900">{fmtCurr(doc.balance_due || doc.total)}</p>
            </div>
          </div>
        </div>

        {/* Company info */}
        <div className="mb-8">
          {doc.company_name && <p className="font-bold text-gray-900 text-base">{doc.company_name}</p>}
          {doc.company_address && <p className="text-gray-600 text-sm whitespace-pre-line">{doc.company_address}</p>}
          {doc.company_phone && <p className="text-gray-600 text-sm">{doc.company_phone}</p>}
          {doc.company_email && <p className="text-gray-600 text-sm">{doc.company_email}</p>}
          {doc.company_website && <p className="text-gray-600 text-sm">{doc.company_website}</p>}
        </div>

        {/* Bill To + Dates */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex-1">
            {doc.customer_name && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
                <p className="font-semibold text-gray-800 text-sm">{doc.customer_name}</p>
                {doc.customer_address && <p className="text-gray-500 text-xs whitespace-pre-line mt-0.5">{doc.customer_address}</p>}
                {doc.customer_email && <p className="text-gray-500 text-xs">{doc.customer_email}</p>}
              </div>
            )}
          </div>
          <div className="text-right space-y-1.5 text-sm min-w-[260px]">
            {doc.issue_date && (
              <div className="flex justify-between gap-8">
                <span className="text-gray-400">{doc.type === "invoice" ? "Invoice Date" : "Date"} :</span>
                <span className="text-gray-700">{format(new Date(doc.issue_date), "dd MMM yyyy")}</span>
              </div>
            )}
            {doc.terms_label && (
              <div className="flex justify-between gap-8">
                <span className="text-gray-400">Terms :</span>
                <span className="text-gray-700">{doc.terms_label}</span>
              </div>
            )}
            {doc.due_date && (
              <div className="flex justify-between gap-8">
                <span className="text-gray-400">Due Date :</span>
                <span className="text-gray-700">{format(new Date(doc.due_date), "dd MMM yyyy")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full mb-0 text-sm">
          <thead>
            <tr className="border-b border-t border-gray-200 text-gray-400 text-xs uppercase tracking-wider">
              <th className="py-2.5 text-left font-medium w-8">#</th>
              <th className="py-2.5 text-left font-medium">Description</th>
              <th className="py-2.5 text-right font-medium px-4">Qty</th>
              <th className="py-2.5 text-right font-medium px-4">Rate</th>
              <th className="py-2.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-3 text-gray-400">{i + 1}</td>
                <td className="py-3 text-gray-800">{item.description}</td>
                <td className="py-3 text-right px-4 text-gray-600">{(item.quantity || 0).toFixed(2)}</td>
                <td className="py-3 text-right px-4 text-gray-600">{fmtAmt(item.unit_price)}</td>
                <td className="py-3 text-right text-gray-800 font-medium">{fmtAmt(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-6 mb-8">
          <div className="w-72 text-sm space-y-2">
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Sub Total</span>
              <span className="text-gray-800">{fmtAmt(doc.subtotal)}</span>
            </div>
            {doc.tax_amount > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-500">VAT ({doc.tax_rate}%)</span>
                <span className="text-gray-800">{fmtAmt(doc.tax_amount)}</span>
              </div>
            )}
            {doc.shipping > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Shipping</span>
                <span className="text-gray-800">{fmtAmt(doc.shipping)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-t border-gray-200">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-gray-900">{fmtCurr(doc.total)}</span>
            </div>
            {doc.paid_amount > 0 && (
              <div className="flex justify-between py-1 text-emerald-600">
                <span>Payment Made</span>
                <span>(-) {fmtCurr(doc.paid_amount)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-t border-gray-300">
              <span className="font-bold text-gray-900">Balance Due</span>
              <span className="font-bold text-gray-900 text-base">{fmtCurr(doc.balance_due || doc.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes / Terms */}
        {(doc.notes || doc.terms || doc.payment_instructions) && (
          <div className="border-t border-gray-100 pt-6 mb-8 space-y-3 text-sm text-gray-600">
            {doc.notes && <p>{doc.notes}</p>}
            {doc.terms && <div><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{"Terms & Conditions"}</p><p>{doc.terms}</p></div>}
            {doc.payment_instructions && <div><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Payment Instructions</p><p>{doc.payment_instructions}</p></div>}
          </div>
        )}

        {/* Signatures */}
        <div className="border-t border-gray-200 pt-8 grid grid-cols-2 gap-10">
          {/* Manager signature (saved from editor) */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Authorized Signatory</p>
            {doc.manager_signature ? (
              <div>
                <img src={doc.manager_signature} alt="Manager Signature" className="h-16 object-contain mb-2" />
                <div className="border-t border-gray-300 pt-1">
                  <p className="text-xs text-gray-500">{doc.company_name || "Company"}</p>
                </div>
              </div>
            ) : (
              <div className="border-t border-gray-300 pt-1 mt-16">
                <p className="text-xs text-gray-500">{doc.company_name || "Company"}</p>
              </div>
            )}
          </div>
          {/* Customer signature pad */}
          <div>
            <SignaturePad label="Customer Signature" onSave={setClientSig} />
            <div className="border-t border-gray-300 pt-1 mt-2">
              <p className="text-xs text-gray-500">{doc.customer_name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WaybillTemplate({ doc, sym, curr, clientSig, setClientSig }) {
  const items = doc.items || [];
  const fmtAmt = (n) => `${(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`;
  const fmtCurr = (n) => `${curr}${fmtAmt(n)}`;

  return (
    <div className="bg-white border-2 border-gray-800 rounded-lg overflow-hidden" style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div className="bg-gray-900 text-white px-8 py-5 flex justify-between items-center">
        <div>
          {doc.logo_url && <img src={doc.logo_url} alt="Logo" className="h-12 w-auto object-contain mb-2" />}
          <h2 className="text-xl font-black">{doc.company_name || "Company"}</h2>
          {doc.company_phone && <p className="text-gray-400 text-sm">{doc.company_phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-4xl font-black tracking-widest">WAYBILL</p>
          <p className="text-gray-400 font-mono text-lg mt-1">{doc.number}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x-2 divide-gray-800 border-b-2 border-gray-800">
        <div className="px-6 py-5">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Sender</p>
          <p className="font-black text-base">{doc.company_name}</p>
          {doc.company_address && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{doc.company_address}</p>}
        </div>
        <div className="px-6 py-5">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Receiver</p>
          <p className="font-black text-base">{doc.customer_name}</p>
          {doc.customer_address && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{doc.customer_address}</p>}
          {doc.customer_email && <p className="text-sm text-gray-600">{doc.customer_email}</p>}
        </div>
      </div>

      <table className="w-full text-sm border-b-2 border-gray-800">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-800">
            <th className="px-5 py-3 text-left font-black text-xs uppercase">#</th>
            <th className="px-5 py-3 text-left font-black text-xs uppercase">Description of Goods</th>
            <th className="px-5 py-3 text-right font-black text-xs uppercase">Qty</th>
            <th className="px-5 py-3 text-right font-black text-xs uppercase">Rate</th>
            <th className="px-5 py-3 text-right font-black text-xs uppercase">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="px-5 py-3 text-gray-500">{i + 1}</td>
              <td className="px-5 py-3 font-medium">{item.description}</td>
              <td className="px-5 py-3 text-right">{(item.quantity || 0).toFixed(2)}</td>
              <td className="px-5 py-3 text-right">{fmtAmt(item.unit_price)}</td>
              <td className="px-5 py-3 text-right font-bold">{fmtAmt(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 divide-x-2 divide-gray-800 border-b-2 border-gray-800">
        <div className="px-6 py-5 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Sub Total</span><span>{fmtAmt(doc.subtotal)}</span></div>
          {doc.tax_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">VAT ({doc.tax_rate}%)</span><span>{fmtAmt(doc.tax_amount)}</span></div>}
          <div className="flex justify-between border-t-2 border-gray-800 pt-2 font-black">
            <span className="uppercase">Total</span>
            <span>{fmtCurr(doc.total)}</span>
          </div>
        </div>
        <div className="px-6 py-5 text-sm text-gray-600">
          {doc.notes && <p className="mb-2"><strong className="text-gray-800">Note:</strong> {doc.notes}</p>}
          {doc.issue_date && <p><strong className="text-gray-800">Date:</strong> {format(new Date(doc.issue_date), "dd MMM yyyy")}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x-2 divide-gray-800">
        <div className="px-6 py-5">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Dispatcher Signature</p>
          {doc.manager_signature ? (
            <img src={doc.manager_signature} alt="Manager Signature" className="h-16 object-contain mb-2" />
          ) : (
            <div className="h-16" />
          )}
          <div className="border-t border-gray-400 pt-1"><p className="text-xs text-gray-500">{doc.company_name} · Date: ___________</p></div>
        </div>
        <div className="px-6 py-5">
          <SignaturePad label="Receiver Signature" onSave={setClientSig} />
          <div className="border-t border-gray-400 pt-1 mt-2"><p className="text-xs text-gray-500">{doc.customer_name} · Date: ___________</p></div>
        </div>
      </div>
    </div>
  );
}