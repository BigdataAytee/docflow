import { useState, useEffect, useMemo, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { base44 } from "@/api/base44Client";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Trash2, ArrowLeft, Settings2, FileDown, Upload } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CustomerForm from "../components/CustomerForm";
import SignaturePad from "../components/SignaturePad";
import DocumentPreview from "../components/DocumentPreview";

const typeLabels = {
  invoice: "Invoice", quotation: "Quotation", receipt: "Receipt", waybill: "Waybill",
};

const CURRENCIES = [
  { value: "NGN", label: "₦ NGN — Nigerian Naira" },
  { value: "USD", label: "$ USD — US Dollar" },
  { value: "EUR", label: "€ EUR — Euro" },
  { value: "GBP", label: "£ GBP — British Pound" },
];

export default function CreateDocument() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("edit") || null;
  const docType = params.get("type") || "invoice";
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [managerSig, setManagerSig] = useState(null);
  const [customerSig, setCustomerSig] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [numPrefix, setNumPrefix] = useState("");
  const [numSeq, setNumSeq] = useState("");
  const [numOpen, setNumOpen] = useState(false);

  const [form, setForm] = useState({
    type: docType,
    number: "",
    customer_id: "",
    customer_name: "",
    customer_email: "",
    customer_address: "",
    currency: "NGN",
    tax_rate: 7.5,
    shipping: 0,
    notes: "",
    terms: "",
    terms_label: "Due on Receipt",
    payment_instructions: "",
    due_date: "",
    issue_date: new Date().toISOString().split("T")[0],
    logo_url: "",
    company_name: "",
    company_email: "",
    company_phone: "",
    company_address: "",
    company_website: "",
  });
  const [items, setItems] = useState([{ description: "", quantity: 1, unit_price: 0, discount: 0 }]);

  useEffect(() => {
    base44.entities.Customer.list("-created_date", 100).then(setCustomers);
    if (editId) {
      base44.entities.Document.get(editId).then(doc => {
        const { items: docItems, ...rest } = doc;
        setForm(f => ({ ...f, ...rest, issue_date: rest.issue_date ? rest.issue_date.split("T")[0] : f.issue_date, due_date: rest.due_date ? rest.due_date.split("T")[0] : "" }));
        if (docItems && docItems.length > 0) setItems(docItems);

        const parts = (rest.number || "").split("-");
        if (parts.length >= 2) { setNumPrefix(parts[0]); setNumSeq(parts.slice(1).join("-")); }
      });
    } else {
      base44.auth.me().then(user => {
        if (user) setForm(f => ({
          ...f,
          company_name: user.company_name || user.full_name || "",
          company_email: user.company_email || user.email || "",
          company_phone: user.company_phone || "",
          company_address: user.company_address || "",
          company_website: user.company_website || "",
          logo_url: user.logo_url || "",
          currency: user.default_currency || "NGN",
          tax_rate: user.default_tax_rate ?? 7.5,
          terms: user.default_terms || "",
          payment_instructions: user.default_payment_instructions || "",
        }));

      });
      base44.entities.Document.list("-created_date", 1).then(docs => {
        const prefix = docType === "invoice" ? "INV" : docType === "quotation" ? "QUO" : docType === "receipt" ? "REC" : docType === "waybill" ? "WB" : "DOC";
        const num = docs.length > 0 ? parseInt((docs[0].number || "0").replace(/\D/g, "") || "0") + 1 : 1;
        const seq = String(num).padStart(4, "0");
        setNumPrefix(prefix);
        setNumSeq(seq);
        setForm(f => ({ ...f, number: `${prefix}-${seq}` }));
      });
    }
  }, [docType, editId]);



  const selectCustomer = (id) => {
    if (id === "__add_new__") { setShowAddCustomer(true); return; }
    const c = customers.find(x => x.id === id);
    if (c) setForm(f => ({ ...f, customer_id: id, customer_name: c.full_name, customer_email: c.email || "", customer_address: c.billing_address || "", currency: c.currency || "NGN" }));
  };

  const handleAddCustomer = async (data) => {
    setSavingCustomer(true);
    const created = await base44.entities.Customer.create(data);
    setCustomers(prev => [created, ...prev]);
    selectCustomer(created.id);
    setSavingCustomer(false);
    setShowAddCustomer(false);
  };

  const updateItem = (i, key, val) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

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
      number: numPrefix && numSeq ? `${numPrefix}-${numSeq}` : form.number,
      template,
      template_color: templateColor,
      status,
      items: calcs.lineItems,
      subtotal: calcs.subtotal,
      tax_amount: calcs.taxAmt,
      total: calcs.total,
      balance_due: calcs.total,
      issue_date: form.issue_date ? new Date(form.issue_date).toISOString() : new Date().toISOString(),
      due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
    };
    if (editId) {
      await base44.entities.Document.update(editId, doc);
      navigate(`/documents/${editId}`);
    } else {
      doc.manager_signature = managerSig || "";
      doc.customer_signature = customerSig || "";
      doc.paid_amount = 0;
      const created = await base44.entities.Document.create(doc);
      navigate(`/documents/${created.id}`);
    }
  };

  const sym = CURRENCIES.find(c => c.value === form.currency)?.label.split(" ")[0] || "₦";
  const pdfRef = useRef(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const template = "classic";
  const templateColor = "slate";

  const generatePdfBlob = async () => {
    const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true, logging: false });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = (canvas.height * pageWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
    return pdf.output("blob");
  };

  const handleDownloadPdf = async () => {
    if (!pdfRef.current) return;
    setGeneratingPdf(true);
    const blob = await generatePdfBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${form.number || "document"}.pdf`;
    a.click(); URL.revokeObjectURL(url);
    setGeneratingPdf(false);
  };

  const handleSharePdf = async () => {
    if (!pdfRef.current) return;
    setGeneratingPdf(true);
    const blob = await generatePdfBlob();
    const file = new File([blob], `${form.number || "document"}.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: form.number, text: `${form.number} — ${form.customer_name}` });
    } else {
      // Fallback: download the PDF instead
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${form.number || "document"}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      alert("Direct sharing is only available on mobile browsers. The PDF has been downloaded instead — you can manually share it from your files.");
    }
    setGeneratingPdf(false);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/documents" className="p-2 hover:bg-muted rounded-lg"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold">{editId ? `Edit ${typeLabels[form.type || docType]}` : `New ${typeLabels[docType]}`}</h1>
          <p className="text-sm text-muted-foreground">{editId ? "Update the document details below" : "Fill in the details below"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Document Info */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Document Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Document Number</Label>
                <div className="relative">
                  <Input value={form.number} readOnly className="pr-9 cursor-default bg-muted/40" />
                  <Popover open={numOpen} onOpenChange={setNumOpen}>
                    <PopoverTrigger asChild>
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" title="Customize number format">
                        <Settings2 className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-4" align="end">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Customize Document Number</p>
                      <div className="space-y-3">
                        <div>
                         <Label className="text-xs">Prefix</Label>
                         <Input value={numPrefix} onChange={e => { setNumPrefix(e.target.value); setForm(f => ({ ...f, number: `${e.target.value}-${numSeq}` })); }} placeholder="e.g. INV" className="h-8 text-sm mt-1" />
                        </div>
                        <div>
                         <Label className="text-xs">Number</Label>
                         <Input value={numSeq} onChange={e => { setNumSeq(e.target.value); setForm(f => ({ ...f, number: `${numPrefix}-${e.target.value}` })); }} placeholder="e.g. 0001" className="h-8 text-sm mt-1" />
                        </div>
                        <p className="text-xs text-muted-foreground">Preview: <span className="font-mono font-semibold text-foreground">{numPrefix}-{numSeq}</span></p>
                        <button type="button" className="w-full mt-1 bg-primary text-primary-foreground text-xs font-semibold py-1.5 rounded-md hover:bg-primary/90 transition-colors" onClick={() => setNumOpen(false)}>Save</button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Customer</Label>
                <Select value={form.customer_id} onValueChange={selectCustomer}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}{c.company_name ? ` — ${c.company_name}` : ""}</SelectItem>)}
                    <SelectItem value="__add_new__" className="text-primary font-semibold border-t border-border mt-1 pt-2">＋ Add New Customer</SelectItem>
                  </SelectContent>
                </Select>
                {!form.customer_id && (
                  <Input className="mt-2" placeholder="Or type customer name manually" value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
                )}
              </div>

              <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Add New Customer</DialogTitle></DialogHeader>
                  <div className="mt-2">
                    <CustomerForm onSave={handleAddCustomer} onCancel={() => setShowAddCustomer(false)} />
                  </div>
                </DialogContent>
              </Dialog>
              <div><Label>Terms</Label><Input value={form.terms_label} onChange={e => setForm(f => ({ ...f, terms_label: e.target.value }))} placeholder="Due on Receipt" /></div>
              <div><Label>Issue Date</Label><Input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} /></div>
              <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">Line Items</h3>
            {/* Desktop table header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 mb-1">
              <div className="col-span-5 text-xs font-medium text-muted-foreground">Description</div>
              <div className="col-span-2 text-xs font-medium text-muted-foreground">Qty</div>
              {docType !== 'waybill' && <div className="col-span-2 text-xs font-medium text-muted-foreground">Unit Price</div>}
              {docType !== 'waybill' && <div className="col-span-2 text-xs font-medium text-muted-foreground">Disc %</div>}
            </div>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i}>
                  {/* Mobile card layout */}
                  <div className="sm:hidden bg-muted/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder="Item description" className="flex-1" />
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    {docType !== 'waybill' ? (
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-xs text-muted-foreground">Qty</Label><Input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", +e.target.value)} className="mt-1" /></div>
                        <div><Label className="text-xs text-muted-foreground">Unit Price</Label><Input type="number" value={item.unit_price} onChange={e => updateItem(i, "unit_price", +e.target.value)} className="mt-1" /></div>
                        <div><Label className="text-xs text-muted-foreground">Disc %</Label><Input type="number" value={item.discount} onChange={e => updateItem(i, "discount", +e.target.value)} className="mt-1" /></div>
                      </div>
                    ) : (
                      <div><Label className="text-xs text-muted-foreground">Qty</Label><Input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", +e.target.value)} className="mt-1 w-28" /></div>
                    )}
                    {docType !== 'waybill' && (
                      <div className="text-right text-xs font-semibold text-foreground">{sym}{((item.quantity || 0) * (item.unit_price || 0) * (1 - (item.discount || 0) / 100)).toLocaleString("en", { minimumFractionDigits: 2 })}</div>
                    )}
                  </div>
                  {/* Desktop row layout */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5"><Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder="Item description" /></div>
                    <div className="col-span-2"><Input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", +e.target.value)} /></div>
                    {docType !== 'waybill' && <div className="col-span-2"><Input type="number" value={item.unit_price} onChange={e => updateItem(i, "unit_price", +e.target.value)} /></div>}
                    {docType !== 'waybill' && <div className="col-span-2"><Input type="number" value={item.discount} onChange={e => updateItem(i, "discount", +e.target.value)} /></div>}
                    <div className="col-span-1">
                      <Button variant="ghost" size="icon" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setItems(p => [...p, { description: "", quantity: 1, unit_price: 0, discount: 0 }])}>
              <Plus className="h-3 w-3 mr-1" /> Add Item
            </Button>
          </div>

          {/* Totals */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">Totals</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{sym}{calcs.subtotal.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-muted-foreground font-normal">VAT %</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" className="w-20 h-8 text-xs" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: +e.target.value }))} />
                  <span className="text-muted-foreground text-xs w-24 text-right">{sym}{calcs.taxAmt.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-muted-foreground font-normal">Shipping</Label>
                <Input type="number" className="w-32 h-8 text-xs text-right" value={form.shipping} onChange={e => setForm(f => ({ ...f, shipping: +e.target.value }))} />
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-bold">Total</span>
                <span className="text-xl font-black text-primary">{sym}{calcs.total.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div><Label>Notes / Message to Customer</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="e.g. Thanks for your business." /></div>

            {!['receipt', 'waybill'].includes(docType) && (
              <div><Label>Payment Instructions</Label><Textarea value={form.payment_instructions} onChange={e => setForm(f => ({ ...f, payment_instructions: e.target.value }))} rows={2} /></div>
            )}
          </div>

          {/* Manager Signature */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">Manager / Authorized Signature</h3>
            <p className="text-xs text-muted-foreground mb-3">Sign here using mouse or stylus. This signature will appear on the final document.</p>
            <SignaturePad label="Manager Signature" onSave={setManagerSig} />
          </div>

          {/* Customer Signature — waybill only */}
          {docType === "waybill" && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4">Customer Signature</h3>
              <p className="text-xs text-muted-foreground mb-3">Customer signs here to acknowledge receipt. This will appear on the final document.</p>
              <SignaturePad label="Customer Signature" onSave={setCustomerSig} />
            </div>
          )}
        </div>

        {/* Live Preview Sidebar — hidden on mobile */}
        <div className="hidden lg:block space-y-4">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Live Preview</h3>
                <span className="text-xs text-muted-foreground capitalize">{typeLabels[docType]}</span>
              </div>
            </div>
            <div className="overflow-hidden" style={{ height: 460 }}>
              <div style={{ transform: "scale(0.42)", transformOrigin: "top left", width: 760, pointerEvents: "none" }}>
                <DocumentPreview form={form} items={calcs.lineItems} calcs={calcs} sym={sym} docType={docType} template={template} templateColor={templateColor} />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 sticky top-8">
            <div className="space-y-2">
              <Button className="w-full" onClick={() => handleSave("draft")} disabled={saving || !form.customer_name}>
                {saving ? "Saving..." : "Save as Draft"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleSave("sent")} disabled={saving || !form.customer_name}>
                Save &amp; Send
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setShowPdfPreview(true)}>
                <FileDown className="h-4 w-4 mr-1" />
                Preview &amp; Download PDF
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setShowPdfPreview(true)}>
                <Upload className="h-4 w-4 mr-1" />
                Share PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile sticky bottom action bar */}
        <div className="lg:hidden fixed bottom-14 left-0 right-0 z-30 bg-card border-t border-border px-4 py-3 flex gap-2 shadow-lg">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowPdfPreview(true)} disabled={saving}>
            <FileDown className="h-4 w-4 mr-1" /> Preview
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSave("draft")} disabled={saving || !form.customer_name}>
            {saving ? "Saving..." : "Draft"}
          </Button>
          <Button size="sm" className="flex-1" onClick={() => handleSave("sent")} disabled={saving || !form.customer_name}>
            Save &amp; Send
          </Button>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" onClick={() => setShowPdfPreview(false)}>
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b shrink-0" onClick={e => e.stopPropagation()}>
            <div>
              <p className="font-semibold text-sm">Document Preview</p>
              <p className="text-xs text-muted-foreground">{form.number || "Draft"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleDownloadPdf} disabled={generatingPdf}>
                <FileDown className="h-4 w-4 mr-1" />
                {generatingPdf ? "Generating..." : "Download PDF"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleSharePdf} disabled={generatingPdf}>
                <Upload className="h-4 w-4 mr-1" />
                {generatingPdf ? "Generating..." : "Share PDF"}
              </Button>
              <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground" onClick={() => setShowPdfPreview(false)}>✕</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-gray-100 p-6" onClick={e => e.stopPropagation()}>
            <div className="max-w-3xl mx-auto">
              <DocumentPreview form={form} items={calcs.lineItems} calcs={calcs} sym={sym} docType={form.type || docType} managerSig={managerSig} customerSig={customerSig} template={template} templateColor={templateColor} />
            </div>
          </div>
        </div>
      )}

      {/* Hidden full-size preview for PDF generation */}
      <div style={{ position: "absolute", left: "-9999px", top: 0, width: 760 }}>
        <div ref={pdfRef}>
          <DocumentPreview form={form} items={calcs.lineItems} calcs={calcs} sym={sym} docType={form.type || docType} managerSig={managerSig} customerSig={customerSig} template={template} templateColor={templateColor} />
        </div>
      </div>
    </div>
  );
}