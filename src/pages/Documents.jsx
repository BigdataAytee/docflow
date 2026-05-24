import { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Search, FileText, Plus, ChevronDown, Eye, Pencil, Copy, Trash2,
  TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, CheckCircle2,
  Send, MoreHorizontal, X, Filter
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const currencySymbols = { NGN: "₦", USD: "$", EUR: "€", GBP: "£" };
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
  rejected:  { label: "Rejected",  bg: "bg-red-50 text-red-700",          dot: "bg-red-500",       icon: X },
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
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [sortCol, setSortCol] = useState("created_date");
  const [sortDir, setSortDir] = useState("desc");
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

  const handleDelete = async (id, e) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete this document?")) return;
    await base44.entities.Document.delete(id);
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1 text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const hasFilters = search || typeFilter !== "all" || statusFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "Loading…" : `${documents.length} total · ${stats.paidCount} paid`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 active:scale-95"
            >
              <Plus className="h-4 w-4" /> New Document <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-1.5 w-48 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-20">
                <div className="p-1">
                  {docTypes.map(dt => (
                    <button
                      key={dt.value}
                      onClick={() => { navigate(`/documents/new?type=${dt.value}`); setShowDropdown(false); }}
                      className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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
                        <StatusBadge status={doc.status} />
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
                          <button onClick={(e) => handleDelete(doc.id, e)}
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