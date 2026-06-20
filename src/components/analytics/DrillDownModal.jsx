import { useNavigate } from "react-router-dom";
import { X, FileText, ArrowRight, TrendingUp, DollarSign, Package, Hash } from "lucide-react";

const STATUS_COLORS = {
  draft: "#94a3b8", sent: "#3b82f6", paid: "#10b981", overdue: "#ef4444",
  delivered: "#10b981", pending: "#f59e0b", accepted: "#8b5cf6", cancelled: "#64748b",
};

const DOC_TYPE_COLORS = {
  invoice: "#3b82f6", quotation: "#8b5cf6", receipt: "#10b981", waybill: "#f59e0b"
};

function fmt(n) {
  if (!n) return "₦0";
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${Number(n).toFixed(0)}`;
}

export default function DrillDownModal({ type, data, allDocs, onClose }) {
  const navigate = useNavigate();

  const relatedDocs = type === "customer"
    ? allDocs.filter(d => d.customer_name === data.name)
    : allDocs.filter(d => (d.items || []).some(item => item.description === data.name));

  // Compute stats
  const totalRevenue = relatedDocs.reduce((s, d) => s + (d.total || 0), 0);
  const paidRevenue = relatedDocs.filter(d => d.status === "paid").reduce((s, d) => s + (d.total || 0), 0);
  const totalUnits = type === "product"
    ? relatedDocs.reduce((s, d) => {
        const match = (d.items || []).find(i => i.description === data.name);
        return s + (match?.quantity || 0);
      }, 0)
    : null;
  const docTypeCounts = relatedDocs.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {});

  const stats = type === "customer"
    ? [
        { label: "Total Value", value: fmt(totalRevenue), icon: DollarSign, color: "#6366f1" },
        { label: "Paid", value: fmt(paidRevenue), icon: TrendingUp, color: "#10b981" },
        { label: "Documents", value: relatedDocs.length, icon: FileText, color: "#3b82f6" },
      ]
    : [
        { label: "Total Units", value: totalUnits, icon: Package, color: "#6366f1" },
        { label: "Revenue", value: fmt(totalRevenue), icon: DollarSign, color: "#10b981" },
        { label: "Documents", value: relatedDocs.length, icon: Hash, color: "#3b82f6" },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b border-border"
          style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)", borderRadius: "1rem 1rem 0 0" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-white text-base truncate max-w-[280px]">{data.name}</h3>
              <p className="text-xs text-white/50 mt-0.5 capitalize">
                {type === "customer" ? "Customer breakdown" : "Product breakdown"}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stat pills */}
          <div className="grid grid-cols-3 gap-2">
            {stats.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white/10 rounded-xl px-3 py-2 text-center">
                <p className="text-lg font-bold text-white leading-tight">{value}</p>
                <p className="text-[10px] text-white/50 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Doc type breakdown pills */}
          {Object.keys(docTypeCounts).length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {Object.entries(docTypeCounts).map(([t, count]) => (
                <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                  style={{ background: (DOC_TYPE_COLORS[t] || "#94a3b8") + "30", color: DOC_TYPE_COLORS[t] || "#94a3b8", border: `1px solid ${(DOC_TYPE_COLORS[t] || "#94a3b8")}40` }}>
                  {count} {t}{count !== 1 ? "s" : ""}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Document list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {relatedDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No documents found</p>
          ) : (
            relatedDocs.slice(0, 30).map(doc => {
              const statusColor = STATUS_COLORS[doc.status] || "#94a3b8";
              return (
                <div key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/40 cursor-pointer transition-colors group"
                  onClick={() => { navigate(`/documents/${doc.id}`); onClose(); }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: (DOC_TYPE_COLORS[doc.type] || "#6366f1") + "20" }}>
                    <FileText className="h-4 w-4" style={{ color: DOC_TYPE_COLORS[doc.type] || "#6366f1" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{doc.number || "—"}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {doc.type} · {doc.issue_date ? new Date(doc.issue_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                      style={{ background: statusColor + "1a", color: statusColor }}>
                      {doc.status?.replace(/_/g, " ")}
                    </span>
                    {doc.total > 0 && (
                      <span className="text-sm font-bold text-foreground">{fmt(doc.total)}</span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}