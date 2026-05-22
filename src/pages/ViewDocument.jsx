import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const typeLabels = {
  invoice: "Invoice", quotation: "Quotation", receipt: "Receipt",
  waybill: "Waybill", delivery_note: "Delivery Note",
  purchase_order: "Purchase Order", credit_note: "Credit Note",
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

export default function ViewDocument() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
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
          <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-8 shadow-sm">
        <div className="flex justify-between mb-8 pb-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground">{(typeLabels[doc.type] || "").toUpperCase()}</h2>
            <p className="text-sm text-muted-foreground mt-1">{doc.number}</p>
          </div>
          <div className="text-right text-sm">
            {user?.full_name && <p className="font-semibold">{user.full_name}</p>}
            {user?.email && <p className="text-muted-foreground">{user.email}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Bill To</p>
            <p className="font-semibold">{doc.customer_name}</p>
            {doc.customer_email && <p className="text-sm text-muted-foreground">{doc.customer_email}</p>}
            {doc.customer_address && <p className="text-sm text-muted-foreground whitespace-pre-line">{doc.customer_address}</p>}
          </div>
          <div className="text-right space-y-1">
            {doc.issue_date && <p className="text-sm"><span className="text-muted-foreground">Issue Date:</span> {format(new Date(doc.issue_date), "MMM d, yyyy")}</p>}
            {doc.due_date && <p className="text-sm"><span className="text-muted-foreground">Due Date:</span> {format(new Date(doc.due_date), "MMM d, yyyy")}</p>}
            <p className="text-sm"><span className="text-muted-foreground">Currency:</span> {doc.currency || "USD"}</p>
          </div>
        </div>

        <table className="w-full mb-6">
          <thead>
            <tr className="border-b-2 border-foreground/10 text-left">
              <th className="py-2 text-xs font-medium text-muted-foreground uppercase">Description</th>
              <th className="py-2 text-xs font-medium text-muted-foreground uppercase text-right">Qty</th>
              <th className="py-2 text-xs font-medium text-muted-foreground uppercase text-right">Price</th>
              <th className="py-2 text-xs font-medium text-muted-foreground uppercase text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-border">
                <td className="py-3 text-sm">{item.description}</td>
                <td className="py-3 text-sm text-right">{item.quantity}</td>
                <td className="py-3 text-sm text-right">${(item.unit_price || 0).toFixed(2)}</td>
                <td className="py-3 text-sm text-right font-medium">${(item.amount || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${(doc.subtotal || 0).toFixed(2)}</span></div>
            {doc.tax_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax ({doc.tax_rate}%)</span><span>${(doc.tax_amount || 0).toFixed(2)}</span></div>}
            {doc.shipping > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>${(doc.shipping || 0).toFixed(2)}</span></div>}
            <div className="flex justify-between border-t border-border pt-2 font-bold text-base">
              <span>Total</span><span className="text-primary">${(doc.total || 0).toFixed(2)}</span>
            </div>
            {doc.paid_amount > 0 && <div className="flex justify-between text-emerald-600"><span>Paid</span><span>-${(doc.paid_amount || 0).toFixed(2)}</span></div>}
            {(doc.balance_due || 0) > 0 && <div className="flex justify-between font-semibold"><span>Balance Due</span><span>${(doc.balance_due || 0).toFixed(2)}</span></div>}
          </div>
        </div>

        {(doc.notes || doc.terms || doc.payment_instructions) && (
          <div className="mt-8 pt-6 border-t border-border space-y-3 text-sm">
            {doc.notes && <div><p className="font-medium text-xs text-muted-foreground uppercase mb-1">Notes</p><p className="text-muted-foreground">{doc.notes}</p></div>}
            {doc.terms && <div><p className="font-medium text-xs text-muted-foreground uppercase mb-1">{"Terms & Conditions"}</p><p className="text-muted-foreground">{doc.terms}</p></div>}
            {doc.payment_instructions && <div><p className="font-medium text-xs text-muted-foreground uppercase mb-1">Payment Instructions</p><p className="text-muted-foreground">{doc.payment_instructions}</p></div>}
          </div>
        )}
      </div>
    </div>
  );
}