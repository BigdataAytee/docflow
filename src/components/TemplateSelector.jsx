// Font map — used by buildTheme when a custom font is specified
export const FONT_CSS_MAP = {
  inter:        "'Inter', sans-serif",
  poppins:      "'Poppins', sans-serif",
  playfair:     "'Playfair Display', serif",
  roboto:       "'Roboto', sans-serif",
  merriweather: "'Merriweather', serif",
  montserrat:   "'Montserrat', sans-serif",
  lato:         "'Lato', sans-serif",
  georgia:      "Georgia, serif",
};

// Layouts — control structural style (font is now overridden by user's typography setting)
export const LAYOUTS = {
  classic:   { id: "classic",   name: "Classic",   font: "'Inter', sans-serif" },
  modern:    { id: "modern",    name: "Modern",    font: "'Inter', sans-serif" },
  minimal:   { id: "minimal",   name: "Minimal",   font: "'Lato', sans-serif" },
  bold:      { id: "bold",      name: "Bold",      font: "'Montserrat', sans-serif" },
  elegant:   { id: "elegant",   name: "Elegant",   font: "'Playfair Display', serif" },
  sidebar:   { id: "sidebar",   name: "Sidebar",   font: "'Inter', sans-serif" },
  executive: { id: "executive", name: "Executive", font: "'Montserrat', sans-serif" },
  wave:      { id: "wave",      name: "Wave",      font: "'Poppins', sans-serif" },
  compact:   { id: "compact",   name: "Compact",   font: "'Roboto', sans-serif" },
};

// Color schemes — control all colors
export const COLOR_SCHEMES = {
  slate:      { id: "slate",      name: "Slate",         swatch: "#1e293b", headerBg: "#ffffff",  headerColor: "#1e293b", accentColor: "#1e293b",  docTitleColor: "#1e293b",  stripBg: "#f8fafc", stripBorder: "#e2e8f0", tableHeaderBg: "#f8fafc", tableHeaderColor: "#475569", totalBorder: "#1e293b"  },
  charcoal:   { id: "charcoal",   name: "Charcoal",      swatch: "#111827", headerBg: "#111827",  headerColor: "#ffffff", accentColor: "#374151",  docTitleColor: "#ffffff",  stripBg: "#f9fafb", stripBorder: "#e5e7eb", tableHeaderBg: "#f3f4f6", tableHeaderColor: "#374151", totalBorder: "#374151"  },
  navy:       { id: "navy",       name: "Navy",          swatch: "#0f172a", headerBg: "#0f172a",  headerColor: "#ffffff", accentColor: "#3b82f6",  docTitleColor: "#ffffff",  stripBg: "#f0f9ff", stripBorder: "#bae6fd", tableHeaderBg: "#f0f9ff", tableHeaderColor: "#0369a1", totalBorder: "#3b82f6"  },
  blue:       { id: "blue",       name: "Ocean Blue",    swatch: "#2563eb", headerBg: "#2563eb",  headerColor: "#ffffff", accentColor: "#2563eb",  docTitleColor: "#ffffff",  stripBg: "#eff6ff", stripBorder: "#bfdbfe", tableHeaderBg: "#eff6ff", tableHeaderColor: "#1d4ed8", totalBorder: "#2563eb"  },
  indigo:     { id: "indigo",     name: "Indigo",        swatch: "#4f46e5", headerBg: "#4f46e5",  headerColor: "#ffffff", accentColor: "#4f46e5",  docTitleColor: "#ffffff",  stripBg: "#eef2ff", stripBorder: "#c7d2fe", tableHeaderBg: "#eef2ff", tableHeaderColor: "#4338ca", totalBorder: "#4f46e5"  },
  emerald:    { id: "emerald",    name: "Emerald",       swatch: "#065f46", headerBg: "#065f46",  headerColor: "#ffffff", accentColor: "#10b981",  docTitleColor: "#ffffff",  stripBg: "#ecfdf5", stripBorder: "#a7f3d0", tableHeaderBg: "#ecfdf5", tableHeaderColor: "#065f46", totalBorder: "#10b981"  },
  teal:       { id: "teal",       name: "Teal",          swatch: "#0d9488", headerBg: "#0d9488",  headerColor: "#ffffff", accentColor: "#0d9488",  docTitleColor: "#ffffff",  stripBg: "#f0fdfa", stripBorder: "#99f6e4", tableHeaderBg: "#f0fdfa", tableHeaderColor: "#0f766e", totalBorder: "#0d9488"  },
  purple:     { id: "purple",     name: "Plum Purple",   swatch: "#4c1d95", headerBg: "#4c1d95",  headerColor: "#ffffff", accentColor: "#7c3aed",  docTitleColor: "#ffffff",  stripBg: "#f5f3ff", stripBorder: "#ddd6fe", tableHeaderBg: "#f5f3ff", tableHeaderColor: "#5b21b6", totalBorder: "#7c3aed"  },
  rose:       { id: "rose",       name: "Rose Red",      swatch: "#881337", headerBg: "#881337",  headerColor: "#ffffff", accentColor: "#e11d48",  docTitleColor: "#ffffff",  stripBg: "#fff1f2", stripBorder: "#fecdd3", tableHeaderBg: "#fff1f2", tableHeaderColor: "#9f1239", totalBorder: "#e11d48"  },
  pink:       { id: "pink",       name: "Pink",          swatch: "#be185d", headerBg: "#be185d",  headerColor: "#ffffff", accentColor: "#ec4899",  docTitleColor: "#ffffff",  stripBg: "#fdf2f8", stripBorder: "#fbcfe8", tableHeaderBg: "#fdf2f8", tableHeaderColor: "#9d174d", totalBorder: "#ec4899"  },
  amber:      { id: "amber",      name: "Amber",         swatch: "#d97706", headerBg: "#d97706",  headerColor: "#ffffff", accentColor: "#f59e0b",  docTitleColor: "#ffffff",  stripBg: "#fffbeb", stripBorder: "#fde68a", tableHeaderBg: "#fffbeb", tableHeaderColor: "#92400e", totalBorder: "#f59e0b"  },
  gold:       { id: "gold",       name: "Gold",          swatch: "#b45309", headerBg: "#fffbeb",  headerColor: "#78350f", accentColor: "#b45309",  docTitleColor: "#78350f",  stripBg: "#fef3c7", stripBorder: "#fcd34d", tableHeaderBg: "#fffbeb", tableHeaderColor: "#92400e", totalBorder: "#b45309"  },
  gray:       { id: "gray",       name: "Gray",          swatch: "#9ca3af", headerBg: "#ffffff",  headerColor: "#374151", accentColor: "#9ca3af",  docTitleColor: "#6b7280",  stripBg: "#fafafa", stripBorder: "#f3f4f6", tableHeaderBg: "#ffffff", tableHeaderColor: "#9ca3af", totalBorder: "#d1d5db"  },
  midnight:   { id: "midnight",   name: "Midnight",      swatch: "#1e1b4b", headerBg: "#1e1b4b",  headerColor: "#e0e7ff", accentColor: "#818cf8",  docTitleColor: "#e0e7ff",  stripBg: "#eef2ff", stripBorder: "#c7d2fe", tableHeaderBg: "#eef2ff", tableHeaderColor: "#4338ca", totalBorder: "#818cf8"  },
  forest:     { id: "forest",     name: "Forest",        swatch: "#14532d", headerBg: "#14532d",  headerColor: "#dcfce7", accentColor: "#22c55e",  docTitleColor: "#dcfce7",  stripBg: "#f0fdf4", stripBorder: "#bbf7d0", tableHeaderBg: "#f0fdf4", tableHeaderColor: "#15803d", totalBorder: "#22c55e"  },
  crimson:    { id: "crimson",    name: "Crimson",       swatch: "#7f1d1d", headerBg: "#7f1d1d",  headerColor: "#fee2e2", accentColor: "#ef4444",  docTitleColor: "#fee2e2",  stripBg: "#fef2f2", stripBorder: "#fecaca", tableHeaderBg: "#fef2f2", tableHeaderColor: "#b91c1c", totalBorder: "#ef4444"  },
  copper:     { id: "copper",     name: "Copper",        swatch: "#92400e", headerBg: "#92400e",  headerColor: "#fef3c7", accentColor: "#d97706",  docTitleColor: "#fef3c7",  stripBg: "#fffbeb", stripBorder: "#fde68a", tableHeaderBg: "#fffbeb", tableHeaderColor: "#92400e", totalBorder: "#d97706"  },
  sky:        { id: "sky",        name: "Sky",           swatch: "#0284c7", headerBg: "#0284c7",  headerColor: "#ffffff", accentColor: "#38bdf8",  docTitleColor: "#ffffff",  stripBg: "#f0f9ff", stripBorder: "#bae6fd", tableHeaderBg: "#f0f9ff", tableHeaderColor: "#0369a1", totalBorder: "#38bdf8"  },
  coral:      { id: "coral",      name: "Coral",         swatch: "#e7553a", headerBg: "#e7553a",  headerColor: "#ffffff", accentColor: "#f97316",  docTitleColor: "#ffffff",  stripBg: "#fff7ed", stripBorder: "#fed7aa", tableHeaderBg: "#fff7ed", tableHeaderColor: "#c2410c", totalBorder: "#f97316"  },
};

// Merge a layout + color scheme into the final theme object used by DocumentPreview / UnifiedTemplate
// Pass fontId to override the layout default with the user's chosen typography
// Pass customColor (hex) to fully override the accent/header with a brand color
export function buildTheme(layoutId, colorId, fontId, customColor) {
  const layout = LAYOUTS[layoutId] || LAYOUTS.classic;
  const color  = COLOR_SCHEMES[colorId] || COLOR_SCHEMES.slate;
  const font   = fontId ? (FONT_CSS_MAP[fontId] || layout.font) : layout.font;
  const base   = { ...color, font };
  if (customColor && /^#[0-9a-fA-F]{6}$/.test(customColor)) {
    // Override key color tokens with the custom brand color
    return {
      ...base,
      accentColor: customColor,
      headerBg: customColor,
      headerColor: "#ffffff",
      docTitleColor: "#ffffff",
      totalBorder: customColor,
      tableHeaderColor: customColor,
    };
  }
  return base;
}

// Keep for backwards-compat (used by old ViewDocument templates stored without template_color)
export const TEMPLATES = Object.fromEntries(
  Object.keys(LAYOUTS).map(lid => [lid, buildTheme(lid, "slate")])
);

// Mini visual thumbnails showing each layout's structural arrangement
export function LayoutThumb({ id, accentColor }) {
  const acc = accentColor || "#94a3b8";
  const dark = accentColor || "#1e293b";
  const light = "#e2e8f0";
  const mid = "#f1f5f9";

  if (id === "classic") return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 1, padding: 3 }}>
      <div style={{ background: dark, borderRadius: 2, padding: "3px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ width: "35%", height: 5, background: "rgba(255,255,255,0.4)", borderRadius: 1 }} />
        <div style={{ width: "30%", height: 7, background: "rgba(255,255,255,0.25)", borderRadius: 1 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        <div style={{ background: mid, borderRadius: 1, padding: 2 }}><div style={{ width: "70%", height: 2.5, background: light }} /></div>
        <div style={{ background: mid, borderRadius: 1, padding: 2 }}><div style={{ width: "70%", height: 2.5, background: light }} /></div>
      </div>
      {[85, 65, 75].map((w, i) => <div key={i} style={{ height: 2, background: light, borderRadius: 1, width: `${w}%` }} />)}
    </div>
  );

  if (id === "modern") return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 1, padding: 0 }}>
      <div style={{ background: dark, padding: "5px 4px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ width: "40%", height: 8, background: "rgba(255,255,255,0.3)", borderRadius: 1 }} />
        <div style={{ width: "35%", height: 11, background: "rgba(255,255,255,0.15)", borderRadius: 1 }} />
      </div>
      <div style={{ height: 2, background: acc }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, padding: "0 2px" }}>
        {[1,2,3].map(i => <div key={i} style={{ background: mid, height: 10, borderRadius: 1 }} />)}
      </div>
      {[1,2,3].map(i => <div key={i} style={{ height: 2, background: light, borderRadius: 1, margin: "0 2px", width: `${90-i*10}%` }} />)}
    </div>
  );

  if (id === "minimal") return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 2, padding: 3 }}>
      <div style={{ height: 2, background: acc, borderRadius: 1, marginBottom: 1 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: "40%", height: 7, background: light, borderRadius: 1 }} />
        <div style={{ width: "25%", height: 5, background: "#f3f4f6", borderRadius: 1 }} />
      </div>
      <div style={{ height: 0.5, background: "#f3f4f6" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ width: "45%", height: 5, background: light, borderRadius: 1 }} />
        <div style={{ width: "28%", height: 9, background: "#f3f4f6", borderRadius: 1 }} />
      </div>
      <div style={{ height: 0.5, background: "#f3f4f6" }} />
      {[85, 60, 70].map((w, i) => <div key={i} style={{ height: 2, background: "#f3f4f6", borderRadius: 1, width: `${w}%` }} />)}
    </div>
  );

  if (id === "bold") return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "55% 45%", flex: "0 0 45%" }}>
        <div style={{ background: dark, padding: 4, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ width: "70%", height: 5, background: "rgba(255,255,255,0.3)", borderRadius: 1 }} />
          <div style={{ width: "85%", height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 1 }} />
        </div>
        <div style={{ background: mid, padding: 4, borderLeft: `2px solid ${acc}`, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ width: "80%", height: 8, background: light, borderRadius: 1 }} />
          <div style={{ width: "70%", height: 7, background: acc, borderRadius: 2, opacity: 0.7 }} />
        </div>
      </div>
      {[85, 65, 75].map((w, i) => <div key={i} style={{ height: 2, background: light, borderRadius: 1, margin: "2px 3px", width: `${w}%` }} />)}
    </div>
  );

  if (id === "elegant") return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 1, padding: 3 }}>
      <div style={{ height: 1.5, background: acc, borderRadius: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, padding: "3px 0" }}>
        <div style={{ width: "50%", height: 5, background: light, borderRadius: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 3, width: "60%" }}>
          <div style={{ flex: 1, height: 0.5, background: acc, opacity: 0.4 }} />
          <div style={{ width: 3, height: 3, background: acc, transform: "rotate(45deg)" }} />
          <div style={{ flex: 1, height: 0.5, background: acc, opacity: 0.4 }} />
        </div>
        <div style={{ width: "35%", height: 3.5, background: mid, borderRadius: 1 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
        {[1,2,3].map(i => <div key={i} style={{ background: mid, height: 10, borderRadius: 1 }} />)}
      </div>
      {[85, 65].map((w, i) => <div key={i} style={{ height: 2, background: light, borderRadius: 1, width: `${w}%` }} />)}
      <div style={{ height: 1.5, background: acc, borderRadius: 1, marginTop: 2 }} />
    </div>
  );

  if (id === "sidebar") return (
    <div style={{ width: "100%", height: "100%", display: "flex", gap: 0 }}>
      <div style={{ width: "28%", background: dark, display: "flex", flexDirection: "column", padding: "3px 2px", gap: 2 }}>
        <div style={{ width: "80%", height: 6, background: "rgba(255,255,255,0.25)", borderRadius: 1, marginBottom: 2 }} />
        {[1,2,3,4,5].map(i => <div key={i} style={{ height: 2, background: "rgba(255,255,255,0.15)", borderRadius: 1 }} />)}
        <div style={{ marginTop: "auto", height: 2.5, background: acc, borderRadius: 1, opacity: 0.7 }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, padding: "3px 2px" }}>
        <div style={{ height: 5, background: light, borderRadius: 1, width: "70%" }} />
        <div style={{ height: 1, background: "#f3f4f6" }} />
        {[1,2,3].map(i => <div key={i} style={{ height: 2, background: "#f3f4f6", borderRadius: 1, width: `${90-i*10}%` }} />)}
        <div style={{ marginTop: "auto", height: 4, background: mid, borderRadius: 1, width: "50%", alignSelf: "flex-end" }} />
      </div>
    </div>
  );

  if (id === "executive") return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ background: dark, padding: "4px 3px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -8, top: -8, width: 30, height: 30, background: acc, opacity: 0.15, borderRadius: "50%" }} />
        <div style={{ width: "55%", height: 5, background: "rgba(255,255,255,0.3)", borderRadius: 1, marginBottom: 2 }} />
        <div style={{ width: "35%", height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 1 }} />
        <div style={{ position: "absolute", right: 3, top: 3, width: 18, height: 8, background: acc, borderRadius: 1, opacity: 0.8 }} />
      </div>
      <div style={{ height: 3, background: acc }} />
      <div style={{ flex: 1, padding: "2px 3px", display: "flex", flexDirection: "column", gap: 1 }}>
        <div style={{ display: "flex", gap: 2 }}>
          <div style={{ flex: 1, height: 8, background: mid, borderRadius: 1 }} />
          <div style={{ flex: 1, height: 8, background: mid, borderRadius: 1 }} />
        </div>
        {[80, 65, 75, 55].map((w, i) => <div key={i} style={{ height: 2, background: light, borderRadius: 1, width: `${w}%` }} />)}
      </div>
    </div>
  );

  if (id === "wave") return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ position: "relative", background: dark, padding: "5px 3px 10px" }}>
        <div style={{ width: "45%", height: 5, background: "rgba(255,255,255,0.3)", borderRadius: 1, marginBottom: 2 }} />
        <div style={{ position: "absolute", right: 3, top: 4, width: "30%", height: 8, background: acc, borderRadius: 1, opacity: 0.9 }} />
        <svg style={{ position: "absolute", bottom: -1, left: 0, width: "100%" }} viewBox="0 0 100 8" preserveAspectRatio="none" height="8">
          <path d="M0,4 C20,8 40,0 60,4 C80,8 90,2 100,4 L100,8 L0,8 Z" fill="#fff" />
        </svg>
      </div>
      <div style={{ flex: 1, padding: "2px 3px", display: "flex", flexDirection: "column", gap: 1 }}>
        <div style={{ height: 5, background: light, borderRadius: 1, width: "60%", marginBottom: 1 }} />
        {[85, 65, 75].map((w, i) => <div key={i} style={{ height: 2, background: "#f3f4f6", borderRadius: 1, width: `${w}%` }} />)}
        <div style={{ marginTop: "auto", height: 4, background: acc, borderRadius: 1, width: "40%", alignSelf: "flex-end", opacity: 0.7 }} />
      </div>
    </div>
  );

  if (id === "compact") return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 1, padding: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1.5px solid ${acc}`, paddingBottom: 2, marginBottom: 1 }}>
        <div style={{ width: "40%", height: 5, background: light, borderRadius: 1 }} />
        <div style={{ width: "22%", height: 5, background: acc, borderRadius: 1, opacity: 0.8 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
        {[1,2,3].map(i => <div key={i} style={{ background: mid, height: 8, borderRadius: 1 }} />)}
      </div>
      <div style={{ height: 1, background: "#f3f4f6" }} />
      {[90, 70, 80, 60].map((w, i) => <div key={i} style={{ height: 1.5, background: "#f3f4f6", borderRadius: 1, width: `${w}%` }} />)}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 1 }}>
        <div style={{ width: "35%", height: 5, background: acc, borderRadius: 1, opacity: 0.6 }} />
      </div>
    </div>
  );

  return null;
}

export default function TemplateSelector({ layout, color, onLayoutChange, onColorChange }) {
  return (
    <div className="space-y-3">
      {/* Layout row */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Layout</p>
        <div className="grid grid-cols-3 gap-1.5">
          {Object.values(LAYOUTS).map((l) => (
              <button
                key={l.id}
                onClick={() => onLayoutChange(l.id)}
                title={l.name}
                className={`relative rounded-lg border-2 overflow-hidden transition-all ${
                  layout === l.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                }`}
                style={{ aspectRatio: "3/4", background: "#fff" }}
              >
                <LayoutThumb id={l.id} />
                {layout === l.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                    <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
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