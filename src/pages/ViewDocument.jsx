import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Printer, Send, Pencil, MoreVertical, Copy, GitMerge, PenLine, CheckCircle2, Receipt, Truck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SignaturePad from "../components/SignaturePad";
import WaybillSignatureModal from "../components/WaybillSignatureModal";
import ConvertDocumentModal from "../components/ConvertDocumentModal";
import { buildTheme } from "../components/TemplateSelector";
import DocumentPreview from "../components/DocumentPreview";

const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "₵", KES: "KSh", ZAR: "R", CAD: "CA$", AUD: "A$" };

const TYPE_LABELS = {
  invoice: "INVOICE", quotation: "QUOTATION", receipt: "RECEIPT", waybill: "WAYBILL",
};

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-500",
  sent: "bg-blue-50 text-blue-600",
  viewed: "bg-indigo-50 text-indigo-600",
  paid: "bg-emerald-50 text-emerald-600",
  partially_paid: "bg-teal-50 text-teal-600",
  overdue: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
  accepted: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-600",
  pending: "bg-amber-50 text-amber-600",
  packed: "bg-blue-50 text-blue-600",
  dispatched: "bg-indigo-50 text-indigo-600",
  in_transit: "bg-purple-50 text-purple-600",
  delivered: "bg-emerald-50 text-emerald-600",
  returned: "bg-red-50 text-red-600",
  to_be_signed: "bg-amber-50 text-amber-700",
  to_be_delivered: "bg-orange-50 text-orange-700",
};

const STATUS_BY_TYPE = {
  invoice: ["draft","sent","viewed","partially_paid","paid","overdue","cancelled"],
  quotation: ["draft","sent","viewed","accepted","rejected","cancelled"],
  receipt: ["draft","sent","paid"],
  waybill: ["pending","packed","dispatched","in_transit","delivered","returned","to_be_signed","to_be_delivered"],
};

const AMOUNT_LABEL = {
  receipt: "Amount Paid", quotation: "Quoted Amount",
};

const CUSTOMER_LABEL = {
  waybill: "Ship To",
};

export default function ViewDocument() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfMode, setPdfMode] = useState("soft");
  const pdfRef = useRef(null);
  const pdfPaperRef = useRef(null);
  const pdfSoftRef = useRef(null);
  const pdfDocRef = useRef(null);
  const [softAutoDownload, setSoftAutoDownload] = useState(false);
  const [showInlineSigPad, setShowInlineSigPad] = useState(false);
  const [convertTarget, setConvertTarget] = useState(null); // 'invoice' | 'receipt'
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    const calcScale = () => {
      // Always use portrait width — cap at screen's shorter dimension on landscape
      const portraitWidth = Math.min(window.innerWidth, window.innerHeight > window.innerWidth ? window.innerWidth : window.screen.width);
      setPreviewScale(Math.min(1, (portraitWidth - 32) / 794));
    };
    calcScale();
    window.addEventListener("resize", calcScale);
    window.addEventListener("orientationchange", calcScale);
    return () => {
      window.removeEventListener("resize", calcScale);
      window.removeEventListener("orientationchange", calcScale);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      base44.entities.Document.get(docId),
      base44.auth.me(),
    ]).then(([d, user]) => {
      // Ownership check — only the creator (or admin) may view this document
      if (d && user && d.created_by !== user.email && user.role !== "admin") {
        navigate("/documents");
        return;
      }
      if (user) {
        d = {
          ...d,
          logo_url: user.logo_url || d.logo_url || "",
          company_name: user.company_name || d.company_name || "",
          company_email: user.company_email || user.email || d.company_email || "",
          company_phone: user.company_phone || d.company_phone || "",
          company_address: user.company_address || d.company_address || "",
          company_website: user.company_website || d.company_website || "",
          document_tagline: user.document_tagline || "",
          footer_contact_line: user.footer_contact_line || "",
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

  const uploadSig = async (dataUrl) => {
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const file = new File([arr], 'signature.png', { type: mime });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  const saveManagerSig = async (sig) => {
    const sigUrl = await uploadSig(sig);
    await base44.entities.Document.update(docId, { manager_signature: sigUrl });
    setDoc(prev => ({ ...prev, manager_signature: sigUrl }));
  };

  const saveCustomerSig = async (sig) => {
    const sigUrl = await uploadSig(sig);
    const now = new Date();
    const updates = {
      customer_signature: sigUrl,
      status: "delivered",
      receiver_date: now.toISOString().split("T")[0],
      receiver_time: now.toTimeString().slice(0, 5),
      delivery_signed_at: now.toISOString(),
    };
    await base44.entities.Document.update(docId, updates);
    setDoc(prev => ({ ...prev, ...updates }));
  };

  const handleSoftSigSave = async (sig) => {
    const now = new Date();
    const receiverDate = now.toISOString().split("T")[0];
    const receiverTime = now.toTimeString().slice(0, 5);
    const sigUrl = await uploadSig(sig);
    await base44.entities.Document.update(docId, {
      customer_signature: sigUrl,
      receiver_date: receiverDate,
      receiver_time: receiverTime,
      delivery_signed_at: now.toISOString(),
      status: "delivered",
    });
    setDoc(prev => ({ ...prev, customer_signature: sigUrl, receiver_date: receiverDate, receiver_time: receiverTime, delivery_signed_at: now.toISOString(), status: "delivered" }));
    setShowInlineSigPad(false);
    toast.success("Signature captured — preparing signed PDF…");
    setTimeout(async () => {
      if (!pdfSoftRef.current) return;
      setGeneratingPdf(true);
      const blob = await generatePdfBlob(pdfDocRef);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.number}-signed.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setGeneratingPdf(false);
      toast.success("Signed PDF downloaded — signature locked into document.");
    }, 600);
  };

  const handleDeliveryConfirmed = (updatedDoc) => {
    setDoc(prev => ({ ...prev, ...updatedDoc }));
    if (softAutoDownload) {
      setSoftAutoDownload(false);
      setTimeout(async () => {
        if (!pdfSoftRef.current) return;
        setGeneratingPdf(true);
        const blob = await generatePdfBlob(pdfDocRef);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${updatedDoc.number || "waybill"}-signed.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setGeneratingPdf(false);
        toast.success("Signed PDF downloaded — signature locked into document.");
      }, 600);
    }
  };

  const generatePdfBlob = async (targetRef) => {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const element = (targetRef || pdfDocRef).current;
    const wrapper = element.parentElement;
    const savedStyle = wrapper.getAttribute("style");
    // Make visible off-screen at exact A4 pixel width so layout fully renders
    wrapper.setAttribute("style", "position:fixed;top:0;left:-9999px;width:794px;z-index:9999;opacity:0;pointer-events:none;");
    element.style.width = "794px";
    // Wait for layout to settle
    await new Promise(r => setTimeout(r, 300));
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: 794,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
      logging: false,
    });
    wrapper.setAttribute("style", savedStyle || "");
    element.style.width = "";
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();
    // canvas.width is 794*2=1588 (scale:2), canvas.height is auto-detected full height
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
    setGeneratingPdf(true);
    const blob = await generatePdfBlob(pdfDocRef);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${doc.number || "document"}.pdf`;
    a.click(); URL.revokeObjectURL(url);
    setGeneratingPdf(false);
  };

  const handleSharePdf = async () => {
    setGeneratingPdf(true);
    const blob = await generatePdfBlob(pdfDocRef);
    const file = new File([blob], `${doc.number || "document"}.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: doc.number, text: `${doc.number} — ${doc.customer_name}` });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${doc.number || "document"}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      toast.info("Direct sharing is only available on mobile browsers. The PDF has been downloaded instead.");
    }
    setGeneratingPdf(false);
  };

  const downloadInMode = async (mode) => {
    setPdfMode(mode);
    setGeneratingPdf(true);
    await new Promise(r => setTimeout(r, 150));
    const blob = await generatePdfBlob(pdfDocRef);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.number || "waybill"}-${mode === "paper" ? "paper" : "signed"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setGeneratingPdf(false);
  };

  const downloadPaperSignage = async () => {
    if (!pdfDocRef.current) return;
    setGeneratingPdf(true);
    const blob = await generatePdfBlob(pdfDocRef);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.number}-paper-signage.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setGeneratingPdf(false);
    toast.success("Paper Signage PDF downloaded — print and have the receiver sign physically.");
  };

  const downloadSoftSignage = async () => {
    setShowPdfPreview(false);
    const status = doc.customer_signature ? "draft" : "to_be_delivered";
    await base44.entities.Document.update(docId, { status });
    toast.success("Waybill saved as draft.");
    navigate("/documents?type=waybill");
  };

  const handleDelete = async () => {
    await base44.entities.Document.delete(docId);
    navigate("/documents");
  };

  const handleDuplicate = async () => {
    const { id, created_date, updated_date, created_by, ...rest } = doc;
    const nextNum = `${rest.number}-copy`;
    const created = await base44.entities.Document.create({ ...rest, number: nextNum, status: "draft", manager_signature: "", customer_signature: "", paid_amount: 0 });
    toast.success("Document duplicated!");
    navigate(`/documents/${created.id}`);
  };

  const handleConvertConfirm = async (formData) => {
    const { id, created_date, updated_date, created_by, ...rest } = doc;
    const isReceipt = convertTarget === "receipt";
    const isWaybill = convertTarget === "waybill";
    const newDoc = {
      ...rest,
      type: convertTarget,
      number: formData.number,
      status: isReceipt ? "paid" : isWaybill ? "pending" : "draft",
      issue_date: formData.issue_date ? new Date(formData.issue_date).toISOString() : new Date().toISOString(),
      due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
      notes: formData.notes,
      manager_signature: rest.manager_signature || "",
      customer_signature: "",
      payment_method: formData.payment_method || rest.payment_method || undefined,
      ...(isReceipt ? { paid_amount: rest.total || 0, balance_due: 0 } : { paid_amount: 0 }),
    };
    const created = await base44.entities.Document.create(newDoc);
    setConvertTarget(null);
    const label = convertTarget === "invoice" ? "Invoice" : convertTarget === "receipt" ? "Receipt" : "Waybill";
    toast.success(`${label} created successfully!`);
    navigate(`/documents/${created.id}`);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!doc) return <div className="text-center py-12 text-muted-foreground">Document not found</div>;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 mb-5 print:hidden flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate(`/documents?type=${doc.type}`)} className="p-2 hover:bg-muted rounded-lg shrink-0"><ArrowLeft className="h-4 w-4" /></button>
          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-bold truncate">{doc.number}</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">{TYPE_LABELS[doc.type]}</p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${STATUS_COLORS[doc.status]}`}>{doc.status}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden md:block">
            <Select value={doc.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(STATUS_BY_TYPE[doc.type] || STATUS_BY_TYPE.invoice).map(s => (
                  <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {doc.type === "quotation" && (
            <>
              <Button variant="outline" size="sm" className="h-9 px-3 hidden md:flex gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50" onClick={() => setConvertTarget("invoice")}>
                <GitMerge className="h-4 w-4" /><span>→ Invoice</span>
              </Button>
              <Button variant="outline" size="sm" className="h-9 px-3 hidden md:flex gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => setConvertTarget("receipt")}>
                <Receipt className="h-4 w-4" /><span>→ Receipt</span>
              </Button>
            </>
          )}
          {doc.type === "invoice" && (
            <>
              <Button variant="outline" size="sm" className="h-9 px-3 hidden md:flex gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => setConvertTarget("receipt")}>
                <Receipt className="h-4 w-4" /><span>→ Receipt</span>
              </Button>
              <Button variant="outline" size="sm" className="h-9 px-3 hidden md:flex gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => setConvertTarget("waybill")}>
                <Truck className="h-4 w-4" /><span>→ Waybill</span>
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="h-9 px-3" onClick={() => navigate(`/documents/new?edit=${docId}&type=${doc.type}`)}>
            <Pencil className="h-4 w-4" /><span className="hidden sm:inline ml-1.5">Edit</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="md:hidden px-2 py-1.5">
                <p className="text-xs text-muted-foreground mb-1.5">Change Status</p>
                {(STATUS_BY_TYPE[doc.type] || STATUS_BY_TYPE.invoice).map(s => (
                  <button key={s} onClick={() => updateStatus(s)}
                    className={`block w-full text-left px-2 py-1 rounded text-xs capitalize hover:bg-muted ${doc.status === s ? "font-bold text-primary" : ""}`}>{s.replace(/_/g, " ")}</button>
                ))}
              </div>
              <DropdownMenuSeparator className="md:hidden" />
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" /> Print
              </DropdownMenuItem>

              {doc.status === "draft" && (
                <DropdownMenuItem onClick={() => updateStatus("sent")}>
                  <Send className="h-4 w-4 mr-2" /> Mark as Sent
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" /> Duplicate
              </DropdownMenuItem>
              {doc.type === "quotation" && (
                <>
                  <DropdownMenuItem onClick={() => setConvertTarget("invoice")}>
                    <GitMerge className="h-4 w-4 mr-2" /> Convert to Invoice
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConvertTarget("receipt")}>
                    <Receipt className="h-4 w-4 mr-2" /> Convert to Receipt
                  </DropdownMenuItem>
                </>
              )}
              {doc.type === "invoice" && (
                <>
                  <DropdownMenuItem onClick={() => setConvertTarget("receipt")}>
                    <Receipt className="h-4 w-4 mr-2" /> Convert to Receipt
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConvertTarget("waybill")}>
                    <Truck className="h-4 w-4 mr-2" /> Convert to Waybill
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {doc.type === "waybill" && (
        <div className="print:hidden mb-4 bg-white border border-border rounded-xl p-3 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1 hidden sm:inline">Waybill Actions</span>
          {doc.status === "to_be_delivered" && (
            <Button size="sm" onClick={() => setShowSignModal(true)} className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white border-0 animate-pulse">
              <PenLine className="h-3.5 w-3.5" />
              <span>Sign Delivery</span>
            </Button>
          )}
          {doc.status !== "to_be_delivered" && doc.status !== "delivered" && (
            <Button size="sm" onClick={() => setShowSignModal(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0">
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Receiver Sign</span>
              <span className="sm:hidden">Sign</span>
            </Button>
          )}
        </div>
      )}

      {doc.status === "draft" && (
        <div className="print:hidden mb-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-800">What's next?</p>
            <p className="text-xs text-amber-700">Send this document to your customer or mark it as Sent.</p>
          </div>
          <Button size="sm" onClick={() => updateStatus("sent")}><Send className="h-3 w-3 mr-1.5" />Mark as Sent</Button>
        </div>
      )}

      {doc.type === "waybill" && doc.status === "delivered" && doc.delivery_signed_at && (
        <div className="print:hidden mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-800">Delivery Confirmed ✓</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Signed by <strong>{doc.receiver_name || doc.customer_name}</strong>
                  {doc.receiver_date && <> · {doc.receiver_date}</>}
                  {doc.receiver_time && <> at {doc.receiver_time}</>}
                </p>
              </div>
            </div>
            {doc.delivery_proof_url && (
              <a href={doc.delivery_proof_url} target="_blank" rel="noreferrer"
                className="text-xs text-emerald-700 underline shrink-0">View proof</a>
            )}
          </div>
        </div>
      )}

      {doc.type === "waybill" && !(["delivered"].includes(doc.status)) && (
        <div className="print:hidden mb-4 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-800">Awaiting Delivery Confirmation</p>
            <p className="text-xs text-blue-700">Click "Sign Delivery" to capture receiver signature and confirm delivery.</p>
          </div>
        </div>
      )}

      {/* Document view — scaled to fit on mobile */}
      <ScaledDocument scale={previewScale}>
        <DocumentPreview
          form={doc}
          items={doc.items || []}
          calcs={{ subtotal: doc.subtotal, taxAmt: doc.tax_amount, globalDiscAmt: doc.global_discount_amount || 0, total: doc.total, withholdingVatAmt: doc.withholding_vat_amount || 0, netPayable: doc.balance_due || doc.total }}
          sym={CURRENCY_SYMBOLS[doc.currency] || doc.currency || "₦"}
          docType={doc.type}
          managerSig={doc.manager_signature}
          customerSig={doc.customer_signature}
          template={doc.template || "classic"}
          templateColor={doc.template_color || "slate"}
          templateFont={doc.template_font}
        />
      </ScaledDocument>

      {/* Inline Signature Capture Overlay */}
      {showInlineSigPad && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/80" onClick={() => setShowInlineSigPad(false)}>
          <div className="mt-auto bg-white rounded-t-3xl shadow-2xl" style={{ maxHeight: "92dvh" }} onClick={e => e.stopPropagation()}>
            <div className="bg-slate-900 text-white px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <PenLine className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base">Receiver Signature</h2>
                    <p className="text-xs text-slate-400">{doc.number} · {doc.customer_name}</p>
                  </div>
                </div>
                <button onClick={() => setShowInlineSigPad(false)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                  <span className="text-lg leading-none">✕</span>
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-4 text-center">Sign below using your finger, mouse, or stylus.</p>
              <SignaturePad label="Receiver Signature" onSave={handleSoftSigSave} />
            </div>
          </div>
        </div>
      )}

      {/* Hidden off-screen render container for PDF generation */}
      <div style={{ position: "fixed", top: 0, left: "-9999px", width: "794px", zIndex: -1, pointerEvents: "none", opacity: 0 }}>
        <div ref={pdfDocRef} style={{ width: "794px" }}>
          {doc && (
            <DocumentPreview
              form={doc}
              items={doc.items || []}
              calcs={{ subtotal: doc.subtotal, taxAmt: doc.tax_amount, globalDiscAmt: doc.global_discount_amount || 0, total: doc.total, withholdingVatAmt: doc.withholding_vat_amount || 0, netPayable: doc.balance_due || doc.total }}
              sym={CURRENCY_SYMBOLS[doc.currency] || doc.currency || "₦"}
              docType={doc.type}
              managerSig={doc.manager_signature}
              customerSig={doc.customer_signature}
              template={doc.template || "classic"}
              templateColor={doc.template_color || "slate"}
              templateFont={doc.template_font}
            />
          )}
        </div>
      </div>

      {showSignModal && doc.type === "waybill" && (
        <WaybillSignatureModal
          doc={doc}
          onClose={() => setShowSignModal(false)}
          onSaved={handleDeliveryConfirmed}
        />
      )}

      {convertTarget && (
        <ConvertDocumentModal
          doc={doc}
          targetType={convertTarget}
          onConfirm={handleConvertConfirm}
          onClose={() => setConvertTarget(null)}
        />
      )}


    </div>
  );
}

function ScaledDocument({ scale, children }) {
  const innerRef = useRef(null);
  const [scaledHeight, setScaledHeight] = useState(null);

  useEffect(() => {
    if (!innerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (innerRef.current) {
        setScaledHeight(innerRef.current.offsetHeight * scale);
      }
    });
    observer.observe(innerRef.current);
    return () => observer.disconnect();
  }, [scale]);

  return (
    <div style={{ width: "100%", overflow: "hidden", height: scaledHeight ?? "auto" }}>
      <div ref={innerRef} style={{ width: 794, transformOrigin: "top left", transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

function UnifiedTemplate({ doc, onSaveManagerSig, onSaveCustomerSig, onOpenSignModal, isPdf = false }) {
  const items = doc.items || [];
  const curr = doc.currency || "NGN";
  const fmtAmt = (n) => `${(n || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtCurr = (n) => `${curr} ${fmtAmt(n)}`;
  const customerLabel = CUSTOMER_LABEL[doc.type] || "Sold To";
  const amountLabel = AMOUNT_LABEL[doc.type] || "Balance Due";
  const T = buildTheme(doc.template || "classic", doc.template_color || "slate", doc.template_font);
  const isColoredHeader = T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb";

  return (
    <div className="bg-white border border-gray-300 shadow-sm rounded-lg overflow-hidden print:shadow-none print:border-0"
      style={{ fontFamily: T.font }}>

      {/* Header */}
      <div className="px-12 pt-10 pb-6" style={{ background: T.headerBg, borderBottom: `2px solid ${T.accentColor}` }}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {doc.logo_url
              ? <img src={doc.logo_url} alt="Logo" className="h-48 w-auto object-contain mb-4" style={{ maxWidth: 400 }} />
              : <div className="h-8" />
            }
            {doc.company_name && <p className="font-black text-2xl whitespace-nowrap" style={{ color: T.headerColor }}>{doc.company_name}</p>}
            <div className="mt-2 space-y-0.5">
              {doc.company_address && <p className="text-xs whitespace-pre-line" style={{ color: T.headerColor, opacity: 0.7 }}>{doc.company_address}</p>}
            </div>
          </div>
          <div style={{ textAlign: "right", marginLeft: 32, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 4, color: T.docTitleColor, lineHeight: 1 }}>{TYPE_LABELS[doc.type]}</div>
            <div style={{ fontSize: 13, fontFamily: "monospace", color: T.headerColor, opacity: 0.6 }}>{doc.number}</div>
            {doc.type !== 'waybill' && (
              <div style={{ marginTop: 8, borderRadius: 8, padding: "12px 20px", minWidth: 180, textAlign: "right", background: isColoredHeader ? "rgba(255,255,255,0.15)" : "#f8fafc", border: `1px solid ${isColoredHeader ? "rgba(255,255,255,0.25)" : "#e2e8f0"}` }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, color: isColoredHeader ? "#ffffff" : "#64748b", marginBottom: 4 }}>{amountLabel}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: isColoredHeader ? "#ffffff" : "#111827", lineHeight: 1 }}>{fmtCurr(doc.balance_due || doc.total)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sold To / Dates strip */}
      <div className="px-12 py-5 grid grid-cols-2 gap-8" style={{ background: T.stripBg, borderBottom: `1px solid ${T.stripBorder}` }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: T.tableHeaderColor }}>{customerLabel}</p>
          <p className="font-semibold text-gray-800 text-sm">{doc.customer_name || "—"}</p>
          {doc.customer_company && <p className="text-gray-600 text-xs font-semibold mt-0.5">{doc.customer_company}</p>}
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
                <span style={{ color: T.tableHeaderColor }}>{doc.type === "quotation" ? "Valid Until" : "Due Date"}</span>
              </p>
              <p className="font-semibold text-gray-700 text-sm">{format(new Date(doc.due_date), "dd MMM yyyy")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="px-12 py-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: `2px solid ${T.accentColor}`, background: T.tableHeaderBg, color: T.tableHeaderColor }}>
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
        {doc.type !== 'waybill' && (
          <div className="flex justify-end mt-6 mb-8">
            <div className="w-72 text-sm space-y-1.5">
              <div className="flex justify-between py-1"><span className="text-gray-400">Subtotal</span><span className="text-gray-700">{fmtAmt(doc.subtotal)}</span></div>
              {doc.global_discount_amount > 0 && (
                <div className="flex justify-between py-1 text-orange-600"><span>Discount ({doc.global_discount_rate}%)</span><span>(-) {fmtAmt(doc.global_discount_amount)}</span></div>
              )}
              {doc.tax_amount > 0 && (
                <div className="flex justify-between py-1"><span className="text-gray-400">VAT ({doc.tax_rate}%)</span><span className="text-gray-700">{fmtAmt(doc.tax_amount)}</span></div>
              )}
              {doc.shipping > 0 && (
                <div className="flex justify-between py-1"><span className="text-gray-400">Shipping</span><span className="text-gray-700">{fmtAmt(doc.shipping)}</span></div>
              )}
              {doc.paid_amount > 0 && (
                <div className="flex justify-between py-1 text-emerald-600"><span>Payment Made</span><span>(-) {fmtCurr(doc.paid_amount)}</span></div>
              )}
              <div className="flex justify-between py-3" style={{ borderTop: `2px solid ${T.totalBorder}` }}>
                <span className="font-black text-gray-900 uppercase text-sm">{amountLabel}</span>
                <span className="font-black text-gray-900 text-lg">{fmtCurr(doc.total)}</span>
              </div>
              {doc.withholding_vat_amount > 0 && (
                <>
                  <div className="flex justify-between py-1 text-red-600">
                    <span>Withholding VAT ({doc.withholding_vat_rate}%)</span>
                    <span>(-) {fmtAmt(doc.withholding_vat_amount)}</span>
                  </div>
                  <div className="flex justify-between py-3" style={{ borderTop: "2px dashed #16a34a" }}>
                    <span className="font-black text-green-700 uppercase text-sm">Net Payable</span>
                    <span className="font-black text-green-700 text-lg">{fmtCurr(doc.balance_due)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {doc.notes && (
          <div className="border-t border-gray-200 pt-6 mb-8 text-sm text-gray-600">
            <p>{doc.notes}</p>
          </div>
        )}

        {/* Signatures + Bank Details */}
        <div className="border-t border-gray-200 pt-8 mt-6 flex items-start justify-between gap-8">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Manager's Signature</p>
            {doc.manager_signature ? (
              <div>
                <img src={doc.manager_signature} alt="Manager Signature" className="h-20 object-contain mb-2" />
                <div className="border-t border-gray-400 pt-1.5">
                  {doc.manager_name && <p className="text-xs font-semibold text-gray-700">{doc.manager_name}</p>}
                  {doc.manager_title && <p className="text-xs text-gray-500">{doc.manager_title}</p>}
                  {!doc.manager_name && <p className="text-xs text-gray-500">{doc.company_name || "Company"}</p>}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ height: 64, borderBottom: "2px solid #374151", marginBottom: 8 }} />
                {doc.manager_name && <p className="text-xs font-semibold text-gray-700 mt-1">{doc.manager_name}</p>}
                {doc.manager_title && <p className="text-xs text-gray-500">{doc.manager_title}</p>}
                {!doc.manager_name && <p className="text-xs text-gray-500 mt-1">{doc.company_name || "Company"}</p>}
                {!isPdf && <p className="text-xs text-muted-foreground mt-1">Sign in the document editor to add your signature.</p>}
              </div>
            )}
          </div>

          {doc.type === 'waybill' && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Receiver Signature</p>
              {doc.customer_signature ? (
                <div>
                  <img src={doc.customer_signature} alt="Receiver Signature" className="h-16 object-contain mb-2" />
                  <div className="border-t border-gray-400 pt-1.5">
                    <p className="text-xs font-semibold text-gray-700">{doc.receiver_name || doc.customer_name}</p>
                    {doc.receiver_date && <p className="text-xs text-gray-400 mt-0.5">Date: {doc.receiver_date} {doc.receiver_time && `· ${doc.receiver_time}`}</p>}
                  </div>
                  <div className="flex items-center gap-2 mt-2 print:hidden">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">✓ Delivered</span>
                    <button className="text-xs text-primary hover:underline" onClick={onOpenSignModal}>Re-sign</button>
                  </div>
                  <div className="hidden print:block mt-1">
                    <span className="text-xs text-emerald-600 font-semibold">✓ Delivery Confirmed</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ height: 64, borderBottom: "2px solid #374151", marginBottom: 4 }} />
                  <p className="text-xs text-gray-500 mt-1">{doc.customer_name}</p>
                  <div className="mt-3 flex gap-4 text-xs text-gray-400">
                    <div className="flex flex-col gap-1 flex-1"><span>Date</span><div style={{ borderBottom: "2px solid #374151", height: 16 }} /></div>
                    <div className="flex flex-col gap-1 flex-1"><span>Time</span><div style={{ borderBottom: "2px solid #374151", height: 16 }} /></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {(doc.type === 'invoice' || doc.type === 'quotation') && (doc.bank_name || doc.account_number || doc.account_holder_name) && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bank Details</p>
              <div className="flex flex-col gap-2 text-sm bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 min-w-[220px]">
                {doc.bank_name && (
                  <div className="flex items-center gap-3"><span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold w-28 shrink-0">Bank</span><span className="text-gray-700 font-medium">{doc.bank_name}</span></div>
                )}
                {doc.account_number && (
                  <div className="flex items-center gap-3"><span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold w-28 shrink-0">Account No.</span><span className="text-gray-700 font-medium font-mono">{doc.account_number}</span></div>
                )}
                {doc.account_holder_name && (
                  <div className="flex items-center gap-3"><span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold w-28 shrink-0">Account Name</span><span className="text-gray-700 font-medium">{doc.account_holder_name}</span></div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-12 py-4 bg-gray-50 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          {doc.footer_contact_line || [doc.company_phone, doc.company_email, doc.company_website].filter(Boolean).join("  ·  ")}
        </p>
      </div>

      {doc.document_tagline && (
        <div className="px-12 py-5 text-center">
          <p className="text-xs text-gray-400 italic tracking-wide">{doc.document_tagline}</p>
        </div>
      )}
    </div>
  );
}