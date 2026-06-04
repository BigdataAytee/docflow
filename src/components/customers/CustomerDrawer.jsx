import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import {
  X, Star, Building2, Mail, Phone, MapPin, FileText, Plus,
  Receipt, GitMerge, Truck, TrendingUp, Calendar, ExternalLink,
  Pencil, Trash2, Globe, Tag, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "₵", KES: "KSh", ZAR: "R" };
const DOC_ICONS = { invoice: FileText, quotation: GitMerge, receipt: Receipt, waybill: Truck };
const DOC_COLORS = {
  invoice: "text-blue-600 bg-blue-50",
  quotation: "text-purple-600 bg-purple-50",
  receipt: "text-emerald-600 bg-emerald-50",
  waybill: "text-orange-600 bg-orange-50",
};
const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-500", sent: "bg-blue-50 text-blue-600",
  paid: "bg-emerald-50 text-emerald-600", accepted: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-600", cancelled: "bg-gray-100 text-gray-500",
  delivered: "bg-emerald-50 text-emerald-600", overdue: "bg-red-50 text-red-600",
  pending: "bg-amber-50 text-amber-600", in_transit: "bg-purple-50 text-purple-600",
};

const avatarColors = ["#7c3aed","#4f46e5","#2563eb","#0891b2","#059669","#d97706","#dc2626","#db2777"];
const getColor = (name) => avatarColors[(name || "").charCodeAt(0) % avatarColors.length];
const fmt = (n, sym = "₦") => `${sym}${(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`;

export default function CustomerDrawer({ customer, onClose, onEdit, onDelete, onToggleFav }) {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const sym = CURRENCY_SYMBOLS[customer.currency] || "₦";

  useEffect(() => {
    if (!customer) return;
    setLoadingDocs(true);
    base44.entities.Document.filter({ customer_id: customer.id }, "-created_date", 50)
      .then(d => { setDocs(d); setLoadingDocs(false); })
      .catch(() => setLoadingDocs(false));
  }, [customer.id]);

  const totalRevenue = docs.filter(d => d.type === "receipt" || d.status === "paid").reduce((s, d) => s + (d.total || 0), 0);
  const openInvoices = docs.filter(d => d.type === "invoice" && !["paid","cancelled"].includes(d.status)).length;
  const totalDocs = docs.length;

  const handleNewDoc = (type) => {
    sessionStorage.setItem("ai_prefill", JSON.stringify({
      customer_id: customer.id,
      customer_name: customer.full_name,
      customer_company: customer.company_name || "",
      customer_email: customer.email || "",
      customer_address: customer.billing_address || customer.shipping_address || "",
    }));
    navigate(`/documents/new?type=${type}`);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden"
        style={{ borderLeft: "1px solid #e2e8f0" }}>

        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-4"
          style={{ background: `linear-gradient(135deg, ${getColor(customer.full_name)}18 0%, #fff 100%)` }}>
          <div className="flex items-start justify-between mb-4">
            <button onClick={onClose} className="p-1.5 hover:bg-black/5 rounded-lg transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => onToggleFav(customer)}
                className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors">
                <Star className={`h-4 w-4 ${customer.is_favorite ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
              </button>
              <button onClick={() => { onEdit(customer); onClose(); }}
                className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors">
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => { onDelete(customer.id); onClose(); }}
                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="h-4 w-4 text-red-400" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0 shadow-lg"
              style={{ background: getColor(customer.full_name) }}>
              {(customer.full_name || "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-foreground truncate">{customer.full_name}</h2>
              {customer.company_name && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{customer.company_name}</span>
                </div>
              )}
              {customer.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {customer.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: "Revenue", value: fmt(totalRevenue, sym), icon: TrendingUp, color: "text-emerald-600" },
              { label: "Documents", value: totalDocs, icon: FileText, color: "text-blue-600" },
              { label: "Open", value: openInvoices, icon: Calendar, color: "text-amber-600" },
            ].map(s => (
              <div key={s.label} className="bg-white/80 rounded-xl p-2.5 border border-white shadow-sm text-center">
                <s.icon className={`h-3.5 w-3.5 mx-auto mb-1 ${s.color}`} />
                <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="shrink-0 px-5 py-3 border-b border-border bg-muted/30">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">New Document</p>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { type: "invoice", label: "Invoice", color: "border-blue-200 text-blue-700 hover:bg-blue-50" },
              { type: "quotation", label: "Quote", color: "border-purple-200 text-purple-700 hover:bg-purple-50" },
              { type: "receipt", label: "Receipt", color: "border-emerald-200 text-emerald-700 hover:bg-emerald-50" },
              { type: "waybill", label: "Waybill", color: "border-orange-200 text-orange-700 hover:bg-orange-50" },
            ].map(({ type, label, color }) => (
              <button key={type} onClick={() => handleNewDoc(type)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${color}`}>
                <Plus className="h-3 w-3" />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-border px-5">
          {["overview", "documents", "notes"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-2.5 text-xs font-bold capitalize border-b-2 transition-colors mr-2 ${activeTab === tab ? "border-purple-500 text-purple-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {activeTab === "overview" && (
            <>
              {/* Contact details */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contact</p>
                {[
                  { icon: Mail, value: customer.email, href: `mailto:${customer.email}` },
                  { icon: Phone, value: customer.phone, href: `tel:${customer.phone}` },
                  { icon: Globe, value: customer.country },
                  { icon: MapPin, value: customer.billing_address },
                ].filter(i => i.value).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                    <item.icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    {item.href ? (
                      <a href={item.href} className="text-sm text-primary hover:underline break-all">{item.value}</a>
                    ) : (
                      <p className="text-sm text-foreground whitespace-pre-line">{item.value}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Recent docs preview */}
              {docs.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Recent Activity</p>
                  <div className="space-y-1.5">
                    {docs.slice(0, 4).map(d => {
                      const Icon = DOC_ICONS[d.type] || FileText;
                      return (
                        <button key={d.id} onClick={() => { navigate(`/documents/${d.id}`); onClose(); }}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/60 transition-colors border border-transparent hover:border-border text-left">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${DOC_COLORS[d.type]}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{d.number}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{d.type}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold">{sym}{(d.total || 0).toLocaleString()}</p>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${STATUS_COLORS[d.status] || "bg-gray-100 text-gray-500"}`}>{d.status}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {docs.length > 4 && (
                    <button onClick={() => setActiveTab("documents")} className="mt-2 text-xs text-purple-600 font-semibold hover:underline">
                      View all {docs.length} documents →
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "documents" && (
            <div className="space-y-1.5">
              {loadingDocs ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                </div>
              ) : docs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No documents yet</p>
                </div>
              ) : docs.map(d => {
                const Icon = DOC_ICONS[d.type] || FileText;
                return (
                  <button key={d.id} onClick={() => { navigate(`/documents/${d.id}`); onClose(); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-colors border border-border text-left">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${DOC_COLORS[d.type]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{d.number}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {d.type} · {d.issue_date ? format(new Date(d.issue_date), "dd MMM yyyy") : "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{sym}{(d.total || 0).toLocaleString()}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${STATUS_COLORS[d.status] || "bg-gray-100 text-gray-500"}`}>{d.status}</span>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === "notes" && (
            <div>
              {customer.notes ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Notes</p>
                  </div>
                  <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{customer.notes}</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No notes added yet</p>
                  <button onClick={() => { onEdit(customer); onClose(); }}
                    className="mt-2 text-xs text-purple-600 font-semibold hover:underline">Add a note →</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}