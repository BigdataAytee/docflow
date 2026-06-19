import { useState, useEffect, useRef } from "react";
import { FileDown, Upload, PenLine, CheckCircle2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import DocumentPreview from "./DocumentPreview";
import { LAYOUTS, COLOR_SCHEMES, LayoutThumb } from "./TemplateSelector";
import { base44 } from "@/api/base44Client";

const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "₵", KES: "KSh", ZAR: "R", CAD: "CA$", AUD: "A$" };

export default function ViewDocPdfModal({ doc, pdfRef, pdfDocRef, generatingPdf, onClose, onDownload, onShare, onSign, previewScale }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.7);
  const [template, setTemplate] = useState(doc.template || "classic");
  const [templateColor, setTemplateColor] = useState(doc.template_color || "slate");
  const [showMobileLayouts, setShowMobileLayouts] = useState(false);

  const sym = CURRENCY_SYMBOLS[doc.currency] || doc.currency || "₦";
  const calcs = {
    subtotal: doc.subtotal,
    taxAmt: doc.tax_amount,
    total: doc.total,
    withholdingVatAmt: doc.withholding_vat_amount || 0,
    netPayable: doc.balance_due || doc.total,
    globalDiscAmt: doc.global_discount_amount || 0,
  };

  // Responsive scale for the document canvas
  useEffect(() => {
    if (!containerRef.current) return;
    const compute = (el) => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 10 || height < 10) return;
      const s = Math.min((width - 32) / 794, (height - 32) / 1123, 1);
      setScale(parseFloat(s.toFixed(4)));
    };
    const raf = requestAnimationFrame(() => compute(containerRef.current));
    const ro = new ResizeObserver(([e]) => compute(e.target));
    ro.observe(containerRef.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  // Persist template/color changes to the document
  const handleSetTemplate = async (val) => {
    setTemplate(val);
    await base44.entities.Document.update(doc.id, { template: val, template_color: templateColor });
  };
  const handleSetColor = async (val) => {
    setTemplateColor(val);
    await base44.entities.Document.update(doc.id, { template: template, template_color: val });
  };

  const accentSwatch = COLOR_SCHEMES[templateColor]?.swatch;

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: "radial-gradient(ellipse at 60% 40%, #0d1117 0%, #080b14 60%, #050709 100%)" }}>

      {/* ── Left: Layout picker — desktop ── */}
      <div className="hidden md:flex shrink-0 flex-col h-full overflow-hidden" style={{ width: 130, background: "linear-gradient(180deg,#0f172a 0%,#0f1629 100%)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="px-3 pt-4 pb-2 border-b border-white/10 shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">Layout</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2 space-y-2 px-2" style={{ scrollbarWidth: "none" }}>
          {Object.values(LAYOUTS).map(l => (
            <button key={l.id} onClick={() => handleSetTemplate(l.id)}
              className={`w-full flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all ${template === l.id ? "border-indigo-400 bg-white/5" : "border-white/10 hover:border-white/25"}`}>
              <div style={{ width: "100%", aspectRatio: "3/4", borderRadius: 3, overflow: "hidden", background: "#fff", position: "relative" }}>
                <LayoutThumb id={l.id} accentColor={accentSwatch} />
              </div>
              <span className={`text-[9px] font-semibold ${template === l.id ? "text-indigo-300" : "text-white/50"}`}>{l.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Center: Document canvas ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full">

        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between px-3 md:px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(15,23,42,0.8)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.25)" }}>
              {doc.type?.toUpperCase()}
            </div>
            <p className="text-white/70 font-semibold text-xs truncate">{doc.number}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onDownload} disabled={generatingPdf}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white/80 transition-all"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <FileDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{generatingPdf ? "…" : "Download"}</span>
            </button>
            <button onClick={onShare} disabled={generatingPdf}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white/80 transition-all"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all text-base leading-none">
              ✕
            </button>
          </div>
        </div>

        {/* Waybill signature banners */}
        {doc.type === "waybill" && !doc.customer_signature && (
          <div className="shrink-0 flex items-center justify-between px-4 py-2" style={{ background: "rgba(5,150,105,0.85)" }}>
            <div className="flex items-center gap-2 text-white">
              <PenLine className="h-4 w-4" />
              <span className="font-bold text-sm">Signature Required</span>
            </div>
            <button onClick={onSign} className="bg-white text-emerald-700 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1">
              <PenLine className="h-3.5 w-3.5" /> Sign
            </button>
          </div>
        )}
        {doc.type === "waybill" && doc.customer_signature && (
          <div className="shrink-0 flex items-center justify-between px-4 py-2" style={{ background: "rgba(4,120,87,0.85)" }}>
            <div className="flex items-center gap-2 text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <span className="font-bold text-sm">Signed</span>
            </div>
            <button onClick={onSign} className="text-xs text-emerald-200 hover:text-white underline">Re-sign</button>
          </div>
        )}

        {/* Document stage */}
        <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden p-4"
          style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.04) 0%, transparent 70%)", backgroundImage: "radial-gradient(circle, rgba(99,102,241,0.05) 1px, transparent 1px)", backgroundSize: "28px 28px" }}>
          <div style={{ width: 794 * scale, height: 1123 * scale, flexShrink: 0, boxShadow: "0 8px 40px rgba(0,0,0,0.5)", borderRadius: 6, overflow: "hidden" }}>
            <div ref={pdfRef} style={{ width: 794, height: 1123, transformOrigin: "top left", transform: `scale(${scale})`, pointerEvents: "none" }}>
              <DocumentPreview
                form={doc}
                items={doc.items || []}
                calcs={calcs}
                sym={sym}
                docType={doc.type}
                managerSig={doc.manager_signature}
                customerSig={doc.customer_signature}
                template={template}
                templateColor={templateColor}
                templateFont={doc.template_font}
              />
            </div>
          </div>
        </div>

        {/* Mobile bottom controls */}
        <div className="md:hidden shrink-0" style={{ background: "rgba(10,14,30,0.97)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Colour row */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
            <button onClick={() => setShowMobileLayouts(v => !v)}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white/80"
              style={{ background: showMobileLayouts ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)" }}>
              <Palette className="h-3.5 w-3.5 text-indigo-400" />
              <span className="max-w-[60px] truncate">{LAYOUTS[template]?.name || "Classic"}</span>
            </button>
            <div className="flex gap-1 overflow-x-auto flex-1 py-1" style={{ scrollbarWidth: "none" }}>
              {Object.values(COLOR_SCHEMES).map(c => (
                <button key={c.id} onClick={() => handleSetColor(c.id)}
                  className={`shrink-0 w-6 h-6 rounded-full border-2 transition-all ${templateColor === c.id ? "border-white scale-125" : "border-white/20"}`}
                  style={{ background: c.swatch }} />
              ))}
            </div>
          </div>
          {/* Layout picker tray — always visible */}
          <div className="flex gap-3 px-3 py-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {Object.values(LAYOUTS).map(l => (
              <button key={l.id} onClick={() => handleSetTemplate(l.id)}
                className={`shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all ${template === l.id ? "border-indigo-400" : "border-white/10"}`}
                style={{ background: "rgba(255,255,255,0.04)", width: 64 }}>
                <div style={{ width: 48, height: 62, borderRadius: 3, overflow: "hidden", background: "#fff", position: "relative" }}>
                  <LayoutThumb id={l.id} accentColor={accentSwatch} />
                </div>
                <span className="text-[9px] text-white/60 font-medium">{l.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Colour scheme panel — desktop ── */}
      <div className="hidden md:flex shrink-0 flex-col h-full overflow-hidden" style={{ width: 140, background: "linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="px-3 pt-4 pb-2.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-xs font-bold text-white tracking-wide">Colour</span>
          </div>
        </div>
        <div className="px-3 pt-3 overflow-y-auto flex-1" style={{ scrollbarWidth: "none" }}>
          <p className="text-[9px] text-indigo-300 font-semibold mb-2">{COLOR_SCHEMES[templateColor]?.name}</p>
          <div className="flex flex-wrap gap-2">
            {Object.values(COLOR_SCHEMES).map(c => (
              <button key={c.id} onClick={() => handleSetColor(c.id)} title={c.name}
                className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${templateColor === c.id ? "border-white scale-125 shadow-lg shadow-white/20" : "border-transparent"}`}
                style={{ background: c.swatch }} />
            ))}
          </div>
        </div>
      </div>

      {/* Hidden off-screen render for PDF export */}
      <div style={{ position: "fixed", top: 0, left: "-9999px", width: "794px", zIndex: -1, pointerEvents: "none", opacity: 0 }}>
        <div ref={pdfDocRef} style={{ width: "794px" }}>
          <DocumentPreview
            form={doc}
            items={doc.items || []}
            calcs={calcs}
            sym={sym}
            docType={doc.type}
            managerSig={doc.manager_signature}
            customerSig={doc.customer_signature}
            template={template}
            templateColor={templateColor}
            templateFont={doc.template_font}
          />
        </div>
      </div>
    </div>
  );
}