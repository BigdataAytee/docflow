import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, FileText, Users, Settings, Plus, Mail, ArrowRight, Hash } from "lucide-react";

const NAV_ITEMS = [
  { label: "Documents", icon: FileText, path: "/documents", group: "Navigate" },
  { label: "Customers", icon: Users, path: "/customers", group: "Navigate" },
  { label: "Mail", icon: Mail, path: "/mail", group: "Navigate" },
  { label: "Settings", icon: Settings, path: "/settings", group: "Navigate" },
];

const CREATE_ITEMS = [
  { label: "New Invoice", icon: Plus, path: "/documents/new?type=invoice", group: "Create" },
  { label: "New Quotation", icon: Plus, path: "/documents/new?type=quotation", group: "Create" },
  { label: "New Receipt", icon: Plus, path: "/documents/new?type=receipt", group: "Create" },
  { label: "New Waybill", icon: Plus, path: "/documents/new?type=waybill", group: "Create" },
];

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      base44.auth.me().then(user => {
        if (!user) return;
        base44.entities.Document.filter({ created_by: user.email }, "-created_date", 50).then(setDocs);
        base44.entities.Customer.filter({ created_by: user.email }, "-created_date", 50).then(setCustomers);
      });
    }
  }, [open]);

  const results = useCallback(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [...NAV_ITEMS, ...CREATE_ITEMS];

    const docResults = docs
      .filter(d => (d.number || "").toLowerCase().includes(q) || (d.customer_name || "").toLowerCase().includes(q))
      .slice(0, 5)
      .map(d => ({ label: d.number, sublabel: d.customer_name, icon: FileText, path: `/documents/${d.id}`, group: "Documents" }));

    const custResults = customers
      .filter(c => (c.full_name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q))
      .slice(0, 3)
      .map(c => ({ label: c.full_name, sublabel: c.email, icon: Users, path: `/customers`, group: "Customers" }));

    const navResults = [...NAV_ITEMS, ...CREATE_ITEMS].filter(i => i.label.toLowerCase().includes(q));

    return [...docResults, ...custResults, ...navResults];
  }, [query, docs, customers]);

  const items = results();

  const go = (item) => {
    navigate(item.path);
    onClose();
  };

  useEffect(() => { setActiveIndex(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") setActiveIndex(i => Math.min(i + 1, items.length - 1));
      if (e.key === "ArrowUp") setActiveIndex(i => Math.max(i - 1, 0));
      if (e.key === "Enter" && items[activeIndex]) go(items[activeIndex]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, items, activeIndex]);

  if (!open) return null;

  const groups = items.reduce((acc, item, idx) => {
    const g = item.group || "Other";
    if (!acc[g]) acc[g] = [];
    acc[g].push({ ...item, _idx: idx });
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search documents, customers, actions..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted border border-border rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[380px] overflow-y-auto py-2">
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results found</div>
          )}
          {Object.entries(groups).map(([groupName, groupItems]) => (
            <div key={groupName}>
              <div className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{groupName}</div>
              {groupItems.map(item => (
                <button
                  key={item._idx}
                  onClick={() => go(item)}
                  onMouseEnter={() => setActiveIndex(item._idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    activeIndex === item._idx ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                  }`}
                >
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                    activeIndex === item._idx ? "bg-primary/15" : "bg-muted"
                  }`}>
                    <item.icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.label}</div>
                    {item.sublabel && <div className="text-xs text-muted-foreground truncate">{item.sublabel}</div>}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}