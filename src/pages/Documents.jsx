import { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { format } from "date-fns";
import {
  Search, FileText, Plus, Eye, Pencil, Copy, Trash2,
  TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, CheckCircle2,
  Send, MoreHorizontal, X, Filter, PenLine
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const currencySymbols = { NGN: "₦", USD: "$", EUR: "€", GBP: "£" };

const TYPE_THEMES = {
  invoice:   { gradient: "linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)", glow: "rgba(59,130,246,0.18)",  accent: "#3b82f6",  accentBg: "rgba(59,130,246,0.08)",  icon: "💼", emoji: "📄" },
  quotation: { gradient: "linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%)", glow: "rgba(139,92,246,0.18)", accent: "#8b5cf6",  accentBg: "rgba(139,92,246,0.08)", icon: "📋", emoji: "📋" },
  receipt:   { gradient: "linear-gradient(135deg,#10b981 0%,#047857 100%)", glow: "rgba(16,185,129,0.18)",  accent: "#10b981",  accentBg: "rgba(16,185,129,0.08)",  icon: "🧾", emoji: "🧾" },
  waybill:   { gradient: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)", glow: "rgba(245,158,11,0.18)",  accent: "#f59e0b",  accentBg: "rgba(245,158,11,0.08)",  icon: "🚚", emoji: "🚚" },
};
const sym = (currency) => currencySymbols[currency] || "₦";

const typeLabels = { invoice: "Invoice", quotation: "Quotation", receipt: "Receipt", waybill: "Waybill" };
const docTypes = [
  { label: "Invoice", value: "invoice" },
  { label: "Quotation", value: "quotation" },
  { label: "Receipt", value: "receipt" },
  { label: "Waybill", value: "waybill" },
];

const STATUS_CONFIG = {
  draft:     { label: "Draft",     bg: "bg-slate-100 text-slate-600",     dot: "bg-slate-400",     icon: Clock },
  sent:      { label: "Sent",      bg: "bg-blue-50 text-blue-700",        dot: "bg-blue-500",      icon: Send },
  paid:      { label: "Paid",      bg: "bg-emerald-50 text-emerald-700",  dot: "bg-emerald-500",   icon: CheckCircle2 },
  overdue:   { label: "Overdue",   bg: "bg-red-50 text-red-700",          dot: "bg-red-500",       icon: AlertCircle },
  cancelled: { label: "Cancelled", bg: "bg-slate-100 text-slate-500",     dot: "bg-slate-400",     icon: X },
  accepted:  { label: "Accepted",  bg: "bg-emerald-50 text-emerald-700",  dot: "bg-emerald-500",   icon: CheckCircle2 },
  rejected:    { label: "Rejected",    bg: "bg-red-50 text-red-700",     dot: "bg-red-500",     icon: X },
  to_be_signed:    { label: "To Be Signed",    bg: "bg-amber-50 text-amber-700",   dot: "bg-amber-500",  icon: PenLine },
  to_be_delivered: { label: "To Be Delivered", bg: "bg-orange-50 text-orange-700", dot: "bg-orange-500", icon: PenLine },
  pending:      { label: "Pending",      bg: "bg-slate-100 text-slate-600", dot: "bg-slate-400",  icon: Clock },
  packed:       { label: "Packed",       bg: "bg-blue-50 text-blue-700",   dot: "bg-blue-500",   icon: CheckCircle2 },
  dispatched:   { label: "Dispatched",   bg: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500", icon: Send },
  in_transit:   { label: "In Transit",   bg: "bg-purple-50 text-purple-700", dot: "bg-purple-500", icon: Send },
  delivered:    { label: "Delivered",    bg: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
  returned:     { label: "Returned",     bg: "bg-red-50 text-red-700",     dot: "bg-red-500",     icon: X },
  partially_paid: { label: "Partial",    bg: "bg-teal-50 text-teal-700",   dot: "bg-teal-500",   icon: CheckCircle2 },
  viewed:       { label: "Viewed",       bg: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500", icon: Eye },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function StatCard({ title, value, sub, icon: Icon, trend, color }) {
  const colorMap = {
    blue:  { bg: "bg-blue-50",     icon: "text-blue-500",    border: "border-blue-100" },
    green: { bg: "bg-emerald-50",  icon: "text-emerald-500", border: "border-emerald-100" },
    red:   { bg: "bg-red-50",      icon: "text-red-500",     border: "border-red-100" },
    slate: { bg: "bg-slate-50",    icon: "text-slate-500",   border: "border-slate-100" },
  };
  const c = colorMap[color] || colorMap.slate;
  return (
    <div className={`bg-card border border-border rounded-xl p-5 flex items-start gap-4`}>
      <div className={`h-10 w-10 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center shrink-0`}>
        <Icon className={`h-5 w-5 ${c.icon}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
        <p className="text-xl font-bold text-foreground leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

function UndoToast({ doc, startedAt, onUndo }) {
  const [remaining, setRemaining] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, 10 - elapsed);
      setRemaining(Math.ceil(left));
      if (left <= 0) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  }, [startedAt]);

  const progress = (remaining / 10) * 100;

  return (
    <div className="pointer-events-auto bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 w-full max-w-sm">
      <div className="relative h-8 w-8 shrink-0">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
          <circle cx="16" cy="16" r="13" fill="none" stroke="#ef4444" strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 13}`}
            strokeDashoffset={`${2 * Math.PI * 13 * (1 - progress / 100)}`}
            style={{ transition: "stroke-dashoffset 0.2s linear" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">{remaining}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Document deleted</p>
        <p className="text-xs text-white/50 truncate">{doc.number} · {doc.customer_name}</p>
      </div>
      <button
        onClick={onUndo}
        className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-white text-slate-900 rounded-lg hover:bg-white/90 transition-colors"
      >
        Undo
      </button>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-t border-border">
      {[1,2,3,4,5,6].map(i => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 bg-muted animate-pulse rounded-md" style={{ width: `${[60,80,50,45,55,30][i-1]}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const urlTypeInit = new URLSearchParams(window.location.search).get("type") || "all";
  const [typeFilter, setTypeFilter] = useState(urlTypeInit);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortCol, setSortCol] = useState("created_date");
  const [sortDir, setSortDir] = useState("desc");
  const [pendingDeletes, setPendingDeletes] = useState([]);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Sync typeFilter with URL param
  useEffect(() => {
    const urlType = new URLSearchParams(location.search).get("type");
    setTypeFilter(urlType || "all");
  }, [location.search]);



  useEffect(() => {
    base44.auth.me().then(user => {
      if (!user) return;
      base44.entities.Document.filter({ created_by: user.email }, "-created_date", 200).then(d => {
        setDocuments(d);
        setLoading(false);
      });
    });
  }, []);

  const stats = useMemo(() => {
    const paid       = documents.filter(d => d.status === "paid");
    const outstanding = documents.filter(d => ["sent","accepted"].includes(d.status));
    const overdue    = documents.filter(d => d.status === "overdue");
    const sum = (arr) => arr.reduce((s, d) => s + (d.total || 0), 0);
    const now = new Date();
    const thisMonth = documents.filter(d => {
      const dt = d.created_date ? new Date(d.created_date) : null;
      return dt && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    });
    return {
      total: documents.length,
      revenue: sum(paid),
      outstanding: sum(outstanding),
      overdue: sum(overdue),
      thisMonth: thisMonth.length,
      paidCount: paid.length,
    };
  }, [documents]);

  const primaryCurrency = documents[0]?.currency || "NGN";

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    let result = documents.filter(d => {
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (search && !(d.number || "").toLowerCase().includes(search.toLowerCase()) &&
          !(d.customer_name || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    result = [...result].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (sortCol === "total") { av = av || 0; bv = bv || 0; }
      else if (sortCol === "created_date") { av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0; }
      else { av = (av || "").toLowerCase(); bv = (bv || "").toLowerCase(); }
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return result;
  }, [documents, search, typeFilter, statusFilter, sortCol, sortDir]);

  const handleDelete = (doc, e) => {
    e.preventDefault(); e.stopPropagation();
    setConfirmDeleteDoc(doc);
  };

  const handleDeleteConfirmed = (doc) => {
    setConfirmDeleteDoc(null);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    const timeoutId = setTimeout(async () => {
      await base44.entities.Document.delete(doc.id);
      setPendingDeletes(prev => prev.filter(p => p.doc.id !== doc.id));
    }, 10000);
    setPendingDeletes(prev => [...prev, { doc, timeoutId, startedAt: Date.now() }]);
  };

  const handleUndoDelete = (docId) => {
    const entry = pendingDeletes.find(p => p.doc.id === docId);
    if (!entry) return;
    clearTimeout(entry.timeoutId);
    setDocuments(prev => [...prev, entry.doc].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setPendingDeletes(prev => prev.filter(p => p.doc.id !== docId));
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1 text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const hasFilters = search || typeFilter !== "all" || statusFilter !== "all";

  const theme = typeFilter !== "all" ? TYPE_THEMES[typeFilter] : null;

  return (
    <div className="space-y-6">
      {/* Themed header banner */}
      {theme ? (
        <div
          className="relative rounded-3xl overflow-hidden px-6 py-7 md:px-10 md:py-9"
          style={{ background: theme.gradient, boxShadow: `0 8px 40px ${theme.glow}` }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 -left-6 w-36 h-36 rounded-full bg-black/10" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Documents</p>
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                {theme.emoji} {typeLabels[typeFilter]}s
              </h1>
              <p className="text-white/60 text-sm mt-1.5">
                {loading ? "Loading…" : `${filtered.length} document${filtered.length !== 1 ? "s" : ""} · ${stats.paidCount} paid`}
              </p>
            </div>
            <button
              onClick={() => navigate(`/documents/new?type=${typeFilter}`)}
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 w-fit border border-white/20"
            >
              <Plus className="h-4 w-4" />
              New {typeLabels[typeFilter]}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? "Loading…" : `${documents.length} total · ${stats.paidCount} paid`}
            </p>
          </div>
          <button
            onClick={() => navigate("/documents/new?type=invoice")}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 active:scale-95"
          >
            <Plus className="h-4 w-4" /> New Invoice
          </button>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Filter bar */}
        <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by number or customer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-full bg-muted/40 border-transparent focus:border-border focus:bg-background transition-all"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="flex-1 sm:w-[140px] bg-muted/40 border-transparent">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 sm:w-[130px] bg-muted/40 border-transparent">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.keys(STATUS_CONFIG).map(s =>
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                )}
              </SelectContent>
            </Select>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); }}
                className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Desktop table */}
        {loading ? (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  {["Document","Customer","Amount","Status","Date",""].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}</tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="h-16 w-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
            </div>
            {documents.length === 0 ? (
              <>
                <h3 className="font-semibold text-foreground mb-1">No documents yet</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Create your first invoice, quotation, receipt, or waybill to get started.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {docTypes.map(dt => (
                    <button key={dt.value} onClick={() => navigate(`/documents/new?type=${dt.value}`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border hover:border-primary hover:text-primary text-sm font-medium transition-all">
                      <Plus className="h-3.5 w-3.5" /> {dt.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-foreground mb-1">No results found</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
                <button onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); }}
                  className="mt-4 text-sm text-primary font-medium hover:underline">Clear filters</button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/20 border-b border-border">
                    <th onClick={() => toggleSort("number")} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">
                      Document <SortIcon col="number" />
                    </th>
                    <th onClick={() => toggleSort("customer_name")} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">
                      Customer <SortIcon col="customer_name" />
                    </th>
                    <th onClick={() => toggleSort("total")} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">
                      Amount <SortIcon col="total" />
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th onClick={() => toggleSort("created_date")} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">
                      Date <SortIcon col="created_date" />
                    </th>
                    <th className="px-5 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => (
                    <tr
                      key={doc.id}
                      className="border-t border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                      onMouseEnter={() => setHoveredRow(doc.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{doc.number}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{typeLabels[doc.type]}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-foreground">{doc.customer_name || "—"}</div>
                        {doc.customer_email && <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{doc.customer_email}</div>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-bold text-foreground">{sym(doc.currency)}{(doc.total || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5">
                          <StatusBadge status={doc.status} />
                          {doc.type === "waybill" && doc.status === "to_be_signed" && (
                            <a
                              href={`/waybill-sign?id=${doc.id}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors w-fit"
                            >
                              <PenLine className="h-3 w-3" /> Sign Now
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {doc.created_date ? format(new Date(doc.created_date), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className={`flex items-center gap-1 transition-opacity ${hoveredRow === doc.id ? "opacity-100" : "opacity-0"}`}>
                          <Link to={`/documents/${doc.id}`}
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          <Link to={`/documents/new?edit=${doc.id}`}
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <button onClick={(e) => handleDelete(doc, e)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" title="Delete">
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
                <Link key={doc.id} to={`/documents/${doc.id}`}
                  className="flex items-start justify-between px-4 py-4 hover:bg-muted/30 active:bg-muted/50 transition-colors gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">{doc.number}</span>
                      <StatusBadge status={doc.status} />
                      {doc.type === "waybill" && doc.status === "to_be_signed" && (
                        <a
                          href={`/waybill-sign?id=${doc.id}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors"
                        >
                          <PenLine className="h-3 w-3" /> Sign Now
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-foreground font-medium truncate">{doc.customer_name || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {typeLabels[doc.type]} · {doc.created_date ? format(new Date(doc.created_date), "d MMM yyyy") : "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{sym(doc.currency)}{(doc.total || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Confirm Delete Modal */}
      {confirmDeleteDoc && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDeleteDoc(null)}>
          <div className="bg-card rounded-2xl border border-border shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-50 border border-red-100 mx-auto mb-4">
              <Trash2 className="h-5 w-5 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-center text-foreground">Delete Document?</h3>
            <p className="text-sm text-muted-foreground text-center mt-1.5 mb-5">
              <span className="font-semibold text-foreground">{confirmDeleteDoc.number}</span> for <span className="font-semibold text-foreground">{confirmDeleteDoc.customer_name}</span> will be deleted. This can be undone within 10 seconds.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteDoc(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConfirmed(confirmDeleteDoc)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Delete Toasts */}
      <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none" style={{ minWidth: 320 }}>
        {pendingDeletes.map(({ doc, startedAt }) => (
          <UndoToast
            key={doc.id}
            doc={doc}
            startedAt={startedAt}
            onUndo={() => handleUndoDelete(doc.id)}
          />
        ))}
      </div>

      {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{filtered.length}</span> of <span className="font-medium text-foreground">{documents.length}</span> documents
            </span>
          </div>
        )}
      </div>
    </div>
  );
}