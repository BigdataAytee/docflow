import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Search, Filter, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const typeLabels = {
  invoice: "Invoice", quotation: "Quotation", receipt: "Receipt",
  waybill: "Waybill", delivery_note: "Delivery Note",
  purchase_order: "Purchase Order", credit_note: "Credit Note",
  letterhead: "Letterhead",
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

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    base44.entities.Document.list("-created_date", 200).then(d => { setDocuments(d); setLoading(false); });
  }, []);

  const filtered = documents.filter(d => {
    if (typeFilter !== "all" && d.type !== typeFilter) return false;
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (search && !(d.number || "").toLowerCase().includes(search.toLowerCase()) && !(d.customer_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">{documents.length} total documents</p>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="p-4 border-b border-border flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {["draft", "sent", "paid", "overdue", "cancelled"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No documents found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead><tr className="text-left">
              <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Document</th>
              <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
            </tr></thead>
            <tbody>
              {filtered.map(doc => (
                <tr key={doc.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4">
                    <Link to={`/documents/${doc.id}`} className="text-sm font-medium hover:text-primary">{doc.number}</Link>
                    <p className="text-xs text-muted-foreground">{typeLabels[doc.type]}</p>
                  </td>
                  <td className="px-6 py-4 text-sm">{doc.customer_name}</td>
                  <td className="px-6 py-4 text-sm font-medium">${(doc.total || 0).toLocaleString()}</td>
                  <td className="px-6 py-4"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[doc.status]}`}>{doc.status}</span></td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{doc.created_date ? format(new Date(doc.created_date), "MMM d, yyyy") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}