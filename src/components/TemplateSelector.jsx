// Layouts — control font & structural style
export const LAYOUTS = {
  classic:  { id: "classic",  name: "Classic",  font: "'Helvetica Neue', Arial, sans-serif" },
  modern:   { id: "modern",   name: "Modern",   font: "'Helvetica Neue', Arial, sans-serif" },
  minimal:  { id: "minimal",  name: "Minimal",  font: "'Helvetica Neue', Arial, sans-serif" },
  bold:     { id: "bold",     name: "Bold",     font: "'Helvetica Neue', Arial, sans-serif" },
  elegant:  { id: "elegant",  name: "Elegant",  font: "Georgia, 'Times New Roman', serif" },
};

// Color schemes — control all colors
export const COLOR_SCHEMES = {
  slate:    { id: "slate",   name: "Slate",    swatch: "#1e293b", headerBg: "#ffffff", headerColor: "#1e293b", accentColor: "#1e293b",  docTitleColor: "#1e293b",  stripBg: "#f8fafc", stripBorder: "#e2e8f0", tableHeaderBg: "#f8fafc", tableHeaderColor: "#475569", totalBorder: "#1e293b"  },
  navy:     { id: "navy",    name: "Navy",     swatch: "#0f172a", headerBg: "#0f172a", headerColor: "#ffffff", accentColor: "#3b82f6",  docTitleColor: "#ffffff",  stripBg: "#f0f9ff", stripBorder: "#bae6fd", tableHeaderBg: "#f0f9ff", tableHeaderColor: "#0369a1", totalBorder: "#3b82f6"  },
  blue:     { id: "blue",    name: "Blue",     swatch: "#2563eb", headerBg: "#2563eb", headerColor: "#ffffff", accentColor: "#2563eb",  docTitleColor: "#ffffff",  stripBg: "#eff6ff", stripBorder: "#bfdbfe", tableHeaderBg: "#eff6ff", tableHeaderColor: "#1d4ed8", totalBorder: "#2563eb"  },
  emerald:  { id: "emerald", name: "Emerald",  swatch: "#065f46", headerBg: "#065f46", headerColor: "#ffffff", accentColor: "#10b981",  docTitleColor: "#ffffff",  stripBg: "#ecfdf5", stripBorder: "#a7f3d0", tableHeaderBg: "#ecfdf5", tableHeaderColor: "#065f46", totalBorder: "#10b981"  },
  purple:   { id: "purple",  name: "Purple",   swatch: "#4c1d95", headerBg: "#4c1d95", headerColor: "#ffffff", accentColor: "#7c3aed",  docTitleColor: "#ffffff",  stripBg: "#f5f3ff", stripBorder: "#ddd6fe", tableHeaderBg: "#f5f3ff", tableHeaderColor: "#5b21b6", totalBorder: "#7c3aed"  },
  rose:     { id: "rose",    name: "Rose",     swatch: "#881337", headerBg: "#881337", headerColor: "#ffffff", accentColor: "#e11d48",  docTitleColor: "#ffffff",  stripBg: "#fff1f2", stripBorder: "#fecdd3", tableHeaderBg: "#fff1f2", tableHeaderColor: "#9f1239", totalBorder: "#e11d48"  },
  gold:     { id: "gold",    name: "Gold",     swatch: "#b45309", headerBg: "#fffbeb", headerColor: "#78350f", accentColor: "#b45309",  docTitleColor: "#78350f",  stripBg: "#fef3c7", stripBorder: "#fcd34d", tableHeaderBg: "#fffbeb", tableHeaderColor: "#92400e", totalBorder: "#b45309"  },
  gray:     { id: "gray",    name: "Gray",     swatch: "#9ca3af", headerBg: "#ffffff", headerColor: "#374151", accentColor: "#9ca3af",  docTitleColor: "#6b7280",  stripBg: "#fafafa", stripBorder: "#f3f4f6", tableHeaderBg: "#ffffff", tableHeaderColor: "#9ca3af", totalBorder: "#d1d5db"  },
};

// Merge a layout + color scheme into the final theme object used by DocumentPreview / UnifiedTemplate
export function buildTheme(layoutId, colorId) {
  const layout = LAYOUTS[layoutId] || LAYOUTS.classic;
  const color  = COLOR_SCHEMES[colorId]  || COLOR_SCHEMES.slate;
  return { ...color, font: layout.font };
}

// Keep for backwards-compat (used by old ViewDocument templates stored without template_color)
export const TEMPLATES = Object.fromEntries(
  Object.keys(LAYOUTS).map(lid => [lid, buildTheme(lid, "slate")])
);

export default function TemplateSelector({ layout, color, onLayoutChange, onColorChange }) {
  return (
    <div className="space-y-3">
      {/* Layout row */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Layout</p>
        <div className="grid grid-cols-5 gap-1.5">
          {Object.values(LAYOUTS).map((l) => {
            const isSerifFont = l.font.startsWith("Georgia");
            return (
              <button
                key={l.id}
                onClick={() => onLayoutChange(l.id)}
                title={l.name}
                className={`relative rounded-lg border-2 overflow-hidden transition-all ${
                  layout === l.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                }`}
                style={{ aspectRatio: "3/4" }}
              >
                <div className="w-full h-full bg-white p-1 flex flex-col gap-0.5">
                  <div className="bg-slate-800 rounded-sm" style={{ height: "28%", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 3px" }}>
                    <div className="bg-white/30 rounded-sm" style={{ width: "45%", height: 4 }} />
                  </div>
                  <div className="bg-slate-100 rounded-sm" style={{ height: "14%" }} />
                  {[70, 55, 65, 50].map((w, i) => (
                    <div key={i} className="bg-slate-200 rounded-sm" style={{ height: 3, width: `${w}%`, marginTop: 1, fontFamily: isSerifFont ? "Georgia" : undefined }} />
                  ))}
                </div>
                {layout === l.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                    <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{LAYOUTS[layout]?.name}</p>
      </div>

      {/* Color scheme row */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Colour</p>
        <div className="flex flex-wrap gap-2">
          {Object.values(COLOR_SCHEMES).map((c) => (
            <button
              key={c.id}
              onClick={() => onColorChange(c.id)}
              title={c.name}
              className={`w-6 h-6 rounded-full border-2 transition-all ${
                color === c.id ? "border-primary ring-2 ring-primary/30 scale-110" : "border-transparent hover:scale-105"
              }`}
              style={{ background: c.swatch }}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{COLOR_SCHEMES[color]?.name}</p>
      </div>
    </div>
  );
}