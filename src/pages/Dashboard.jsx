import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { FileText, Users, DollarSign, Clock, ArrowRight, Plus } from "lucide-react";
import { format } from "date-fns";

const statusColors = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-600",
  paid: "bg-emerald-50 text-emerald-600",
  overdue: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
  accepted: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-600",
};

const CURRENCY_SYMBOLS = {
  NGN: "₦", USD: "$", EUR: "€", GBP: "£", GHS: "₵", KES: "KSh", ZAR: "R",
};
const sym = (code) => CURRENCY_SYMBOLS[code] || code || "₦";

const typeLabels = {
  invoice: "Invoice", quotation: "Quotation", receipt: "Receipt",
  waybill: "Waybill", delivery_note: "Delivery Note",
  purchase_order: "Purchase Order", credit_note: "Credit Note",
};

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Document.list("-created_date", 50),
      base44.entities.Customer.list("-created_date", 50),
    ]).then(([docs, custs]) => {
      setDocuments(docs);
      setCustomers(custs);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const totalRevenue = documents.filter(d => d.status === "paid").reduce((s, d) => s + (d.total || 0), 0);
  const pending = documents.filter(d => d.status === "sent" || d.status === "overdue");
  const pendingAmount = pending.reduce((s, d) => s + (d.balance_due || d.total || 0), 0);
  const recentDocs = documents.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Overview of your business documents</p>
        </div>
        <Link to="/documents/new?type=invoice"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> New Invoice
        </Link>
      </div>

      {/* Stats — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={FileText} label="Total Documents" value={documents.length} color="text-blue-600 bg-blue-50" />
        <StatCard icon={DollarSign} label="Revenue" value={`₦${totalRevenue.toLocaleString()}`} color="text-emerald-600 bg-emerald-50" />
        <StatCard icon={Clock} label="Pending" value={`₦${pendingAmount.toLocaleString()}`} sub={`${pending.length} doc${pending.length !== 1 ? "s" : ""}`} color="text-amber-600 bg-amber-50" />
        <StatCard icon={Users} label="Customers" value={customers.length} color="text-purple-600 bg-purple-50" />
      </div>

      {/* Recent Documents */}
      <div className="bg-card rounded-xl border border-border">
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm md:text-base">Recent Documents</h2>
          <Link to="/documents" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentDocs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No documents yet. Create your first one!</p>
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
                  {recentDocs.map(doc => (
                    <tr key={doc.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/documents/${doc.id}`} className="text-sm font-medium text-foreground hover:text-primary">{doc.number}</Link>
                        <p className="text-xs text-muted-foreground">{typeLabels[doc.type] || doc.type}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">{doc.customer_name}</td>
                      <td className="px-6 py-4 text-sm font-medium">{sym(doc.currency)}{(doc.total || 0).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[doc.status] || "bg-gray-100 text-gray-600"}`}>{doc.status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {doc.created_date ? format(new Date(doc.created_date), "MMM d, yyyy") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {recentDocs.map(doc => (
                <Link key={doc.id} to={`/documents/${doc.id}`}
                  className="flex items-start justify-between px-4 py-4 hover:bg-muted/30 transition-colors gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{doc.number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusColors[doc.status] || "bg-gray-100 text-gray-600"}`}>{doc.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{doc.customer_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{typeLabels[doc.type]} · {doc.created_date ? format(new Date(doc.created_date), "d MMM yyyy") : "-"}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">{sym(doc.currency)}{(doc.total || 0).toLocaleString()}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
          <p className="text-xl md:text-2xl font-black text-foreground mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2 md:p-2.5 rounded-lg ${color} shrink-0`}>
          <Icon className="h-4 w-4 md:h-5 md:w-5" />
        </div>
      </div>
    </div>
  );
}