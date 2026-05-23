export const TEMPLATES = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "Clean & professional",
    headerBg: "#ffffff",
    headerColor: "#1e293b",
    accentColor: "#1e293b",
    stripBg: "#f8fafc",
    stripBorder: "#e2e8f0",
    tableHeaderBg: "#f8fafc",
    tableHeaderColor: "#475569",
    totalBorder: "#1e293b",
    font: "'Helvetica Neue', Arial, sans-serif",
    docTitleColor: "#1e293b",
    swatch: ["#ffffff", "#1e293b", "#f8fafc"],
  },
  modern: {
    id: "modern",
    name: "Modern",
    description: "Dark & sophisticated",
    headerBg: "#0f172a",
    headerColor: "#ffffff",
    accentColor: "#3b82f6",
    stripBg: "#f0f9ff",
    stripBorder: "#bae6fd",
    tableHeaderBg: "#f0f9ff",
    tableHeaderColor: "#0369a1",
    totalBorder: "#3b82f6",
    font: "'Helvetica Neue', Arial, sans-serif",
    docTitleColor: "#ffffff",
    swatch: ["#0f172a", "#3b82f6", "#f0f9ff"],
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Simple & clean",
    headerBg: "#ffffff",
    headerColor: "#374151",
    accentColor: "#9ca3af",
    stripBg: "#fafafa",
    stripBorder: "#f3f4f6",
    tableHeaderBg: "#ffffff",
    tableHeaderColor: "#9ca3af",
    totalBorder: "#d1d5db",
    font: "'Helvetica Neue', Arial, sans-serif",
    docTitleColor: "#6b7280",
    swatch: ["#ffffff", "#9ca3af", "#fafafa"],
  },
  bold: {
    id: "bold",
    name: "Bold",
    description: "Vivid & impactful",
    headerBg: "#2563eb",
    headerColor: "#ffffff",
    accentColor: "#2563eb",
    stripBg: "#eff6ff",
    stripBorder: "#bfdbfe",
    tableHeaderBg: "#eff6ff",
    tableHeaderColor: "#1d4ed8",
    totalBorder: "#2563eb",
    font: "'Helvetica Neue', Arial, sans-serif",
    docTitleColor: "#ffffff",
    swatch: ["#2563eb", "#ffffff", "#eff6ff"],
  },
  elegant: {
    id: "elegant",
    name: "Elegant",
    description: "Warm & refined",
    headerBg: "#fffbeb",
    headerColor: "#78350f",
    accentColor: "#b45309",
    stripBg: "#fef3c7",
    stripBorder: "#fcd34d",
    tableHeaderBg: "#fffbeb",
    tableHeaderColor: "#92400e",
    totalBorder: "#b45309",
    font: "Georgia, 'Times New Roman', serif",
    docTitleColor: "#78350f",
    swatch: ["#fffbeb", "#b45309", "#fef3c7"],
  },
};

export default function TemplateSelector({ value, onChange }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Template</p>
      <div className="grid grid-cols-5 gap-1.5">
        {Object.values(TEMPLATES).map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            title={t.name}
            className={`relative rounded-lg border-2 overflow-hidden transition-all ${
              value === t.id
                ? "border-primary ring-2 ring-primary/30 scale-105"
                : "border-border hover:border-primary/50"
            }`}
            style={{ aspectRatio: "3/4" }}
          >
            {/* Mini document mockup */}
            <div className="w-full h-full" style={{ background: t.headerBg }}>
              {/* Header band */}
              <div style={{ background: t.headerBg, borderBottom: `2px solid ${t.accentColor}`, padding: "3px 4px" }}>
                <div style={{ background: t.accentColor, height: 3, borderRadius: 1, width: "60%", marginBottom: 2 }} />
                <div style={{ background: t.headerColor, height: 2, borderRadius: 1, width: "40%", opacity: 0.3 }} />
              </div>
              {/* Strip */}
              <div style={{ background: t.stripBg, padding: "2px 4px", display: "flex", gap: 3 }}>
                <div style={{ flex: 1, background: t.headerColor, height: 2, borderRadius: 1, opacity: 0.15 }} />
                <div style={{ flex: 1, background: t.headerColor, height: 2, borderRadius: 1, opacity: 0.15 }} />
              </div>
              {/* Lines */}
              <div style={{ padding: "3px 4px", display: "flex", flexDirection: "column", gap: 2 }}>
                {[80, 60, 70, 50].map((w, i) => (
                  <div key={i} style={{ background: "#e2e8f0", height: 1.5, borderRadius: 1, width: `${w}%` }} />
                ))}
              </div>
              {/* Footer accent */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: t.accentColor, opacity: 0.6 }} />
            </div>
            {value === t.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-center text-muted-foreground mt-1.5 font-medium">
        {TEMPLATES[value]?.name} — <span className="text-muted-foreground/70">{TEMPLATES[value]?.description}</span>
      </p>
    </div>
  );
}