import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { format } from "date-fns";
import {
  Search, FileText, FileCheck, Receipt, Truck, Plus, Eye, Pencil,
  Trash2, Clock, Send, CheckCircle2, AlertCircle, X, PenLine
} from "lucide-react";
import { Input } from "@/components/ui/input";

const TYPE_CONFIG = {
  invoice:   { label: "Invoice",   plural: "Invoices",   icon: FileText,  gradient: "linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)", glow: "rgba(59,130,246,0.18)",  emoji: "📄" },
  quotation: { label: "Quotation", plural: "Quotations", icon: FileCheck, gradient: "linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%)", glow: "rgba(139,92,246,0.18)", emoji: "📋" },
  receipt:   { label: "Receipt",   plural: "Receipts",   icon: Receipt,   gradient: "linear-gradient(135deg,#10b981 0%,#047857 100%)", glow: "rgba(16,185,129,0.18)",  emoji: "🧾" },
  waybill:   { label: "Waybill",   plural: "Waybills",   icon: Truck,     gradient: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)", glow: "rgba(245,158,11,0.18)",  emoji: "🚚" },
};

const STATUS_CONFIG = {
  draft:          { label: "Draft",          bg: "bg-slate-100 text-slate-600" },
  sent:           { label: "Sent",           bg: "bg-blue-50 text-blue-700" },
  paid:           { label: "Paid",           bg: "bg-emerald-50 text-emerald-700" },
  overdue:        { label: "Overdue",        bg: "bg-red-50 text-red-700" },
  cancelled:      { label: "Cancelled",      bg: "bg-slate-100 text-slate-500" },
  accepted:       { label: "Accepted",       bg: "bg-emerald-50 text-emerald-700" },
  rejected:       { label: "Rejected",       bg: "bg-red-50 text-red-700" },
  to_be_signed:   { label: "To Be Signed",   bg: "bg-amber-50 text-amber-700" },
  to_be_delivered:{ label: "To Be Delivered",bg: "bg-orange-50 text-orange-700" },
  pending:        { label: "Pending",        bg: "bg-slate-100 text-slate-600" },
  packed:         { label: "Packed",         bg: "bg-blue-50 text-blue-700" },
  dispatched:     { label: "Dispatched",     bg: "bg-indigo-50 text-indigo-700" },
  in_transit:     { label: "In Transit",     bg: "bg-purple-50 text-purple-700" },
  delivered:      { label: "Delivered",      bg: "bg-emerald-50 text-emerald-700" },
  returned:       { label: "Returned",       bg: "bg-red-50 text-red-700" },
  partially_paid: { label: "Partial",        bg: "bg-teal-50 text-teal-700" },
  viewed:         { label: "Viewed",         bg: "bg-indigo-50 text-indigo-700" },
};

const currencySymbols = { NGN: "₦", USD: "$", EUR: "€", GBP: "£" };
const sym = (c) => currencySymbols[c] || "₦";

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

export default function DocumentList() {
  const location = useLocation();
  const navigate = useNavigate();
  const type = new URLSearchParams(location.search).get("type") || "invoice";
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.invoice;
  const Icon = cfg.icon;

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    setLoading(true);
    setSearch("");
    base44.auth.me().then(user => {
      if (!user) return;
      base44.entities.Document.filter({ created_by: user.email, type }, "-created_date", 200)
        .then(d => { setDocuments(d); setLoading(false); });
    });
  }, [type]);

  const filtered = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(d =>
      (d.number || "").toLowerCase().includes(q) ||
      (d.customer_name || "").toLowerCase().includes(q)
    );
  }, [documents, search]);

  const handleDelete = async (doc) => {
    setConfirmDelete(null);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    await base44.entities.Document.delete(doc.id);
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div
        className="relative rounded-3xl overflow-hidden px-6 py-7 md:px-10 md:py-9"
        style={{ background: cfg.gradient, boxShadow: `0 8px 40px ${cfg.glow}` }}
      >
        <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-36 h-36 rounded-full bg-black/10" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Documents</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
              {cfg.emoji} {cfg.plural}
            </h1>
            <p className="text-white/60 text-sm mt-1.5">
              {loading ? "Loading…" : `${filtered.length} ${cfg.label.toLowerCase()}${filtered.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => navigate(`/documents/new?type=${type}`)}
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 w-fit border border-white/20"
          >
            <Plus className="h-4 w-4" />
            New {cfg.label}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${cfg.plural.toLowerCase()} by number or customer…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-card"
        />
      </div>

      {/* List */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="h-16 w-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              {search ? "No results found" : `No ${cfg.plural.toLowerCase()} yet`}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {search ? "Try adjusting your search." : `Create your first ${cfg.label.toLowerCase()} to get started.`}
            </p>
            {!search && (
              <button
                onClick={() => navigate(`/documents/new?type=${type}`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border hover:border-primary hover:text-primary text-sm font-medium transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> New {cfg.label}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/20 border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
                    {type !== "waybill" && <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>}
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => (
                    <tr
                      key={doc.id}
                      className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/documents/${doc.id}`)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{doc.number}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium">{doc.customer_name || "—"}</div>
                        {doc.customer_email && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{doc.customer_email}</div>}
                      </td>
                      {type !== "waybill" && (
                        <td className="px-5 py-4">
                          <div className="text-sm font-bold">{sym(doc.currency)}{(doc.total || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</div>
                        </td>
                      )}
                      <td className="px-5 py-4">
                        <StatusBadge status={doc.status} />
                        {type === "waybill" && doc.status === "to_be_signed" && (
                          <a href={`/waybill-sign?id=${doc.id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors">
                            <PenLine className="h-3 w-3" /> Sign
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {doc.created_date ? format(new Date(doc.created_date), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link to={`/documents/${doc.id}`} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          <Link to={`/documents/new?edit=${doc.id}`} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <button onClick={() => setConfirmDelete(doc)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {filtered.map(doc => (
                <div key={doc.id} onClick={() => navigate(`/documents/${doc.id}`)}
                  className="flex items-start justify-between px-4 py-4 hover:bg-muted/30 active:bg-muted/50 transition-colors cursor-pointer gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-bold">{doc.number}</span>
                      <StatusBadge status={doc.status} />
                    </div>
                    <p className="text-sm font-medium truncate">{doc.customer_name || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {doc.created_date ? format(new Date(doc.created_date), "d MMM yyyy") : "—"}
                    </p>
                  </div>
                  {type !== "waybill" && (
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{sym(doc.currency)}{(doc.total || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{filtered.length}</span> of <span className="font-medium text-foreground">{documents.length}</span> {cfg.plural.toLowerCase()}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-card rounded-2xl border border-border shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-50 border border-red-100 mx-auto mb-4">
              <Trash2 className="h-5 w-5 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-center">Delete {cfg.label}?</h3>
            <p className="text-sm text-muted-foreground text-center mt-1.5 mb-5">
              <span className="font-semibold text-foreground">{confirmDelete.number}</span> for <span className="font-semibold text-foreground">{confirmDelete.customer_name}</span> will be permanently deleted.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted/50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}