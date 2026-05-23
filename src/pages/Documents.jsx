import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { Search, FileText, Plus, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const typeLabels = {
  invoice: "Invoice", quotation: "Quotation", receipt: "Receipt", waybill: "Waybill",
};

const statusColors = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-600",
  paid: "bg-emerald-50 text-emerald-600",
  overdue: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
  accepted: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-600",
};

const docTypes = [
  { label: "Invoice", value: "invoice" },
  { label: "Quotation", value: "quotation" },
  { label: "Receipt", value: "receipt" },
  { label: "Waybill", value: "waybill" },
];

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    base44.entities.Document.list("-created_date", 200).then(d => { setDocuments(d); setLoading(false); });
  }, []);

  const filtered = documents.filter(d => {
    if (typeFilter !== "all" && d.type !== typeFilter) return false;
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (search && !(d.number || "").toLowerCase().includes(search.toLowerCase()) && !(d.customer_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{documents.length} total documents</p>
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Document <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
          </button>
          {showDropdown && (
            <div className="absolute right-0 mt-1 w-44 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-20">
              {docTypes.map(dt => (
                <button
                  key={dt.value}
                  onClick={() => { navigate(`/documents/new?type=${dt.value}`); setShowDropdown(false); }}
                  className="block w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                >
                  {dt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border">
        <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by number or customer..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9 w-full" />
          </div>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="flex-1 sm:w-[150px]"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 sm:w-[130px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {["draft", "sent", "paid", "overdue", "cancelled"].map(s =>
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No documents found</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Document</th>
                    <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => (
                    <tr key={doc.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/documents/${doc.id}`} className="text-sm font-medium hover:text-primary">{doc.number}</Link>
                        <p className="text-xs text-muted-foreground">{typeLabels[doc.type]}</p>
                      </td>
                      <td className="px-6 py-4 text-sm">{doc.customer_name}</td>
                      <td className="px-6 py-4 text-sm font-medium">{doc.currency || "₦"}{(doc.total || 0).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[doc.status]}`}>{doc.status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {doc.created_date ? format(new Date(doc.created_date), "MMM d, yyyy") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet cards */}
            <div className="md:hidden divide-y divide-border">
              {filtered.map(doc => (
                <Link key={doc.id} to={`/documents/${doc.id}`}
                  className="flex items-start justify-between px-4 py-4 hover:bg-muted/30 active:bg-muted/50 transition-colors gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="text-sm font-semibold text-foreground">{doc.number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusColors[doc.status] || "bg-gray-100 text-gray-600"}`}>{doc.status}</span>
                    </div>
                    <p className="text-sm text-foreground font-medium truncate">{doc.customer_name || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {typeLabels[doc.type]} · {doc.created_date ? format(new Date(doc.created_date), "d MMM yyyy") : "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{doc.currency || "₦"}{(doc.total || 0).toLocaleString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}