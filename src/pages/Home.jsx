import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, FileCheck, Receipt, Truck, Mail, Plus, Clock, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const DOC_TYPES = [
  {
    type: "invoice",
    label: "Invoices",
    description: "Bill your clients and track payments",
    icon: FileText,
    color: "#3b82f6",
    bg: "#eff6ff",
    border: "#bfdbfe",
    path: "/documents?type=invoice",
    newPath: "/documents/new?type=invoice",
  },
  {
    type: "quotation",
    label: "Quotations",
    description: "Send price proposals to potential clients",
    icon: FileCheck,
    color: "#8b5cf6",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    path: "/documents?type=quotation",
    newPath: "/documents/new?type=quotation",
  },
  {
    type: "receipt",
    label: "Receipts",
    description: "Confirm payments received",
    icon: Receipt,
    color: "#10b981",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    path: "/documents?type=receipt",
    newPath: "/documents/new?type=receipt",
  },
  {
    type: "waybill",
    label: "Waybills",
    description: "Track deliveries and shipments",
    icon: Truck,
    color: "#f59e0b",
    bg: "#fffbeb",
    border: "#fde68a",
    path: "/documents?type=waybill",
    newPath: "/documents/new?type=waybill",
  },
  {
    type: "mail",
    label: "Mail",
    description: "Manage your business correspondence",
    icon: Mail,
    color: "#ef4444",
    bg: "#fef2f2",
    border: "#fecaca",
    path: "/mail",
    newPath: null,
  },
];

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

  const recentDocs = docs.slice(0, 5);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {greeting()}{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">What would you like to create today?</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by invoice number, customer name, status, tracking number…"
          className="w-full h-11 pl-10 pr-10 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search results */}
      {searchQuery.trim().length > 1 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"</p>
          {searchResults.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border px-5 py-8 text-center text-sm text-muted-foreground">No documents found</div>
          ) : (
            <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {searchResults.slice(0, 20).map(doc => {
                const meta = DOC_TYPES.find(d => d.type === doc.type) || DOC_TYPES[0];
                const Icon = meta.icon;
                return (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                      <Icon style={{ color: meta.color }} className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.number || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{doc.customer_name || "No customer"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-foreground capitalize">{doc.status?.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground capitalize">{doc.type}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main document type grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {DOC_TYPES.map(({ type, label, description, icon: Icon, color, bg, border, path, newPath }) => (
          <div
            key={type}
            onClick={() => navigate(path)}
            className="group relative bg-card rounded-2xl border border-border p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-4"
          >
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <Icon style={{ color }} className="h-6 w-6" />
            </div>

            {/* Text */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground leading-tight">{label}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
                </div>
                {type !== "mail" && countByType(type) > 0 && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                    style={{ background: bg, color }}
                  >
                    {countByType(type)}
                  </span>
                )}
              </div>
            </div>

            {/* Create button */}
            {newPath && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(newPath); }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors w-fit"
                style={{ background: bg, color, border: `1px solid ${border}` }}
              >
                <Plus className="h-3 w-3" />
                New {label.replace(/s$/, "")}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Recent documents */}
      {recentDocs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Recent Documents</h2>
          </div>
          <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {recentDocs.map((doc) => {
              const meta = DOC_TYPES.find((d) => d.type === doc.type) || DOC_TYPES[0];
              const Icon = meta.icon;
              return (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: meta.bg }}
                  >
                    <Icon style={{ color: meta.color }} className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.number || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{doc.customer_name || "No customer"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-foreground capitalize">{doc.status?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{doc.issue_date ? new Date(doc.issue_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : ""}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}