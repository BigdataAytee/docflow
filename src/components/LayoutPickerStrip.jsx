import { useRef, useState, useCallback } from "react";
import { buildTheme, LAYOUTS } from "./TemplateSelector";
import DocumentPreview from "./DocumentPreview";

export default function LayoutPickerStrip({ layouts, colorSchemes, template, templateColor, onSelect, form, items, calcs, sym, docType, managerSig }) {
  const stripRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [dragged, setDragged] = useState(false);

  // Mouse drag to scroll
  const onMouseDown = (e) => {
    isDragging.current = true;
    setDragged(false);
    startX.current = e.pageX - stripRef.current.offsetLeft;
    scrollLeft.current = stripRef.current.scrollLeft;
    stripRef.current.style.cursor = "grabbing";
  };

  const onMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - stripRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    stripRef.current.scrollLeft = scrollLeft.current - walk;
    if (Math.abs(walk) > 4) setDragged(true);
  }, []);

  const onMouseUp = () => {
    isDragging.current = false;
    if (stripRef.current) stripRef.current.style.cursor = "grab";
  };

  const PREVIEW_W = 200;
  const PREVIEW_H = 283; // A4 ratio: 200 * (1123/794)

  return (
    <div className="shrink-0 relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Layout</span>
          <span className="text-xs font-semibold text-indigo-300">{LAYOUTS[template]?.name}</span>
        </div>
        <span className="text-[10px] text-white/20 italic">← drag to browse →</span>
      </div>

      {/* Scrollable strip */}
      <div
        ref={stripRef}
        className="flex gap-4 px-5 pb-4 overflow-x-auto select-none"
        style={{ scrollbarWidth: "none", cursor: "grab" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {Object.values(layouts).map((l) => {
          const isActive = template === l.id;
          const T = buildTheme(l.id, templateColor);
          return (
            <button
              key={l.id}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => { if (!dragged) onSelect(l.id); }}
              className="shrink-0 flex flex-col items-center gap-2 group"
              style={{ userSelect: "none" }}
            >
              {/* Live mini preview */}
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  isActive
                    ? "ring-2 ring-indigo-400 shadow-xl shadow-indigo-500/40 scale-[1.03]"
                    : "opacity-60 hover:opacity-90 hover:ring-1 hover:ring-white/25 hover:scale-[1.01]"
                }`}
                style={{ width: PREVIEW_W, height: PREVIEW_H, background: "#fff", borderRadius: 4, pointerEvents: "none" }}
              >
                <div style={{ width: 794, height: 1123, transformOrigin: "top left", transform: `scale(${PREVIEW_W / 794})`, pointerEvents: "none" }}>
                  <DocumentPreview
                    form={form}
                    items={items || []}
                    calcs={calcs}
                    sym={sym}
                    docType={docType}
                    managerSig={managerSig}
                    template={l.id}
                    templateColor={templateColor}
                  />
                </div>
              </div>
              {/* Name label */}
              <span className={`text-[11px] font-semibold leading-none transition-colors ${isActive ? "text-indigo-300" : "text-white/35 group-hover:text-white/60"}`}>
                {l.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}