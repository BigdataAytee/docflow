import { useState, useEffect, useMemo, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { base44 } from "@/api/base44Client";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Trash2, ArrowLeft, Settings2, FileDown, Upload, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
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

const DOC_LABELS = {
  invoice:   { number: "Invoice Number",   issueDate: "Invoice Date",  dueDate: "Due Date",      customer: "Bill To",       items: "Line Items",                itemDesc: "Item Description",      itemQty: "Quantity",    notes: "Notes to Customer",     sig: "Authorized Signature",            showTax: true,  showDisc: true,  showDue: true,  showPrices: true  },
  quotation: { number: "Quotation Number", issueDate: "Issue Date",    dueDate: "Expiry Date",   customer: "Prepared For",  items: "Proposed Items / Services", itemDesc: "Item / Service",         itemQty: "Est. Qty",    notes: "Notes",                 sig: "Prepared By (Signature)",         showTax: true,  showDisc: true,  showDue: true,  showPrices: true  },
  receipt:   { number: "Receipt Number",   issueDate: "Payment Date",  dueDate: null,            customer: "Received From", items: "Payment For",               itemDesc: "Description of Payment", itemQty: "Quantity",    notes: "Notes",                 sig: "Received By (Signature)",         showTax: false, showDisc: false, showDue: false, showPrices: true  },
  waybill:   { number: "Waybill Number",   issueDate: "Dispatch Date", dueDate: "Delivery Date", customer: "Receiver",      items: "Goods Description",         itemDesc: "Goods / Items",          itemQty: "Qty Shipped", notes: "Delivery Instructions", sig: "Dispatcher Signature",            showTax: false, showDisc: false, showDue: true,  showPrices: false },
};

const DEFAULT_PREFIXES = { invoice: "INV", quotation: "QUO", receipt: "REC", waybill: "WB" };

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
  const [typePrefix, setTypePrefix] = useState(DEFAULT_PREFIXES[docType] || "DOC");
  const [companyAbbr, setCompanyAbbr] = useState("");
  const [numSeq, setNumSeq] = useState("");
  const [numOpen, setNumOpen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("");

  const draftIdRef = useRef(editId || null);
  const autoSaveTimerRef = useRef(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Warn on browser refresh / tab close
  useEffect(() => {
    const handler = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const [pendingNav, setPendingNav] = useState(null);

  // Intercept all anchor clicks when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      const anchor = e.target.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNav(href);
      setShowLeaveModal(true);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [isDirty]);

  const [form, setForm] = useState({
    type: docType,
    number: "",
    customer_id: "",
    customer_name: "",
    customer_email: "",
    customer_address: "",
    currency: "NGN",
    tax_rate: "",
    shipping: "",
    notes: "",
    terms: "",
    terms_label: "Due on Receipt",
    global_discount_rate: "",
    payment_instructions: "",
    payment_method: "",
    transaction_id: "",
    reference_number: "",
    driver_name: "",
    vehicle_number: "",
    tracking_number: "",
    due_date: "",
    issue_date: new Date().toISOString().split("T")[0],
    logo_url: "",
    company_name: "",
    company_email: "",
    company_phone: "",
    company_address: "",
    company_website: "",
  });
  const [items, setItems] = useState([{ description: "", quantity: "", unit_price: "", discount: "" }]);

  // Mark dirty on any user change
  useEffect(() => { setIsDirty(true); }, [form, items]);

  useEffect(() => {
    (async () => {
      const user = await base44.auth.me();
      if (!user) return;

      base44.entities.Customer.filter({ created_by: user.email }, "-created_date", 100).then(setCustomers);

      const tPrefix = (user[`prefix_${docType}`] || DEFAULT_PREFIXES[docType] || "DOC").toUpperCase();
      const cAbbr = (user.company_abbreviation || "").toUpperCase();
      setTypePrefix(tPrefix);
      setCompanyAbbr(cAbbr);

      if (editId) {
        const doc = await base44.entities.Document.get(editId);
        const { items: docItems, ...rest } = doc;
        setForm(f => ({ ...f, ...rest, issue_date: rest.issue_date ? rest.issue_date.split("T")[0] : f.issue_date, due_date: rest.due_date ? rest.due_date.split("T")[0] : "" }));
        if (docItems && docItems.length > 0) setItems(docItems);
        // Parse seq from end of number (last segment after final dash)
        const parts = (rest.number || "").split("-");
        if (parts.length >= 2) setNumSeq(parts[parts.length - 1]);
      } else {
        setForm(f => ({
          ...f,
          company_name: user.company_name || user.full_name || "",
          company_email: user.company_email || user.email || "",
          company_phone: user.company_phone || "",
          company_address: user.company_address || "",
          company_website: user.company_website || "",
          logo_url: user.logo_url || "",
          currency: user.default_currency || "NGN",
          tax_rate: user.default_tax_rate ?? "",
          terms: user.default_terms || "",
          payment_instructions: user.default_payment_instructions || "",
        }));

        const docs = await base44.entities.Document.filter({ type: docType }, "-created_date", 1);
        const num = docs.length > 0 ? parseInt((docs[0].number || "0").replace(/\D/g, "") || "0") + 1 : 1;
        const seq = String(num).padStart(4, "0");
        setNumSeq(seq);
        const fullNumber = cAbbr ? `${cAbbr}-${tPrefix}-${seq}` : `${tPrefix}-${seq}`;
        setForm(f => ({ ...f, number: fullNumber }));
      }
    })();
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
    const globalDiscAmt = subtotal * ((parseFloat(form.global_discount_rate) || 0) / 100);
    const discountedSubtotal = subtotal - globalDiscAmt;
    const taxAmt = discountedSubtotal * ((form.tax_rate || 0) / 100);
    const total = discountedSubtotal + taxAmt + (parseFloat(form.shipping) || 0);
    return { lineItems, subtotal, globalDiscAmt, taxAmt, total };
  }, [items, form.tax_rate, form.shipping, form.global_discount_rate]);

  const handleBackClick = (e) => {
    if (isDirty) { e.preventDefault(); setShowLeaveModal(true); }
    else navigate(-1);
  };

  const handleSave = async (status = "draft") => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaving(true);
    const doc = buildDocPayload(status);
    const targetId = draftIdRef.current || editId;
    if (targetId) {
      await base44.entities.Document.update(targetId, doc);
      navigate(`/documents/${targetId}`);
    } else {
      doc.manager_signature = managerSig || "";
      doc.customer_signature = customerSig || "";
      doc.paid_amount = 0;
      const created = await base44.entities.Document.create(doc);
      navigate(`/documents/${created.id}`);
    }
  };

  const hasMeaningfulData = form.customer_name || items.some(it => it.description);
  useEffect(() => {
    if (!hasMeaningfulData) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus("saving");
      const docData = buildDocPayload("draft");
      if (draftIdRef.current) {
        await base44.entities.Document.update(draftIdRef.current, docData);
      } else {
        docData.manager_signature = managerSig || "";
        docData.customer_signature = customerSig || "";
        docData.paid_amount = 0;
        const created = await base44.entities.Document.create(docData);
        draftIdRef.current = created.id;
      }
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus(""), 3000);
    }, 6000);
    return () => clearTimeout(autoSaveTimerRef.current);
  }, [form, items, managerSig, customerSig]);

  const sym = CURRENCIES.find(c => c.value === form.currency)?.label.split(" ")[0] || "₦";

  const buildDocPayload = (status) => ({
    ...form,
    number: numSeq ? (companyAbbr ? `${companyAbbr}-${typePrefix}-${numSeq}` : `${typePrefix}-${numSeq}`) : form.number,
    template: "classic",
    template_color: "slate",
    status,
    tax_rate: parseFloat(form.tax_rate) || 0,
    global_discount_rate: parseFloat(form.global_discount_rate) || 0,
    global_discount_amount: calcs.globalDiscAmt,
    shipping: parseFloat(form.shipping) || 0,
    items: calcs.lineItems.map(it => ({
      ...it,
      quantity: parseFloat(it.quantity) || 0,
      unit_price: parseFloat(it.unit_price) || 0,
      discount: parseFloat(it.discount) || 0,
      amount: parseFloat(it.amount) || 0,
    })),
    subtotal: calcs.subtotal,
    tax_amount: calcs.taxAmt,
    total: calcs.total,
    balance_due: calcs.total,
    issue_date: form.issue_date ? new Date(form.issue_date).toISOString() : new Date().toISOString(),
    due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
  });

  const pdfRef = useRef(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const template = "classic";
  const templateColor = "slate";

  const generatePdfBlob = async () => {
    const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff", width: 794, windowWidth: 794 });
    const imgData = canvas.toDataURL("image/jpeg", 0.88);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();
    const imgHeightMm = (canvas.height / canvas.width) * pageWidthMm;
    let remaining = imgHeightMm;
    let yPos = 0;
    pdf.addImage(imgData, "JPEG", 0, yPos, pageWidthMm, imgHeightMm);
    remaining -= pageHeightMm;
    while (remaining > 30) {
      yPos -= pageHeightMm;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, yPos, pageWidthMm, imgHeightMm);
      remaining -= pageHeightMm;
    }
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${form.number || "document"}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      alert("Direct sharing is only available on mobile browsers. The PDF has been downloaded instead.");
    }
    setGeneratingPdf(false);
  };

  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const previewScale = Math.min(1, (Math.min(viewportWidth, 826) - 32) / 794);

  const L = DOC_LABELS[docType] || DOC_LABELS.invoice;

  return (
    <div className="max-w-5xl mx-auto pb-32 lg:pb-0">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={handleBackClick} className="p-2 hover:bg-muted rounded-lg"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-2xl font-bold">{editId ? `Edit ${typeLabels[form.type || docType]}` : `New ${typeLabels[docType]}`}</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{editId ? "Update the document details below" : "Fill in the details below"}</p>
            {autoSaveStatus === "saving" && <span className="text-xs text-muted-foreground animate-pulse">Auto-saving…</span>}
            {autoSaveStatus === "saved" && <span className="text-xs text-green-600 font-medium">✓ Draft saved</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Document Info */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{typeLabels[docType]} Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{L.number}</Label>
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
                          <Label className="text-xs">Company Abbreviation</Label>
                          <p className="text-xs text-muted-foreground mb-1">Your company's short code (e.g. DR)</p>
                          <Input
                            value={companyAbbr}
                            onChange={e => {
                              const val = e.target.value.toUpperCase();
                              setCompanyAbbr(val);
                              setForm(f => ({ ...f, number: val ? `${val}-${typePrefix}-${numSeq}` : `${typePrefix}-${numSeq}` }));
                            }}
                            placeholder="e.g. DR"
                            className="h-8 text-sm mt-1"
                            style={{ textTransform: "uppercase" }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Document Type Prefix</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input value={typePrefix} readOnly className="h-8 text-sm bg-muted/50 cursor-default flex-1" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Set in Settings</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Sequence Number</Label>
                          <Input value={numSeq} onChange={e => { setNumSeq(e.target.value); setForm(f => ({ ...f, number: companyAbbr ? `${companyAbbr}-${typePrefix}-${e.target.value}` : `${typePrefix}-${e.target.value}` })); }} placeholder="e.g. 0001" className="h-8 text-sm mt-1" />
                        </div>
                        <p className="text-xs text-muted-foreground">Preview: <span className="font-mono font-semibold text-foreground">{companyAbbr ? `${companyAbbr}-${typePrefix}-${numSeq}` : `${typePrefix}-${numSeq}`}</span></p>
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
                <Label>{L.customer}</Label>
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

              <div><Label>{L.issueDate}</Label><Input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} /></div>
              {L.showDue && <div><Label>{L.dueDate}</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>}
            </div>
          </div>

          {/* Payment Details — Invoice & Quotation */}
          {(docType === "invoice" || docType === "quotation") && (
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Payment Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Method</Label>
                  <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      {["Cash","Bank Transfer","POS","Credit Card","Mobile Money","Cheque"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Transaction ID</Label><Input value={form.transaction_id} onChange={e => setForm(f => ({ ...f, transaction_id: e.target.value }))} placeholder="e.g. TXN-0012345" /></div>
                <div className="col-span-2"><Label>Reference Number</Label><Input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="e.g. REF-2024-001" /></div>
              </div>
            </div>
          )}

          {/* Waybill — Logistics Details */}
          {docType === "waybill" && (
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Logistics Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Driver Name</Label><Input value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} placeholder="e.g. John Doe" /></div>
                <div><Label>Vehicle Number</Label><Input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="e.g. LND-123-AB" /></div>
                <div className="col-span-2"><Label>Tracking Number</Label><Input value={form.tracking_number} onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))} placeholder="e.g. TRK-20240001" /></div>
              </div>
            </div>
          )}

          {/* Line Items */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">{L.items}</h3>
            <div className="hidden sm:grid grid-cols-12 gap-2 mb-1">
              <div className="col-span-1" />
              <div className="col-span-4 text-xs font-medium text-muted-foreground">{L.itemDesc}</div>
              <div className="col-span-2 text-xs font-medium text-muted-foreground">{L.itemQty}</div>
              {L.showPrices && <div className="col-span-2 text-xs font-medium text-muted-foreground">Unit Price</div>}
              {L.showDisc && <div className="col-span-2 text-xs font-medium text-muted-foreground">Disc %</div>}
            </div>
            <DragDropContext onDragEnd={({ source, destination }) => {
              if (!destination) return;
              const next = [...items];
              const [moved] = next.splice(source.index, 1);
              next.splice(destination.index, 0, moved);
              setItems(next);
            }}>
              <Droppable droppableId="line-items">
                {(provided) => (
                  <div className="space-y-3" ref={provided.innerRef} {...provided.droppableProps}>
                    {items.map((item, i) => (
                      <Draggable key={i} draggableId={`item-${i}`} index={i}>
                        {(drag) => (
                          <div ref={drag.innerRef} {...drag.draggableProps} className="select-none">
                            {/* Mobile card layout */}
                            <div className="sm:hidden bg-muted/30 rounded-lg p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <span {...drag.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground shrink-0"><GripVertical className="h-4 w-4" /></span>
                                <Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder={L.itemDesc} className="flex-1" />
                                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                              {L.showPrices ? (
                                <div className="grid grid-cols-3 gap-2">
                                  <div><Label className="text-xs text-muted-foreground">{L.itemQty}</Label><Input value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} onFocus={e => e.target.select()} placeholder="0" className="mt-1" /></div>
                                  <div><Label className="text-xs text-muted-foreground">Unit Price</Label><Input value={item.unit_price} onChange={e => updateItem(i, "unit_price", e.target.value)} onFocus={e => e.target.select()} placeholder="0" className="mt-1" /></div>
                                  <div><Label className="text-xs text-muted-foreground">Disc %</Label><Input value={item.discount} onChange={e => updateItem(i, "discount", e.target.value)} onFocus={e => e.target.select()} placeholder="0" className="mt-1" /></div>
                                </div>
                              ) : (
                                <div><Label className="text-xs text-muted-foreground">{L.itemQty}</Label><Input value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} onFocus={e => e.target.select()} placeholder="0" className="mt-1 w-28" /></div>
                              )}
                              {L.showPrices && (
                                <div className="text-right text-xs font-semibold text-foreground">{sym}{((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0) * (1 - (parseFloat(item.discount) || 0) / 100)).toLocaleString("en", { minimumFractionDigits: 2 })}</div>
                              )}
                            </div>
                            {/* Desktop row layout */}
                            <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-1 flex items-center"><span {...drag.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground"><GripVertical className="h-4 w-4" /></span></div>
                              <div className="col-span-4"><Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder={L.itemDesc} /></div>
                              <div className="col-span-2"><Input value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} onFocus={e => e.target.select()} placeholder="0" /></div>
                              {L.showPrices && <div className="col-span-2"><Input value={item.unit_price} onChange={e => updateItem(i, "unit_price", e.target.value)} onFocus={e => e.target.select()} placeholder="0" /></div>}
                              {L.showDisc && <div className="col-span-2"><Input value={item.discount} onChange={e => updateItem(i, "discount", e.target.value)} onFocus={e => e.target.select()} placeholder="0" /></div>}
                              <div className="col-span-1">
                                <Button variant="ghost" size="icon" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setItems(p => [...p, { description: "", quantity: "", unit_price: "", discount: "" }])}>
              <Plus className="h-3 w-3 mr-1" /> Add Item
            </Button>
          </div>

          {/* Totals */}
          {docType !== "waybill" && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4">{docType === "receipt" ? "Payment Summary" : "Totals"}</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{sym}{calcs.subtotal.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
                {L.showDisc && (
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-muted-foreground font-normal">Global Discount %</Label>
                    <div className="flex items-center gap-2">
                      <Input className="w-20 h-8 text-xs" value={form.global_discount_rate} onChange={e => setForm(f => ({ ...f, global_discount_rate: e.target.value }))} onFocus={e => e.target.select()} placeholder="0" />
                      <span className="text-orange-600 text-xs w-24 text-right">-{sym}{calcs.globalDiscAmt.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
                {L.showTax && (
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-muted-foreground font-normal">VAT %</Label>
                    <div className="flex items-center gap-2">
                      <Input className="w-20 h-8 text-xs" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} onFocus={e => e.target.select()} placeholder="0" />
                      <span className="text-muted-foreground text-xs w-24 text-right">{sym}{calcs.taxAmt.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
                {L.showTax && (
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-muted-foreground font-normal">Shipping</Label>
                    <Input className="w-32 h-8 text-xs text-right" value={form.shipping} onChange={e => setForm(f => ({ ...f, shipping: e.target.value }))} onFocus={e => e.target.select()} placeholder="0" />
                  </div>
                )}
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="font-bold">{docType === "receipt" ? "Amount Received" : "Total"}</span>
                  <span className="text-xl font-black text-primary">{sym}{calcs.total.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div>
              <Label>{L.notes}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                placeholder={docType === "waybill" ? "e.g. Handle with care. Deliver between 9am–5pm." : docType === "receipt" ? "e.g. Thank you for your payment." : "e.g. Thanks for your business."} />
            </div>
            {docType === "invoice" && (
              <div><Label>Payment Instructions</Label><Textarea value={form.payment_instructions} onChange={e => setForm(f => ({ ...f, payment_instructions: e.target.value }))} rows={2} placeholder="e.g. Bank transfer to Account No. 0123456789" /></div>
            )}
            {docType === "quotation" && (
              <div><Label>Terms &amp; Conditions</Label><Textarea value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} rows={2} placeholder="e.g. This quotation is valid for 30 days. Prices subject to change." /></div>
            )}
          </div>

          {/* Primary Signature */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">{L.sig}</h3>
            <p className="text-xs text-muted-foreground mb-3">Sign here using mouse or stylus. This signature will appear on the final document.</p>
            <SignaturePad label={L.sig} onSave={setManagerSig} />
          </div>

          {/* Secondary Signature — waybill receiver or quotation acceptance */}
          {(docType === "waybill" || docType === "quotation") && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4">{docType === "waybill" ? "Receiver Signature" : "Customer Acceptance Signature"}</h3>
              <p className="text-xs text-muted-foreground mb-3">{docType === "waybill" ? "Receiver signs here to confirm goods received in good condition." : "Customer signs here to accept this quotation."}</p>
              <SignaturePad label={docType === "waybill" ? "Receiver Signature" : "Acceptance Signature"} onSave={setCustomerSig} />
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
            <div className="overflow-hidden" style={{ height: 460, width: "100%" }}>
              <div style={{ transform: "scale(0.40)", transformOrigin: "top left", width: 794, pointerEvents: "none", position: "absolute" }}>
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

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full shadow-xl space-y-4">
            <div>
              <h3 className="font-bold text-lg">Leave this page?</h3>
              <p className="text-sm text-muted-foreground mt-1">You have unsaved changes. What would you like to do?</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={async () => {
                setShowLeaveModal(false);
                setIsDirty(false);
                await handleSave("draft");
                if (pendingNav) navigate(pendingNav);
              }}>
                Save as Draft &amp; Leave
              </Button>
              <Button variant="outline" className="w-full" onClick={() => {
                setShowLeaveModal(false);
                setIsDirty(false);
                if (pendingNav) navigate(pendingNav);
                else navigate(-1);
              }}>
                Discard &amp; Leave
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => {
                setShowLeaveModal(false);
                setPendingNav(null);
              }}>
                Keep Editing
              </Button>
            </div>
          </div>
        </div>
      )}

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
          <div className="flex-1 overflow-auto bg-gray-100" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center p-4">
              <div style={{ width: 794 * previewScale, minHeight: 1123 * previewScale, overflow: "hidden" }}>
                <div style={{ width: 794, transformOrigin: "top left", transform: `scale(${previewScale})`, display: "block" }}>
                  <div ref={pdfRef} style={{ width: 794 }}>
                    <DocumentPreview
                      form={form}
                      items={calcs.lineItems}
                      calcs={calcs}
                      sym={sym}
                      docType={form.type || docType}
                      managerSig={managerSig}
                      customerSig={customerSig}
                      template={template}
                      templateColor={templateColor}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}