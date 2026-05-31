import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, FileCheck, Receipt, Truck, Mail, Plus, Clock, Search, X, ArrowRight, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const DOC_TYPES = [
  {
    type: "invoice",
    label: "Invoices",
    description: "Bill clients & track payments",
    icon: FileText,
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    glow: "rgba(59,130,246,0.25)",
    badgeBg: "rgba(255,255,255,0.2)",
    path: "/documents?type=invoice",
    newPath: "/documents/new?type=invoice",
  },
  {
    type: "quotation",
    label: "Quotations",
    description: "Send price proposals",
    icon: FileCheck,
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
    glow: "rgba(139,92,246,0.25)",
    badgeBg: "rgba(255,255,255,0.2)",
    path: "/documents?type=quotation",
    newPath: "/documents/new?type=quotation",
  },
  {
    type: "receipt",
    label: "Receipts",
    description: "Confirm payments received",
    icon: Receipt,
    gradient: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
    glow: "rgba(16,185,129,0.25)",
    badgeBg: "rgba(255,255,255,0.2)",
    path: "/documents?type=receipt",
    newPath: "/documents/new?type=receipt",
  },
  {
    type: "waybill",
    label: "Waybills",
    description: "Track deliveries & shipments",
    icon: Truck,
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    glow: "rgba(245,158,11,0.25)",
    badgeBg: "rgba(255,255,255,0.2)",
    path: "/documents?type=waybill",
    newPath: "/documents/new?type=waybill",
  },
  {
    type: "mail",
    label: "Mail",
    description: "Business correspondence",
    icon: Mail,
    gradient: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
    glow: "rgba(239,68,68,0.25)",
    badgeBg: "rgba(255,255,255,0.2)",
    path: "/mail",
    newPath: null,
  },
];

const STATUS_COLORS = {
  draft: "#94a3b8",
  sent: "#3b82f6",
  paid: "#10b981",
  overdue: "#ef4444",
  delivered: "#10b981",
  pending: "#f59e0b",
  accepted: "#8b5cf6",
  cancelled: "#64748b",
};

export default function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: docs = [] } = useQuery({
    queryKey: ["home-docs"],
    queryFn: () => base44.entities.Document.list("-created_date", 50),
  });

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const countByType = (type) => docs.filter((d) => d.type === type).length;

  const searchResults = searchQuery.trim().length > 1
    ? docs.filter(doc => {
        const q = searchQuery.toLowerCase();
        return (
          (doc.number || "").toLowerCase().includes(q) ||
          (doc.customer_name || "").toLowerCase().includes(q) ||
          (doc.customer_email || "").toLowerCase().includes(q) ||
          (doc.type || "").toLowerCase().includes(q) ||
          (doc.status || "").replace(/_/g, " ").toLowerCase().includes(q) ||
          (doc.notes || "").toLowerCase().includes(q) ||
          (doc.tracking_number || "").toLowerCase().includes(q)
        );
      })
    : [];

  const recentDocs = docs.slice(0, 6);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = user?.full_name?.split(" ")[0] || "";

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Hero greeting */}
      <div
        className="relative rounded-3xl overflow-hidden px-6 py-8 md:px-10 md:py-10"
        style={{ background: "linear-gradient(135deg, hsl(230,65%,14%) 0%, hsl(230,60%,22%) 60%, hsl(260,50%,28%) 100%)" }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }} />
        <div className="absolute -bottom-8 -left-8 w-44 h-44 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)" }} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-yellow-300" />
              <span className="text-yellow-300 text-xs font-semibold uppercase tracking-widest">Dashboard</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
              {greeting()}{firstName ? `, ${firstName}` : ""}! 👋
            </h1>
            <p className="text-white/60 mt-1.5 text-sm">Manage your documents and business communications.</p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3 text-center min-w-[72px]">
              <p className="text-2xl font-bold text-white">{docs.length}</p>
              <p className="text-white/50 text-xs mt-0.5">Total Docs</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3 text-center min-w-[72px]">
              <p className="text-2xl font-bold text-emerald-300">{docs.filter(d => d.status === "paid" || d.status === "delivered").length}</p>
              <p className="text-white/50 text-xs mt-0.5">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by invoice number, customer, status, tracking number…"
          className="w-full h-12 pl-11 pr-11 rounded-2xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-sm placeholder:text-muted-foreground transition-shadow focus:shadow-md"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search results */}
      {searchQuery.trim().length > 1 && (
        <div>
          <p className="text-xs text-muted-foreground mb-3 px-1">
            <span className="font-semibold text-foreground">{searchResults.length}</span> result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
          </p>
          {searchResults.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border px-5 py-10 text-center text-sm text-muted-foreground">
              No documents found
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden shadow-sm">
              {searchResults.slice(0, 20).map(doc => {
                const meta = DOC_TYPES.find(d => d.type === doc.type) || DOC_TYPES[0];
                const Icon = meta.icon;
                const statusColor = STATUS_COLORS[doc.status] || "#94a3b8";
                return (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: meta.gradient }}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{doc.number || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{doc.customer_name || "No customer"}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: statusColor + "1a", color: statusColor }}>
                        {doc.status?.replace(/_/g, " ")}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Document type cards */}
      {!searchQuery && (
        <>
          <div>
            <h2 className="font-bold text-base text-foreground mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {DOC_TYPES.map(({ type, label, description, icon: Icon, gradient, glow, path, newPath }) => {
                const count = type !== "mail" ? countByType(type) : null;
                return (
                  <div
                    key={type}
                    onClick={() => navigate(path)}
                    className="group relative rounded-2xl md:rounded-3xl cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1"
                    style={{
                      background: gradient,
                      boxShadow: `0 4px 24px ${glow}`,
                    }}
                  >
                    {/* Decorative circle */}
                    <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
                    <div className="absolute -bottom-8 -left-4 w-20 h-20 rounded-full bg-black/10" />

                    <div className="relative z-10 p-4 md:p-5 flex flex-col gap-3 min-h-[148px] md:min-h-[160px]">
                      {/* Top row: icon + count */}
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                          <Icon className="h-5 w-5 md:h-6 md:w-6 text-white" />
                        </div>
                        {count !== null && count > 0 && (
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/25 text-white backdrop-blur-sm">
                            {count}
                          </span>
                        )}
                      </div>

                      {/* Label + description */}
                      <div className="flex-1">
                        <h3 className="font-bold text-white text-base md:text-lg leading-tight">{label}</h3>
                        <p className="text-white/70 text-xs mt-0.5 leading-relaxed hidden sm:block">{description}</p>
                      </div>

                      {/* CTA */}
                      {newPath ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(newPath); }}
                          className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl px-3 py-1.5 w-fit transition-colors"
                        >
                          <Plus className="h-3 w-3" /> New
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-xs font-semibold text-white/80">
                          Open <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent documents */}
          {recentDocs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-bold text-base text-foreground">Recent Documents</h2>
                </div>
                <button
                  onClick={() => navigate("/documents")}
                  className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                {recentDocs.map((doc, idx) => {
                  const meta = DOC_TYPES.find((d) => d.type === doc.type) || DOC_TYPES[0];
                  const Icon = meta.icon;
                  const statusColor = STATUS_COLORS[doc.status] || "#94a3b8";
                  return (
                    <div
                      key={doc.id}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors group ${idx < recentDocs.length - 1 ? "border-b border-border" : ""}`}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: meta.gradient }}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{doc.number || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{doc.customer_name || "No customer"}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize block" style={{ background: statusColor + "1a", color: statusColor }}>
                            {doc.status?.replace(/_/g, " ")}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">
                            {doc.issue_date ? new Date(doc.issue_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : ""}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}