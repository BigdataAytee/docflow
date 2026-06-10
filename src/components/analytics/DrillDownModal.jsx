import { useNavigate } from "react-router-dom";
import { X, FileText, ArrowRight } from "lucide-react";

const STATUS_COLORS = {
  draft: "#94a3b8", sent: "#3b82f6", paid: "#10b981", overdue: "#ef4444",
  delivered: "#10b981", pending: "#f59e0b", accepted: "#8b5cf6", cancelled: "#64748b",
};

export default function DrillDownModal({ type, data, allDocs, onClose }) {
  const navigate = useNavigate();

  const relatedDocs = type === "customer"
    ? allDocs.filter(d => d.customer_name === data.name)
    : allDocs.filter(d => (d.items || []).some(item => item.description === data.name));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold text-foreground">{data.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {type === "customer" ? `${data.count} invoice${data.count !== 1 ? "s" : ""}` : `${data.qty} units sold`}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-2">
          {relatedDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No documents found</p>
          ) : (
            relatedDocs.slice(0, 20).map(doc => {
              const statusColor = STATUS_COLORS[doc.status] || "#94a3b8";
              return (
                <div key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/40 cursor-pointer transition-colors group"
                  onClick={() => { navigate(`/documents/${doc.id}`); onClose(); }}>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{doc.number || "—"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{doc.type}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                      style={{ background: statusColor + "1a", color: statusColor }}>
                      {doc.status?.replace(/_/g, " ")}
                    </span>
                    {doc.total > 0 && (
                      <span className="text-sm font-bold text-foreground">₦{doc.total?.toLocaleString()}</span>
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