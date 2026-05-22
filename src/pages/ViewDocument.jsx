import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Printer } from "lucide-react";
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
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-600",
  paid: "bg-emerald-50 text-emerald-600",
  overdue: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
  accepted: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-600",
};

const CURRENCIES = { USD: "$", EUR: "€", GBP: "£", NGN: "₦" };

export default function ViewDocument() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [managerSig, setManagerSig] = useState(null);
  const [clientSig, setClientSig] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Document.get(docId),
      base44.auth.me().catch(() => null),
    ]).then(([d, u]) => { setDoc(d); setUser(u); setLoading(false); });
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

  const items = doc.items || [];
  const sym = CURRENCIES[doc.currency] || doc.currency || "$";
  const isWaybill = doc.type === "waybill" || doc.type === "delivery_note";
  const companyName = user?.company_name || user?.full_name || "Your Company";
  const companyEmail = user?.company_email || user?.email || "";
  const companyPhone = user?.company_phone || "";
  const companyAddress = user?.company_address || "";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <Link to="/documents" className="p-2 hover:bg-muted rounded-lg"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-bold">{doc.number}</h1>
            <p className="text-sm text-muted-foreground">{typeLabels[doc.type]}</p>
          </div>
          <span className={`ml-2 px-3 py-1 rounded-full text-xs font-medium ${statusColors[doc.status]}`}>{doc.status}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={doc.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["draft", "sent", "paid", "overdue", "cancelled", "accepted", "rejected"].map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {isWaybill ? (
        <WaybillTemplate doc={doc} user={user} sym={sym} companyName={companyName} companyEmail={companyEmail} companyPhone={companyPhone} companyAddress={companyAddress} managerSig={managerSig} setManagerSig={setManagerSig} clientSig={clientSig} setClientSig={setClientSig} />
      ) : (
        <StandardTemplate doc={doc} user={user} sym={sym} items={items} companyName={companyName} companyEmail={companyEmail} companyPhone={companyPhone} companyAddress={companyAddress} managerSig={managerSig} setManagerSig={setManagerSig} clientSig={clientSig} setClientSig={setClientSig} />
      )}
    </div>
  );
}

function StandardTemplate({ doc, user, sym, items, companyName, companyEmail, companyPhone, companyAddress, managerSig, setManagerSig, clientSig, setClientSig }) {
  const typeColor = {
    invoice: "from-indigo-600 to-indigo-800",
    quotation: "from-violet-600 to-violet-800",
    receipt: "from-emerald-600 to-emerald-800",
    purchase_order: "from-sky-600 to-sky-800",
    credit_note: "from-rose-600 to-rose-800",
  }[doc.type] || "from-indigo-600 to-indigo-800";

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden print:shadow-none print:border-none">
      {/* Letterhead / Header */}
      <div className={`bg-gradient-to-r ${typeColor} px-8 py-7`}>
        <div className="flex justify-between items-start">
          <div className="text-white">
            <h2 className="text-2xl font-extrabold tracking-tight">{companyName}</h2>
            {companyEmail && <p className="text-indigo-200 text-sm mt-1">{companyEmail}</p>}
            {companyPhone && <p className="text-indigo-200 text-sm">{companyPhone}</p>}
            {companyAddress && <p className="text-indigo-200 text-sm whitespace-pre-line">{companyAddress}</p>}
          </div>
          <div className="text-right text-white">
            <p className="text-3xl font-black tracking-widest opacity-90">{typeLabels[doc.type]}</p>
            <p className="text-indigo-200 text-lg font-semibold mt-1">{doc.number}</p>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold uppercase ${doc.status === "paid" ? "bg-emerald-400/30 text-emerald-100" : "bg-white/20 text-white"}`}>
              {doc.status}
            </span>
          </div>
        </div>
      </div>

      {/* Meta Row */}
      <div className="bg-gray-50 border-b border-border px-8 py-3 flex flex-wrap gap-6 text-sm">
        {doc.issue_date && <div><span className="text-muted-foreground">Issue Date: </span><span className="font-medium">{format(new Date(doc.issue_date), "dd MMM yyyy")}</span></div>}
        {doc.due_date && <div><span className="text-muted-foreground">Due Date: </span><span className="font-semibold text-rose-600">{format(new Date(doc.due_date), "dd MMM yyyy")}</span></div>}
        <div><span className="text-muted-foreground">Currency: </span><span className="font-medium">{doc.currency || "USD"}</span></div>
      </div>

      <div className="px-8 py-6">
        {/* Bill To */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-50 rounded-xl p-5 border border-border">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Bill To</p>
            <p className="font-bold text-foreground text-base">{doc.customer_name}</p>
            {doc.customer_email && <p className="text-sm text-muted-foreground mt-1">{doc.customer_email}</p>}
            {doc.customer_address && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{doc.customer_address}</p>}
          </div>
          <div />
        </div>

        {/* Items Table */}
        <div className="rounded-xl overflow-hidden border border-border mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="px-5 py-3 text-left font-semibold">#</th>
                <th className="px-5 py-3 text-left font-semibold">Description</th>
                <th className="px-5 py-3 text-right font-semibold">Qty</th>
                <th className="px-5 py-3 text-right font-semibold">Unit Price</th>
                <th className="px-5 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/70"}>
                  <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-5 py-3 font-medium">{item.description}</td>
                  <td className="px-5 py-3 text-right">{item.quantity}</td>
                  <td className="px-5 py-3 text-right">{sym}{(item.unit_price || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3 text-right font-semibold">{sym}{(item.amount || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Subtotal</span><span>{sym}{(doc.subtotal || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</span></div>
            {doc.discount_total > 0 && <div className="flex justify-between py-1 text-rose-600"><span>Discount</span><span>-{sym}{(doc.discount_total || 0).toLocaleString()}</span></div>}
            {doc.tax_amount > 0 && <div className="flex justify-between py-1"><span className="text-muted-foreground">Tax ({doc.tax_rate}%)</span><span>{sym}{(doc.tax_amount || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</span></div>}
            {doc.shipping > 0 && <div className="flex justify-between py-1"><span className="text-muted-foreground">Shipping</span><span>{sym}{(doc.shipping || 0).toLocaleString()}</span></div>}
            <div className="flex justify-between border-t-2 border-primary pt-3 mt-2">
              <span className="font-bold text-base">Total</span>
              <span className="font-black text-xl text-primary">{sym}{(doc.total || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</span>
            </div>
            {doc.paid_amount > 0 && <div className="flex justify-between text-emerald-600 font-medium"><span>Paid</span><span>-{sym}{(doc.paid_amount || 0).toLocaleString()}</span></div>}
            {(doc.balance_due || 0) > 0 && (
              <div className="flex justify-between bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-1">
                <span className="font-bold text-rose-700">Balance Due</span>
                <span className="font-bold text-rose-700">{sym}{(doc.balance_due || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes / Terms */}
        {(doc.notes || doc.terms || doc.payment_instructions) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-sm">
            {doc.notes && <div className="bg-amber-50 rounded-xl p-4 border border-amber-100"><p className="font-bold text-xs text-amber-700 uppercase tracking-wider mb-1">Notes</p><p className="text-muted-foreground">{doc.notes}</p></div>}
            {doc.terms && <div className="bg-blue-50 rounded-xl p-4 border border-blue-100"><p className="font-bold text-xs text-blue-700 uppercase tracking-wider mb-1">{"Terms & Conditions"}</p><p className="text-muted-foreground">{doc.terms}</p></div>}
            {doc.payment_instructions && <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100"><p className="font-bold text-xs text-emerald-700 uppercase tracking-wider mb-1">Payment</p><p className="text-muted-foreground">{doc.payment_instructions}</p></div>}
          </div>
        )}

        {/* Signatures */}
        <div className="border-t border-border pt-6">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Authorizations</p>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">
              <SignaturePad label="Manager / Authorized Signatory" onSave={setManagerSig} />
              <p className="text-xs text-muted-foreground">{companyName}</p>
            </div>
            <div className="space-y-1">
              <SignaturePad label="Client / Acceptance" onSave={setClientSig} />
              <p className="text-xs text-muted-foreground">{doc.customer_name}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          <p>Thank you for your business · {companyName}{companyEmail ? ` · ${companyEmail}` : ""}</p>
        </div>
      </div>
    </div>
  );
}

function WaybillTemplate({ doc, user, sym, companyName, companyEmail, companyPhone, companyAddress, managerSig, setManagerSig, clientSig, setClientSig }) {
  const items = doc.items || [];
  return (
    <div className="bg-white rounded-xl border-2 border-gray-800 shadow-sm overflow-hidden print:shadow-none">
      {/* Waybill Header */}
      <div className="bg-gray-900 text-white px-8 py-5 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black tracking-tight">{companyName}</h2>
          {companyPhone && <p className="text-gray-400 text-sm">{companyPhone}</p>}
          {companyEmail && <p className="text-gray-400 text-sm">{companyEmail}</p>}
        </div>
        <div className="text-right">
          <p className="text-4xl font-black tracking-widest text-gray-100">{typeLabels[doc.type]}</p>
          <p className="text-gray-400 text-lg font-mono font-bold mt-1">{doc.number}</p>
        </div>
      </div>

      {/* Waybill Meta Strip */}
      <div className="border-b-2 border-gray-800 grid grid-cols-3 text-sm divide-x-2 divide-gray-800">
        <div className="px-5 py-3"><p className="text-xs font-bold text-gray-500 uppercase">Date</p><p className="font-semibold">{doc.issue_date ? format(new Date(doc.issue_date), "dd MMM yyyy") : "-"}</p></div>
        <div className="px-5 py-3"><p className="text-xs font-bold text-gray-500 uppercase">Waybill No.</p><p className="font-semibold font-mono">{doc.number}</p></div>
        <div className="px-5 py-3"><p className="text-xs font-bold text-gray-500 uppercase">Status</p><p className="font-semibold capitalize">{doc.status}</p></div>
      </div>

      {/* Sender / Receiver */}
      <div className="grid grid-cols-2 divide-x-2 divide-gray-800 border-b-2 border-gray-800">
        <div className="px-6 py-5">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Sender / Consignor</p>
          <p className="font-black text-lg">{companyName}</p>
          {companyAddress && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{companyAddress}</p>}
          {companyPhone && <p className="text-sm text-gray-600">Tel: {companyPhone}</p>}
        </div>
        <div className="px-6 py-5">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Receiver / Consignee</p>
          <p className="font-black text-lg">{doc.customer_name}</p>
          {doc.customer_address && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{doc.customer_address}</p>}
          {doc.customer_email && <p className="text-sm text-gray-600">{doc.customer_email}</p>}
        </div>
      </div>

      {/* Items / Packages */}
      <div className="border-b-2 border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-800">
              <th className="px-5 py-3 text-left font-black text-xs uppercase">#</th>
              <th className="px-5 py-3 text-left font-black text-xs uppercase">Description of Goods</th>
              <th className="px-5 py-3 text-right font-black text-xs uppercase">Qty</th>
              <th className="px-5 py-3 text-right font-black text-xs uppercase">Unit Price</th>
              <th className="px-5 py-3 text-right font-black text-xs uppercase">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="px-5 py-3 text-gray-500">{i + 1}</td>
                <td className="px-5 py-3 font-medium">{item.description}</td>
                <td className="px-5 py-3 text-right">{item.quantity}</td>
                <td className="px-5 py-3 text-right">{sym}{(item.unit_price || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</td>
                <td className="px-5 py-3 text-right font-bold">{sym}{(item.amount || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals + Signatures side by side */}
      <div className="grid grid-cols-2 divide-x-2 divide-gray-800 border-b-2 border-gray-800">
        <div className="px-6 py-5 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">{sym}{(doc.subtotal || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</span></div>
          {doc.tax_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax ({doc.tax_rate}%)</span><span>{sym}{(doc.tax_amount || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</span></div>}
          {doc.shipping > 0 && <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>{sym}{(doc.shipping || 0).toLocaleString()}</span></div>}
          <div className="flex justify-between border-t-2 border-gray-800 pt-2 mt-1">
            <span className="font-black text-base uppercase">Total</span>
            <span className="font-black text-xl">{sym}{(doc.total || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div className="px-6 py-5">
          {doc.notes && <div className="mb-3"><p className="text-xs font-bold text-gray-500 uppercase mb-1">Special Instructions</p><p className="text-sm text-gray-700">{doc.notes}</p></div>}
          {doc.terms && <div><p className="text-xs font-bold text-gray-500 uppercase mb-1">{"Terms & Conditions"}</p><p className="text-sm text-gray-700">{doc.terms}</p></div>}
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 divide-x-2 divide-gray-800">
        <div className="px-6 py-5">
          <SignaturePad label="Dispatcher / Manager Signature" onSave={setManagerSig} />
          <p className="text-xs text-gray-500 mt-2">{companyName} · Date: ____________</p>
        </div>
        <div className="px-6 py-5">
          <SignaturePad label="Receiver Signature" onSave={setClientSig} />
          <p className="text-xs text-gray-500 mt-2">{doc.customer_name} · Date: ____________</p>
        </div>
      </div>

      <div className="bg-gray-900 text-gray-400 text-center text-xs px-8 py-3">
        {companyName}{companyEmail ? ` · ${companyEmail}` : ""}{companyPhone ? ` · ${companyPhone}` : ""}
      </div>
    </div>
  );
}