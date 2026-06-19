import { useRef, useState, useEffect } from "react";
import DocumentPreview from "./DocumentPreview";

export default function LivePreviewScaled({ template, templateColor, templateFont, form, calcs, sym, docType }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.offsetWidth / 794);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = Math.round(1123 * scale);

  return (
    <div ref={containerRef} style={{ width: "100%", height, position: "relative", overflow: "hidden" }}>
      <div style={{ transformOrigin: "top left", transform: `scale(${scale})`, width: 794, pointerEvents: "none", position: "absolute", top: 0, left: 0 }}>
        <DocumentPreview
          key={`${template}-${templateColor}-${templateFont}`}
          form={form}
          items={calcs.lineItems}
          calcs={calcs}
          sym={sym}
          docType={docType}
          template={template}
          templateColor={templateColor}
          templateFont={templateFont}
        />
      </div>
    </div>
  );
}