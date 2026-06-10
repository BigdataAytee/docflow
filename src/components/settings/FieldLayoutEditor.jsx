import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Eye, EyeOff, Info } from "lucide-react";

const DEFAULT_SECTIONS = [
  { id: "header",       label: "Company Header",      desc: "Logo, company name & address",       required: true  },
  { id: "client",       label: "Client / Bill To",    desc: "Customer name, address & email",     required: true  },
  { id: "items",        label: "Line Items Table",    desc: "Products, quantities & prices",      required: true  },
  { id: "totals",       label: "Totals & Tax",        desc: "Subtotal, VAT, shipping & total",    required: false },
  { id: "bank",         label: "Bank / Payment Info", desc: "Bank details or payment method",     required: false },
  { id: "notes",        label: "Notes & Terms",       desc: "Custom notes and payment terms",     required: false },
  { id: "signatures",   label: "Signatures",          desc: "Authorized signatory & customer",    required: false },
  { id: "footer",       label: "Footer",              desc: "Phone, email & website",             required: false },
];

export default function FieldLayoutEditor({ layout, onChange }) {
  // layout: array of { id, visible }
  const sections = layout && layout.length > 0 ? layout : DEFAULT_SECTIONS.map(s => ({ id: s.id, visible: true }));

  const ordered = sections.map(s => {
    const meta = DEFAULT_SECTIONS.find(d => d.id === s.id);
    return { ...meta, visible: s.visible ?? true };
  }).filter(Boolean);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(ordered);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onChange(reordered.map(s => ({ id: s.id, visible: s.visible })));
  };

  const toggleVisible = (id) => {
    const meta = DEFAULT_SECTIONS.find(d => d.id === id);
    if (meta?.required) return;
    const updated = ordered.map(s => s.id === id ? { ...s, visible: !s.visible } : s);
    onChange(updated.map(s => ({ id: s.id, visible: s.visible })));
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Info className="h-3 w-3 text-muted-foreground" />
        <p className="text-[10px] text-muted-foreground">Drag to reorder · Toggle eye to show/hide</p>
      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="sections">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
              {ordered.map((section, index) => (
                <Draggable key={section.id} draggableId={section.id} index={index}>
                  {(prov, snapshot) => (
                    <div
                      ref={prov.innerRef}
                      {...prov.draggableProps}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all select-none
                        ${snapshot.isDragging ? "bg-indigo-50 border-indigo-300 shadow-lg" : section.visible ? "bg-white border-border" : "bg-muted/40 border-border opacity-50"}
                      `}
                    >
                      {/* Drag handle */}
                      <div {...prov.dragHandleProps} className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {/* Index badge */}
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0
                        ${section.visible ? "bg-indigo-100 text-indigo-600" : "bg-muted text-muted-foreground"}`}>
                        {index + 1}
                      </div>

                      {/* Label + desc */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold leading-tight ${section.visible ? "text-foreground" : "text-muted-foreground line-through"}`}>
                          {section.label}
                        </p>
                        <p className="text-[9px] text-muted-foreground/70 truncate">{section.desc}</p>
                      </div>

                      {/* Required badge */}
                      {section.required && (
                        <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wide shrink-0">Required</span>
                      )}

                      {/* Toggle visibility */}
                      {!section.required && (
                        <button
                          onClick={() => toggleVisible(section.id)}
                          className={`p-1 rounded-lg transition-colors shrink-0 ${section.visible ? "text-indigo-500 hover:bg-indigo-50" : "text-muted-foreground/30 hover:bg-muted"}`}
                        >
                          {section.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}