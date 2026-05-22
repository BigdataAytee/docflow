import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { FileText, Users, DollarSign, Clock, ArrowRight, Plus } from "lucide-react";
import StatsCard from "../components/StatsCard";
import { format } from "date-fns";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const totalRevenue = documents.filter(d => d.status === "paid").reduce((s, d) => s + (d.total || 0), 0);
  const pending = documents.filter(d => d.status === "sent" || d.status === "overdue");
  const pendingAmount = pending.reduce((s, d) => s + (d.balance_due || d.total || 0), 0);
  const recentDocs = documents.slice(0, 5);

  const statusColors = {
    draft: "bg-gray-100 text-gray-600",
    sent: "bg-blue-50 text-blue-600",
    paid: "bg-emerald-50 text-emerald-600",
    overdue: "bg-red-50 text-red-600",
    cancelled: "bg-gray-100 text-gray-500",
    accepted: "bg-emerald-50 text-emerald-600",
    rejected: "bg-red-50 text-red-600",
  };

  const typeLabels = {
    invoice: "Invoice",
    quotation: "Quotation",
    receipt: "Receipt",
    waybill: "Waybill",
    delivery_note: "Delivery Note",
    purchase_order: "Purchase Order",
    credit_note: "Credit Note",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your business documents</p>
        </div>
        <Link
          to="/documents/new?type=invoice"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Invoice
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total Documents" value={documents.length} icon={FileText} color="primary" />
        <StatsCard title="Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} color="green" />
        <StatsCard title="Pending" value={`$${pendingAmount.toLocaleString()}`} subtitle={`${pending.length} documents`} icon={Clock} color="amber" />
        <StatsCard title="Customers" value={customers.length} icon={Users} color="primary" />
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="font-semibold text-foreground">Recent Documents</h2>
          <Link to="/documents" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recentDocs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No documents yet. Create your first one!</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-t border-border text-left">
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
                    <Link to={`/documents/${doc.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {doc.number}
                    </Link>
                    <p className="text-xs text-muted-foreground">{typeLabels[doc.type] || doc.type}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">{doc.customer_name}</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{doc.currency || "$"}{(doc.total || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[doc.status] || "bg-gray-100 text-gray-600"}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {doc.created_date ? format(new Date(doc.created_date), "MMM d, yyyy") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}