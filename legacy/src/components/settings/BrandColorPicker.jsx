import { useState, useRef, useEffect } from "react";
import { Pipette, Check, ChevronDown } from "lucide-react";

// Predefined brand-friendly swatches
const SWATCHES = [
  "#0f172a","#1e293b","#334155","#475569",
  "#1e1b4b","#312e81","#4f46e5","#6366f1",
  "#1d4ed8","#2563eb","#3b82f6","#60a5fa",
  "#0369a1","#0284c7","#0ea5e9","#38bdf8",
  "#0d9488","#14b8a6","#2dd4bf","#0f766e",
  "#059669","#10b981","#34d399","#065f46",
  "#15803d","#16a34a","#4ade80","#166534",
  "#d97706","#f59e0b","#fbbf24","#92400e",
  "#b45309","#ca8a04","#eab308","#854d0e",
  "#c2410c","#ea580c","#f97316","#9a3412",
  "#e11d48","#f43f5e","#fb7185","#9f1239",
  "#be185d","#ec4899","#f472b6","#831843",
  "#7c3aed","#8b5cf6","#a78bfa","#4c1d95",
  "#6d28d9","#7c3aed","#9333ea","#a21caf",
  "#7f1d1d","#991b1b","#b91c1c","#dc2626",
  "#111827","#1f2937","#374151","#4b5563",
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}

function isValidHex(h) { return /^#[0-9a-fA-F]{6}$/.test(h); }

export default function BrandColorPicker({ value, onChange, label = "Brand Color" }) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value || "#4f46e5");
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => { setInputVal(value || "#4f46e5"); }, [value]);

  const apply = (hex) => {
    if (!isValidHex(hex)) return;
    setInputVal(hex);
    onChange(hex);
  };

  const displayColor = isValidHex(value) ? value : "#4f46e5";

  return (
    <div className="relative" ref={panelRef}>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full border border-border rounded-xl px-3 py-2 hover:bg-muted/40 transition-colors"
      >
        <div className="w-6 h-6 rounded-lg border border-border/50 shrink-0 shadow-sm" style={{ background: displayColor }} />
        <span className="text-sm font-mono font-semibold flex-1 text-left">{displayColor.toUpperCase()}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1.5 w-64 bg-white border border-border rounded-2xl shadow-xl p-3 space-y-3">
          {/* Hex input */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg border border-border shrink-0" style={{ background: isValidHex(inputVal) ? inputVal : "#e2e8f0" }} />
            <input
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onBlur={() => apply(inputVal)}
              onKeyDown={e => e.key === "Enter" && apply(inputVal)}
              maxLength={7}
              placeholder="#000000"
              className="flex-1 font-mono text-sm border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {/* Native color input */}
            <label className="cursor-pointer p-1.5 rounded-lg hover:bg-muted transition-colors" title="Pick color">
              <Pipette className="h-4 w-4 text-muted-foreground" />
              <input type="color" value={isValidHex(inputVal) ? inputVal : "#4f46e5"}
                onChange={e => { setInputVal(e.target.value); apply(e.target.value); }}
                className="sr-only" />
            </label>
          </div>

          {/* Swatches grid */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Brand Swatches</p>
            <div className="grid grid-cols-8 gap-1">
              {SWATCHES.map(sw => (
                <button key={sw} onClick={() => { apply(sw); setOpen(false); }}
                  title={sw}
                  className="w-6 h-6 rounded-md border-2 transition-all hover:scale-110 relative"
                  style={{ background: sw, borderColor: sw === value ? "#fff" : "transparent", outline: sw === value ? `2px solid ${sw}` : "none" }}>
                  {sw === value && <Check className="h-3 w-3 text-white absolute inset-0 m-auto drop-shadow" />}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setOpen(false)}
            className="w-full py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors">
            Done
          </button>
        </div>
      )}
    </div>
  );
}