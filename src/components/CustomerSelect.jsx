import { useState, useRef, useEffect } from "react";
import { Search, Plus, Check, Clock, Users } from "lucide-react";

const AVATAR_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981",
  "#3b82f6","#ef4444","#14b8a6","#f97316","#84cc16",
];

function getColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
}

function Avatar({ name, size = 32 }) {
  const color = getColor(name);
  return (
    <div
      style={{ width: size, height: size, background: color, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}
    >
      {initials(name) || "?"}
    </div>
  );
}

function CustomerRow({ c, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(c.id)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors text-left group"
    >
      <Avatar name={c.full_name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-foreground truncate">{c.full_name}</span>
          {c.company_name && (
            <span className="text-xs text-muted-foreground truncate">· {c.company_name}</span>
          )}
          {c.tags?.length > 0 && c.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{tag}</span>
          ))}
        </div>
        {c.billing_address && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{c.billing_address}</p>
        )}
      </div>
      {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
    </button>
  );
}

export default function CustomerSelect({ customers, value, onSelect, onAddNew, label = "Bill To" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const selected = customers.find(c => c.id === value);

  // Track recently used (stored in sessionStorage per session)
  const [recentIds, setRecentIds] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("recent_customer_ids") || "[]"); } catch { return []; }
  });

  const saveRecent = (id) => {
    const next = [id, ...recentIds.filter(r => r !== id)].slice(0, 3);
    setRecentIds(next);
    sessionStorage.setItem("recent_customer_ids", JSON.stringify(next));
  };

  const handleSelect = (id) => {
    if (id === "__add_new__") { setOpen(false); setSearch(""); onAddNew(); return; }
    saveRecent(id);
    onSelect(id);
    setOpen(false);
    setSearch("");
  };

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? customers.filter(c =>
        c.full_name?.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q) ||
        c.billing_address?.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      )
    : customers;

  const recentCustomers = recentIds.map(id => customers.find(c => c.id === id)).filter(Boolean);
  const showRecent = !q && recentCustomers.length > 0;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 border border-input rounded-lg px-3 py-2 bg-background hover:bg-accent/50 transition-colors text-left min-h-[38px]"
      >
        {selected ? (
          <>
            <Avatar name={selected.full_name} size={28} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-foreground truncate">
                {selected.full_name}{selected.company_name ? ` — ${selected.company_name}` : ""}
              </div>
              {selected.billing_address && (
                <div className="text-xs text-muted-foreground truncate">{selected.billing_address}</div>
              )}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">Select customer…</span>
        )}
        <svg className="h-4 w-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: 360 }}>
          {/* Search bar */}
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, company, address…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto p-2 space-y-0.5" style={{ maxHeight: 280 }}>
            {/* Recently Used section */}
            {showRecent && (
              <div className="mb-1">
                <div className="flex items-center gap-1.5 px-3 py-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recently Used</span>
                </div>
                {recentCustomers.map(c => (
                  <CustomerRow key={c.id} c={c} selected={value === c.id} onSelect={handleSelect} />
                ))}
                <div className="my-1.5 border-t border-border" />
                <div className="flex items-center gap-1.5 px-3 py-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">All Customers</span>
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No customers found</p>
            ) : (
              filtered.map(c => (
                <CustomerRow key={c.id} c={c} selected={value === c.id} onSelect={handleSelect} />
              ))
            )}

            {/* Add new */}
            <div className="border-t border-border mt-1 pt-1">
              <button
                type="button"
                onClick={() => handleSelect("__add_new__")}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors text-primary font-semibold text-sm"
              >
                <Plus className="h-4 w-4" /> Add New Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}