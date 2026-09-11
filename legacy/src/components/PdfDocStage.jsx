import { useRef, useEffect, useState } from "react";
import DocumentPreview from "./DocumentPreview";

// Responsive PDF document stage — uses ResizeObserver to fit the A4 page
// perfectly inside whatever space is available, on any screen size / orientation.
export default function PdfDocStage({
  pdfRef, form, calcs, sym, docType,
  managerSig, customerSig, pdfMode,
  template, templateColor, templateFont,
}) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const compute = () => {
      const w = el.clientWidth  - 16; // 8px padding each side
      const h = el.clientHeight - 16;
      const s = Math.min(w / 794, h / 1123, 1);
      setScale(Math.max(s, 0.1));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const docW = Math.round(794 * scale);
  const docH = Math.round(1123 * scale);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center relative z-10 overflow-hidden"
      style={{ minHeight: 0 }}
    >
      {/* Paper stack shadow layers */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", bottom: -5, left: 5, right: -5, height: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -2.5, left: 2.5, right: -2.5, height: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }} />

        {/* Scaled document */}
        <div style={{ width: docW, height: docH, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.75)", position: "relative" }}>
          <div style={{ width: 794, height: 1123, transformOrigin: "top left", transform: `scale(${scale})` }}>
            <div ref={pdfRef} style={{ width: 794 }}>
              <DocumentPreview
                form={form}
                items={calcs.lineItems}
                calcs={calcs}
                sym={sym}
                docType={docType}
                managerSig={managerSig}
                customerSig={docType === "waybill" && pdfMode === "paper" ? "" : customerSig}
                template={template}
                templateColor={templateColor}
                templateFont={templateFont}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}