import { useRef } from "react";
import { LAYOUTS } from "./TemplateSelector";
import DocumentPreview from "./DocumentPreview";

const CARD_W = 124;
const CARD_H = Math.round(CARD_W * (1123 / 794)); // ≈ 175px, A4 ratio

export default function LayoutPickerStrip({ layouts, template, templateColor, onSelect, form, items, calcs, sym, docType, managerSig }) {
  const listRef = useRef(null);
  const drag = useRef({ active: false, startY: 0, scrollTop: 0, moved: false });

  const onPointerDown = (e) => {
    drag.current = { active: true, startY: e.clientY, scrollTop: listRef.current.scrollTop, moved: false };
  };

  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const dy = drag.current.startY - e.clientY;
    if (Math.abs(dy) > 5) drag.current.moved = true;
    listRef.current.scrollTop = drag.current.scrollTop + dy;
  };

  const onPointerUp = () => {
    drag.current.active = false;
    // Reset moved after a tick so the click event can read it first
    setTimeout(() => { drag.current.moved = false; }, 0);
  };

  return (
    <div
      className="shrink-0 flex flex-col h-full"
      style={{ width: CARD_W + 32, background: "linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%)", borderRight: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Header */}
      <div className="px-3 pt-4 pb-2 shrink-0 border-b border-white/10">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">Layout</p>
        <p className="text-[11px] font-semibold text-indigo-300 mt-0.5">{LAYOUTS[template]?.name || "Classic"}</p>
      </div>
      <div className="px-3 py-1.5 shrink-0">
        <p className="text-[9px] text-white/20 italic text-center">↕ drag to browse</p>
      </div>

      {/* Scrollable list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 space-y-3"
        style={{ scrollbarWidth: "none", cursor: "grab", touchAction: "pan-y", userSelect: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {Object.values(layouts).map((l) => {
          const isActive = template === l.id;
          return (
            <div
              key={l.id}
              className="shrink-0 flex flex-col items-center gap-1.5 group"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                if (!drag.current.moved) {
                  onSelect(l.id);
                }
              }}
            >
              <div
                className={`overflow-hidden transition-all duration-200 w-full ${
                  isActive
                    ? "ring-2 ring-indigo-400 shadow-lg shadow-indigo-500/40 scale-[1.02]"
                    : "opacity-55 hover:opacity-85 hover:ring-1 hover:ring-white/20"
                }`}
                style={{ height: CARD_H, borderRadius: 4, background: "#fff", pointerEvents: "none" }}
              >
                <div style={{ width: 794, transformOrigin: "top left", transform: `scale(${CARD_W / 794})`, pointerEvents: "none" }}>
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
              <span className={`text-[10px] font-semibold leading-none transition-colors ${isActive ? "text-indigo-300" : "text-white/30 group-hover:text-white/60"}`}>
                {l.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}