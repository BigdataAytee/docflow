import { useState } from "react";
import { ShoppingBag, ChevronRight, Hash, Layers } from "lucide-react";

const COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6"];

export default function TopOrderedGoods({ items, colors = COLORS, onDrillDown }) {
  const [mode, setMode] = useState("units"); // "units" | "frequency"

  const getValue = (item) => mode === "units" ? item.qty : item.count;
  const getLabel = (item) => mode === "units"
    ? `${item.qty} unit${item.qty !== 1 ? "s" : ""}`
    : `${item.count} doc${item.count !== 1 ? "s" : ""}`;
  const getSub = (item) => mode === "units"
    ? `In ${item.count} document${item.count !== 1 ? "s" : ""}`
    : `${item.qty} total unit${item.qty !== 1 ? "s" : ""}`;

  const maxVal = Math.max(...items.map(getValue)) || 1;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Top 5 Most Ordered Goods</h3>
            <p className="text-[11px] text-muted-foreground">
              {mode === "units" ? "Ranked by total units sold" : "Ranked by document frequency"}
            </p>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          <button
            onClick={() => setMode("units")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === "units" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Layers className="h-3 w-3" /> Units
          </button>
          <button
            onClick={() => setMode("frequency")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === "frequency" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Hash className="h-3 w-3" /> Frequency
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {items.map((item, i) => {
          const val = getValue(item);
          const pct = (val / maxVal) * 100;
          const color = colors[i % colors.length];
          return (
            <div key={item.name}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors group"
              onClick={() => onDrillDown?.(item)}>
              {/* Rank badge */}
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: color }}>
                {i + 1}
              </div>

              {/* Bar + labels */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-sm font-semibold truncate">{item.name}</p>
                  <span className="text-sm font-bold ml-2 shrink-0" style={{ color }}>{getLabel(item)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: color }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{getSub(item)}</p>
              </div>

              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}