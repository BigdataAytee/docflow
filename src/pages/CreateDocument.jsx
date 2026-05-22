import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const typeLabels = {
  invoice: "Invoice", quotation: "Quotation", receipt: "Receipt",
  waybill: "Waybill", delivery_note: "Delivery Note",
  purchase_order: "Purchase Order", credit_note: "Credit Note",
};

export default function CreateDocument() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const docType = params.get("type") || "invoice";

  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: docType,
    number: "",
    customer_id: "",
    customer_name: "",
    customer_email: "",
    customer_address: "",
    currency: "USD",
    tax_rate: 0,
    shipping: 0,
    notes: "",
    terms: "",
    payment_instructions: "",
    due_date: "",
    issue_date: new Date().toISOString().split("T")[0],
  });
  const [items, setItems] = useState([{ description: "", quantity: 1, unit_price: 0, discount: 0 }]);

  useEffect(() => {
    base44.entities.Customer.list("-created_date", 100).then(setCustomers);
    base44.entities.Document.list("-created_date", 1).then(docs => {
      const prefix = docType === "invoice" ? "INV" : docType === "quotation" ? "QUO" : docType === "receipt" ? "REC" : docType === "purchase_order" ? "PO" : docType === "credit_note" ? "CN" : "DOC";
      const num = docs.length > 0 ? parseInt((docs[0].number || "0").replace(/\D/g, "") || "0") + 1 : 1;
      setForm(f => ({ ...f, number: `${prefix}-${String(num).padStart(4, "0")}` }));
    });
  }, [docType]);

  const selectCustomer = (id) => {
    const c = customers.find(x => x.id === id);
    if (c) {
      setForm(f => ({ ...f, customer_id: id, customer_name: c.full_name, customer_email: c.email || "", customer_address: c.billing_address || "", currency: c.currency || "USD" }));
    }
  };

  const updateItem = (i, key, val) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item));
  };

  const calcs = useMemo(() => {
    const lineItems = items.map(it => {
      const amt = (it.quantity || 0) * (it.unit_price || 0);
      const disc = amt * ((it.discount || 0) / 100);
      return { ...it, amount: amt - disc };
    });
    const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
    const taxAmt = subtotal * ((form.tax_rate || 0) / 100);
    const total = subtotal + taxAmt + (form.shipping || 0);
    return { lineItems, subtotal, taxAmt, total };
  }, [items, form.tax_rate, form.shipping]);

  const handleSave = async (status = "draft") => {
    setSaving(true);
    const doc = {
      ...form,
      status,
      items: calcs.lineItems,
      subtotal: calcs.subtotal,
      tax_amount: calcs.taxAmt,
      total: calcs.total,
      balance_due: calcs.total,
      paid_amount: 0,
      issue_date: form.issue_date ? new Date(form.issue_date).toISOString() : new Date().toISOString(),
      due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
    };
    const created = await base44.entities.Document.create(doc);
    navigate(`/documents/${created.id}`);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/documents" className="p-2 hover:bg-muted rounded-lg"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold">New {typeLabels[docType]}</h1>
          <p className="text-sm text-muted-foreground">Fill in the details below</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Document Number</Label>
                <Input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} />
              </div>
              <div>
                <Label>Customer</Label>
                <Select value={form.customer_id} onValueChange={selectCustomer}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}{c.company_name ? ` — ${c.company_name}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Issue Date</Label>
                <Input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">Line Items</h3>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {i === 0 && <Label className="text-xs">Description</Label>}
                    <Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder="Item description" />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <Label className="text-xs">Qty</Label>}
                    <Input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", +e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <Label className="text-xs">Price</Label>}
                    <Input type="number" value={item.unit_price} onChange={e => updateItem(i, "unit_price", +e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <Label className="text-xs">Disc %</Label>}
                    <Input type="number" value={item.discount} onChange={e => updateItem(i, "discount", +e.target.value)} />
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setItems(p => [...p, { description: "", quantity: 1, unit_price: 0, discount: 0 }])}>
              <Plus className="h-3 w-3 mr-1" /> Add Item
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any notes for the customer..." /></div>
            <div><Label>{"Terms & Conditions"}</Label><Textarea value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} rows={2} /></div>
            <div><Label>Payment Instructions</Label><Textarea value={form.payment_instructions} onChange={e => setForm(f => ({ ...f, payment_instructions: e.target.value }))} rows={2} /></div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 sticky top-8">
            <h3 className="font-semibold mb-4">Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">${calcs.subtotal.toFixed(2)}</span></div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Tax</span>
                <div className="flex items-center gap-1">
                  <Input type="number" className="w-16 h-8 text-xs" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: +e.target.value }))} />
                  <span className="text-xs text-muted-foreground">%</span>
                  <span className="font-medium ml-2">${calcs.taxAmt.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Shipping</span>
                <Input type="number" className="w-24 h-8 text-xs text-right" value={form.shipping} onChange={e => setForm(f => ({ ...f, shipping: +e.target.value }))} />
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">${calcs.total.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <Button className="w-full" onClick={() => handleSave("draft")} disabled={saving || !form.customer_name}>
                {saving ? "Saving..." : "Save as Draft"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleSave("sent")} disabled={saving || !form.customer_name}>
                {"Save & Send"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}