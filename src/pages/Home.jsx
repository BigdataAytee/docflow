import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, FileCheck, Receipt, Truck, Mail, Plus, Clock, Search, X, ArrowRight, Sparkles, TrendingUp, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const DOC_TYPES = [
  { type: "invoice",   label: "Invoices",    description: "Bill clients & track payments", icon: FileText,  gradient: "linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)", glow: "rgba(59,130,246,0.3)",   path: "/documents?type=invoice",   newPath: "/documents/new?type=invoice"   },
  { type: "quotation", label: "Quotations",  description: "Send price proposals",          icon: FileCheck, gradient: "linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%)", glow: "rgba(139,92,246,0.3)",  path: "/documents?type=quotation", newPath: "/documents/new?type=quotation" },
  { type: "receipt",   label: "Receipts",    description: "Confirm payments received",     icon: Receipt,   gradient: "linear-gradient(135deg,#10b981 0%,#047857 100%)", glow: "rgba(16,185,129,0.3)",  path: "/documents?type=receipt",   newPath: "/documents/new?type=receipt"   },
  { type: "waybill",   label: "Waybills",    description: "Track deliveries & shipments",  icon: Truck,     gradient: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)", glow: "rgba(245,158,11,0.3)",   path: "/documents?type=waybill",   newPath: "/documents/new?type=waybill"   },
  { type: "mail",      label: "Mail",        description: "Business correspondence",       icon: Mail,      gradient: "linear-gradient(135deg,#ef4444 0%,#b91c1c 100%)", glow: "rgba(239,68,68,0.3)",    path: "/mail",                     newPath: null                            },
];

const STATUS_COLORS = {
  draft: "#94a3b8", sent: "#3b82f6", paid: "#10b981", overdue: "#ef4444",
  delivered: "#10b981", pending: "#f59e0b", accepted: "#8b5cf6", cancelled: "#64748b",
};

export default function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState(null);

  const handleCardClick = (path, type) => {
    setSelectedType(type);
    setTimeout(() => navigate(path), 250);
  };

  const activeMeta = DOC_TYPES.find(d => d.type === selectedType);

  const { data: docs = [] } = useQuery({
    queryKey: ["home-docs"],
    queryFn: () => base44.entities.Document.list("-created_date", 50),
  });

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const countByType = (type) => docs.filter(d => d.type === type).length;
  const completedCount = docs.filter(d => d.status === "paid" || d.status === "delivered").length;
  const overdueCount = docs.filter(d => d.status === "overdue").length;
  const recentDocs = docs.slice(0, 5);

  const searchResults = searchQuery.trim().length > 1
    ? docs.filter(doc => {
        const q = searchQuery.toLowerCase();
        return (
          (doc.number || "").toLowerCase().includes(q) ||
          (doc.customer_name || "").toLowerCase().includes(q) ||
          (doc.customer_email || "").toLowerCase().includes(q) ||
          (doc.type || "").toLowerCase().includes(q) ||
          (doc.status || "").replace(/_/g, " ").toLowerCase().includes(q) ||
          (doc.tracking_number || "").toLowerCase().includes(q)
        );
      })
    : [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = user?.full_name?.split(" ")[0] || "";
  const heroGradient = selectedType && activeMeta
    ? activeMeta.gradient
    : "linear-gradient(135deg, #0f1629 0%, #1a1f3a 40%, #1e1040 100%)";

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── HERO ── */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{ background: heroGradient, transition: "background 0.35s ease", minHeight: 220 }}
      >
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)",
          backgroundSize: "32px 32px"
        }} />
        {/* Glow orbs */}
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(99,102,241,0.25) 0%,transparent 65%)" }} />
        <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 65%)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(139,92,246,0.08) 0%,transparent 60%)" }} />

        <div className="relative z-10 px-7 py-8 md:px-10 md:py-10">
          {/* Tag line */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <Sparkles className="h-3 w-3 text-yellow-300" />
            <span className="text-yellow-200 text-[11px] font-bold uppercase tracking-[0.15em]">Dashboard</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">
                {greeting()}{firstName ? `,` : "!"}<br />
                {firstName && <span className="text-white/70">{firstName}! 👋</span>}
              </h1>
              <p className="text-white/45 mt-2 text-sm max-w-xs">Your business documents, all in one place.</p>
            </div>

            {/* Stats chips */}
            <div className="flex gap-3 flex-wrap">
              <div className="rounded-2xl px-5 py-3.5 text-center" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}>
                <p className="text-2xl font-black text-white">{docs.length}</p>
                <p className="text-white/45 text-[11px] font-medium mt-0.5">Total</p>
              </div>
              <div className="rounded-2xl px-5 py-3.5 text-center" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)", backdropFilter: "blur(8px)" }}>
                <p className="text-2xl font-black text-emerald-300">{completedCount}</p>
                <p className="text-emerald-300/60 text-[11px] font-medium mt-0.5">Completed</p>
              </div>
              {overdueCount > 0 && (
                <div className="rounded-2xl px-5 py-3.5 text-center" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", backdropFilter: "blur(8px)" }}>
                  <p className="text-2xl font-black text-red-300">{overdueCount}</p>
                  <p className="text-red-300/60 text-[11px] font-medium mt-0.5">Overdue</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── SEARCH ── */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none transition-colors group-focus-within:text-primary" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by document reference number, customer name, status, tracking number…"
          className="w-full h-13 pl-11 pr-11 rounded-2xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 shadow-sm placeholder:text-muted-foreground transition-all"
          style={{ height: 52 }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── SEARCH RESULTS ── */}
      {searchQuery.trim().length > 1 && (
        <div>
          <p className="text-xs text-muted-foreground mb-3 px-1">
            <span className="font-semibold text-foreground">{searchResults.length}</span> result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
          </p>
          {searchResults.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border px-5 py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No documents found</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
              {searchResults.slice(0, 20).map((doc, idx) => {
                const meta = DOC_TYPES.find(d => d.type === doc.type) || DOC_TYPES[0];
                const Icon = meta.icon;
                const statusColor = STATUS_COLORS[doc.status] || "#94a3b8";
                return (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors group ${idx < searchResults.length - 1 ? "border-b border-border" : ""}`}
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
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      {!searchQuery && (
        <>
          {/* Quick Access */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Quick Access</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {DOC_TYPES.map(({ type, label, description, icon: Icon, gradient, glow, path, newPath }) => {
                const count = type !== "mail" ? countByType(type) : null;
                const isSelected = selectedType === type;
                const isDimmed = selectedType && !isSelected;
                return (
                  <div
                    key={type}
                    onClick={() => handleCardClick(path, type)}
                    className="group relative rounded-2xl md:rounded-3xl cursor-pointer overflow-hidden"
                    style={{
                      background: gradient,
                      boxShadow: isSelected ? `0 0 0 3px white, 0 12px 40px ${glow}` : `0 4px 20px ${glow}`,
                      transform: isSelected ? "scale(1.03)" : "scale(1)",
                      opacity: isDimmed ? 0.5 : 1,
                      transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                    }}
                  >
                    {/* Shine */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 60%)" }} />
                    {/* Decorative shapes */}
                    <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
                    <div className="absolute -bottom-8 -left-4 w-20 h-20 rounded-full bg-black/10" />

                    <div className="relative z-10 p-4 md:p-5 flex flex-col gap-3 min-h-[152px] md:min-h-[168px]">
                      <div className="flex items-start justify-between">
                        <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner ring-1 ring-white/10">
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        {count !== null && (
                          <span className="text-xs font-black px-2.5 py-1 rounded-full bg-black/20 text-white/90 backdrop-blur-sm">
                            {count > 0 ? count : "0"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-black text-white text-base md:text-lg leading-tight">{label}</h3>
                        <p className="text-white/60 text-xs mt-0.5 leading-relaxed hidden sm:block">{description}</p>
                      </div>
                      {newPath ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(newPath); }}
                          className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/20 hover:bg-white/35 backdrop-blur-sm rounded-xl px-3 py-2 w-fit transition-all active:scale-95"
                        >
                          <Plus className="h-3 w-3" /> New
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-xs font-bold text-white/80">
                          Open <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent activity */}
          {recentDocs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6)" }}>
                    <Clock className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h2 className="font-bold text-base text-foreground">Recent Documents</h2>
                </div>
                <button
                  onClick={() => navigate("/documents")}
                  className="text-xs text-primary font-semibold flex items-center gap-1 hover:gap-1.5 transition-all"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="rounded-2xl border border-border overflow-hidden shadow-sm" style={{ background: "hsl(var(--card))" }}>
                {recentDocs.map((doc, idx) => {
                  const meta = DOC_TYPES.find(d => d.type === doc.type) || DOC_TYPES[0];
                  const Icon = meta.icon;
                  const statusColor = STATUS_COLORS[doc.status] || "#94a3b8";
                  const isLast = idx === recentDocs.length - 1;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className={`relative flex items-center gap-4 px-5 py-4 cursor-pointer transition-all group hover:bg-muted/30 ${!isLast ? "border-b border-border" : ""}`}
                    >
                      {/* Left accent bar on hover */}
                      <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: meta.gradient }} />

                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md"
                        style={{ background: meta.gradient }}
                      >
                        <Icon className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm truncate">{doc.number || "—"}</p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md capitalize hidden sm:inline"
                            style={{ background: statusColor + "18", color: statusColor }}>
                            {doc.status?.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.customer_name || "No customer"}</p>
                      </div>

                      <div className="shrink-0 text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">
                          {doc.issue_date ? new Date(doc.issue_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : ""}
                        </p>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
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