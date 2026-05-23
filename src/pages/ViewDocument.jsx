import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Printer, Send, Pencil, Share2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SignaturePad from "../components/SignaturePad";
import LetterheadTemplate from "../components/LetterheadTemplate";

const TYPE_LABELS = {
  invoice: "INVOICE", quotation: "QUOTATION", receipt: "RECEIPT",
  waybill: "WAYBILL", delivery_note: "DELIVERY NOTE",
  purchase_order: "PURCHASE ORDER", credit_note: "CREDIT NOTE",
  letterhead: "LETTER",
};

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-500", sent: "bg-blue-50 text-blue-600",
  paid: "bg-emerald-50 text-emerald-600", overdue: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-500", accepted: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-600",
};

const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", EUR: "€", GBP: "£" };

const AMOUNT_LABEL = {
  receipt: "Amount Paid", credit_note: "Amount Credited",
  quotation: "Quoted Amount", purchase_order: "Order Total",
};

const CUSTOMER_LABEL = {
  purchase_order: "Vendor", waybill: "Ship To",
  delivery_note: "Ship To", letterhead: "Addressed To",
};

export default function ViewDocument() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const pdfRef = useRef(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Document.get(docId),
      base44.auth.me(),
    ]).then(([d, user]) => {
      if (user) {
        d = {
          ...d,
          logo_url: user.logo_url || d.logo_url || "",
          company_name: user.company_name || d.company_name || "",
          company_email: user.company_email || user.email || d.company_email || "",
          company_phone: user.company_phone || d.company_phone || "",
          company_address: user.company_address || d.company_address || "",
          company_website: user.company_website || d.company_website || "",
        };
      }
      setDoc(d);
      setLoading(false);
    });
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

  const saveNotes = async (notes) => {
    await base44.entities.Document.update(docId, { notes });
    setDoc(prev => ({ ...prev, notes }));
  };

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const element = pdfRef.current;
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width / 2, canvas.height / 2] });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
    pdf.save(`${doc.number || "document"}.pdf`);
    setGeneratingPdf(false);
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 print:hidden">
        <div className="flex items-center gap-3">
          <Link to="/documents" className="p-2 hover:bg-muted rounded-lg"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-xl font-bold">{doc.number}</h1>
            <p className="text-xs text-muted-foreground">{TYPE_LABELS[doc.type]}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[doc.status]}`}>{doc.status}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={doc.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["draft","sent","paid","overdue","cancelled","accepted","rejected"].map(s => (
                <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => navigate(`/documents/new?edit=${docId}`)}><Pencil className="h-4 w-4" /><span className="hidden sm:inline">Edit</span></Button>
          {doc.type === 'waybill' && (
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/waybill-sign?id=${docId}`); toast.success('Signature link copied!'); }}>
              <Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share for Signature</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowPdfPreview(true)}><FileDown className="h-4 w-4" /><span className="hidden sm:inline">Download PDF</span></Button>
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
          <Button size="sm" onClick={() => updateStatus("sent")}><Send className="h-3 w-3 mr-1.5" />Mark as Sent</Button>
        </div>
      )}

      {doc.type === "letterhead"
        ? <LetterheadTemplate doc={doc} onSaveManagerSig={saveManagerSig} onSaveCustomerSig={saveCustomerSig} onSaveNotes={saveNotes} />
        : <UnifiedTemplate doc={doc} onSaveManagerSig={saveManagerSig} onSaveCustomerSig={saveCustomerSig} />
      }

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" onClick={() => setShowPdfPreview(false)}>
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b shrink-0" onClick={e => e.stopPropagation()}>
            <div>
              <p className="font-semibold text-sm">Document Preview</p>
              <p className="text-xs text-muted-foreground">{doc.number}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleDownloadPdf} disabled={generatingPdf}>
                <FileDown className="h-4 w-4 mr-1" />
                {generatingPdf ? "Generating..." : "Download PDF"}
              </Button>
              <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground" onClick={() => setShowPdfPreview(false)}>✕</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-gray-100 p-6" onClick={e => e.stopPropagation()}>
            <div className="max-w-4xl mx-auto">
              <div ref={pdfRef}>
                <UnifiedTemplate doc={doc} onSaveManagerSig={saveManagerSig} onSaveCustomerSig={saveCustomerSig} isPdf={true} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UnifiedTemplate({ doc, onSaveManagerSig, onSaveCustomerSig, isPdf = false }) {
  const items = doc.items || [];
  const curr = doc.currency || "NGN";
  const fmtAmt = (n) => `${(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`;
  const fmtCurr = (n) => `${curr} ${fmtAmt(n)}`;
  const isLetter = doc.type === "letterhead";
  const customerLabel = CUSTOMER_LABEL[doc.type] || "Sold To";
  const amountLabel = AMOUNT_LABEL[doc.type] || "Balance Due";

  return (
    <div className="bg-white border border-gray-300 shadow-sm rounded-lg overflow-hidden print:shadow-none print:border-0"
      style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>

      {/* Header */}
      <div className="px-12 pt-10 pb-6 border-b border-gray-200">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {doc.logo_url
              ? <img src={doc.logo_url} alt="Logo" className="h-48 w-auto object-contain mb-4" style={{ maxWidth: 400 }} />
              : <div className="h-8" />
            }
            {doc.company_name && <p className="font-black text-gray-900 text-2xl whitespace-nowrap">{doc.company_name}</p>}
            <div className="mt-2 space-y-0.5">
              {doc.company_address && <p className="text-gray-500 text-xs whitespace-pre-line">{doc.company_address}</p>}
              {doc.company_phone && <p className="text-gray-500 text-xs">{doc.company_phone}</p>}
              {doc.company_email && <p className="text-gray-500 text-xs">{doc.company_email}</p>}
              {doc.company_website && <p className="text-gray-500 text-xs">{doc.company_website}</p>}
            </div>
          </div>

          <div className="text-right ml-8 flex flex-col items-end gap-2">
            <h1 className="text-4xl font-black tracking-widest text-gray-800">{TYPE_LABELS[doc.type]}</h1>
            <p className="text-gray-400 text-sm font-mono">{doc.number}</p>
            {!isLetter && (
              <div className="mt-2 border border-gray-300 rounded-lg px-5 py-3 bg-gray-50 min-w-[180px] text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{amountLabel}</p>
                <p className="text-2xl font-black text-gray-900 mt-0.5">{fmtCurr(doc.balance_due || doc.total)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sold To / Dates strip */}
      <div className="px-12 py-5 grid grid-cols-2 gap-8 bg-gray-50 border-b border-gray-200">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{customerLabel}</p>
          <p className="font-semibold text-gray-800 text-sm">{doc.customer_name || "—"}</p>
          {doc.customer_address && <p className="text-gray-500 text-xs whitespace-pre-line mt-0.5">{doc.customer_address}</p>}
          {doc.customer_email && <p className="text-gray-500 text-xs mt-0.5">{doc.customer_email}</p>}
        </div>
        <div className="text-right">
          {doc.issue_date && (
            <div className="mb-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Date</p>
              <p className="font-semibold text-gray-700 text-sm">{format(new Date(doc.issue_date), "dd MMM yyyy")}</p>
            </div>
          )}
          {doc.due_date && (
            <div className="mb-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                {doc.type === "purchase_order" ? "Required By" : doc.type === "quotation" ? "Valid Until" : "Due Date"}
              </p>
              <p className="font-semibold text-gray-700 text-sm">{format(new Date(doc.due_date), "dd MMM yyyy")}</p>
            </div>
          )}
          {doc.terms_label && !isLetter && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Terms</p>
              <p className="text-gray-700 text-sm">{doc.terms_label}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="px-12 py-8">
        {isLetter ? (
          <div>
            {doc.terms_label && doc.terms_label !== "Due on Receipt" && (
              <p className="font-bold text-gray-900 text-sm mb-6 underline">Re: {doc.terms_label}</p>
            )}
            <div
              className="text-gray-700 text-sm min-h-56 prose prose-sm max-w-none"
              style={{ lineHeight: 1.9 }}
              dangerouslySetInnerHTML={{ __html: doc.notes || "<p>No content</p>" }}
            />
            {doc.terms && <p className="mt-8 text-sm text-gray-600">{doc.terms}</p>}
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-800 text-xs uppercase tracking-wider text-gray-500">
                  <th className="pb-3 text-left w-8 font-semibold">S/N</th>
                  <th className="pb-3 text-left font-semibold">Description</th>
                  <th className="pb-3 text-right px-4 font-semibold">Qty</th>
                  {doc.type !== 'waybill' && <th className="pb-3 text-right px-4 font-semibold">Unit Price</th>}
                  {doc.type !== 'waybill' && <th className="pb-3 text-right font-semibold">Amount</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 text-gray-400">{i + 1}</td>
                    <td className="py-3 text-gray-800">{item.description}</td>
                    <td className="py-3 text-right px-4 text-gray-500">{(item.quantity || 0).toFixed(2)}</td>
                    {doc.type !== 'waybill' && <td className="py-3 text-right px-4 text-gray-500">{fmtAmt(item.unit_price)}</td>}
                    {doc.type !== 'waybill' && <td className="py-3 text-right font-semibold text-gray-800">{fmtAmt(item.amount)}</td>}
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-300 text-xs">No items</td></tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mt-6 mb-8">
              <div className="w-72 text-sm space-y-1.5">
                <div className="flex justify-between py-1"><span className="text-gray-400">Subtotal</span><span className="text-gray-700">{fmtAmt(doc.subtotal)}</span></div>
                {doc.tax_amount > 0 && (
                  <div className="flex justify-between py-1"><span className="text-gray-400">VAT ({doc.tax_rate}%)</span><span className="text-gray-700">{fmtAmt(doc.tax_amount)}</span></div>
                )}
                {doc.shipping > 0 && (
                  <div className="flex justify-between py-1"><span className="text-gray-400">Shipping</span><span className="text-gray-700">{fmtAmt(doc.shipping)}</span></div>
                )}
                {doc.paid_amount > 0 && (
                  <div className="flex justify-between py-1 text-emerald-600"><span>Payment Made</span><span>(-) {fmtCurr(doc.paid_amount)}</span></div>
                )}
                <div className="flex justify-between py-3 border-t-2 border-gray-800">
                  <span className="font-black text-gray-900 uppercase text-sm">{amountLabel}</span>
                  <span className="font-black text-gray-900 text-lg">{fmtCurr(doc.balance_due || doc.total)}</span>
                </div>
              </div>
            </div>

            {(doc.notes || doc.terms || doc.payment_instructions) && (
              <div className="border-t border-gray-200 pt-6 mb-8 space-y-4 text-sm text-gray-600">
                {doc.notes && <p>{doc.notes}</p>}
                {doc.terms && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Terms &amp; Conditions</p>
                    <p>{doc.terms}</p>
                  </div>
                )}
                {doc.payment_instructions && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Payment Instructions</p>
                    <p>{doc.payment_instructions}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Signatures */}
        <div className={`border-t border-gray-200 pt-8 mt-6 grid gap-12 ${doc.type === 'waybill' ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Manager's Signature</p>
            {isPdf ? (
              <div>
                {doc.manager_signature
                  ? <img src={doc.manager_signature} alt="Manager Signature" className="h-16 object-contain mb-2" />
                  : <div style={{ height: 64, borderBottom: "1px solid #9ca3af", marginBottom: 4 }} />
                }
                <p className="text-xs text-gray-500 mt-1">{doc.company_name || "Company"}</p>
              </div>
            ) : doc.manager_signature ? (
              <div>
                <img src={doc.manager_signature} alt="Manager Signature" className="h-16 object-contain mb-2" />
                <div className="border-t border-gray-400 pt-1.5">
                  <p className="text-xs text-gray-500">{doc.company_name || "Company"}</p>
                </div>
                <button className="text-xs text-primary mt-1.5 hover:underline print:hidden" onClick={() => onSaveManagerSig("")}>Re-sign</button>
              </div>
            ) : (
              <div>
                <div className="print:hidden">
                  <SignaturePad label="" onSave={onSaveManagerSig} />
                </div>
                <div className="hidden print:block h-16 border-b border-gray-400 mb-1" />
                <p className="text-xs text-gray-500 mt-1">{doc.company_name || "Company"}</p>
              </div>
            )}
          </div>

          {doc.type === 'waybill' && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Receiver Signature</p>
              {isPdf ? (
                <div>
                  {doc.customer_signature
                    ? <img src={doc.customer_signature} alt="Customer Signature" className="h-16 object-contain mb-2" />
                    : <div style={{ height: 64, borderBottom: "1px solid #9ca3af", marginBottom: 4 }} />
                  }
                  <p className="text-xs text-gray-500 mt-1">{doc.customer_name}</p>
                </div>
              ) : doc.customer_signature ? (
                <div>
                  <img src={doc.customer_signature} alt="Customer Signature" className="h-16 object-contain mb-2" />
                  <div className="border-t border-gray-400 pt-1.5">
                    <p className="text-xs text-gray-500">{doc.customer_name}</p>
                  </div>
                  <button className="text-xs text-primary mt-1.5 hover:underline print:hidden" onClick={() => onSaveCustomerSig("")}>Re-sign</button>
                </div>
              ) : (
                <div>
                  <div className="print:hidden">
                    <SignaturePad label="" onSave={onSaveCustomerSig} />
                  </div>
                  <div className="hidden print:block h-16 border-b border-gray-400 mb-1" />
                  <p className="text-xs text-gray-500 mt-1">{doc.customer_name}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-12 py-4 bg-gray-50 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          {[doc.company_name, doc.company_phone, doc.company_email, doc.company_website].filter(Boolean).join("  ·  ")}
        </p>
      </div>
    </div>
  );
}