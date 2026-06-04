import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Plus, Search, Star, Users, Building2, Mail, Phone,
  LayoutGrid, List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CustomerForm from "../components/CustomerForm";
import CustomerDrawer from "../components/customers/CustomerDrawer";

const avatarColors = ["#7c3aed","#4f46e5","#2563eb","#0891b2","#059669","#d97706","#dc2626","#db2777"];
const getAvatarColor = (name) => avatarColors[(name || "").charCodeAt(0) % avatarColors.length];

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Starred" },
  { id: "with_company", label: "Business" },
  { id: "no_company", label: "Individual" },
];

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [filterTab, setFilterTab] = useState("all");

  const load = async () => {
    const user = await base44.auth.me();
    if (!user) return;
    const c = await base44.entities.Customer.filter({ created_by: user.email }, "-created_date", 200);
    setCustomers(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    if (editing) await base44.entities.Customer.update(editing.id, data);
    else await base44.entities.Customer.create(data);
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.Customer.delete(id);
    setSelectedCustomer(null);
    load();
  };

  const toggleFav = async (c) => {
    await base44.entities.Customer.update(c.id, { is_favorite: !c.is_favorite });
    setCustomers(prev => prev.map(x => x.id === c.id ? { ...x, is_favorite: !x.is_favorite } : x));
    if (selectedCustomer?.id === c.id) setSelectedCustomer(p => ({ ...p, is_favorite: !p.is_favorite }));
  };

  const filtered = customers
    .filter(c => {
      if (filterTab === "favorites") return c.is_favorite;
      if (filterTab === "with_company") return !!c.company_name;
      if (filterTab === "no_company") return !c.company_name;
      return true;
    })
    .filter(c =>
      !search ||
      (c.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search)
    );

  const totalFavs = customers.filter(c => c.is_favorite).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden px-6 py-7 md:px-10 md:py-9"
        style={{ background: "linear-gradient(135deg,#7c3aed 0%,#4f46e5 60%,#2563eb 100%)", boxShadow: "0 8px 40px rgba(124,58,237,0.25)" }}>
        <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-10 -left-6 w-36 h-36 rounded-full bg-black/10 pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Contact Book</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">👥 Customers</h1>
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <div className="flex items-center gap-2 bg-white/15 rounded-2xl px-3 py-1.5">
                <Users className="h-3.5 w-3.5 text-white/70" />
                <span className="text-white text-sm font-bold">{customers.length}</span>
                <span className="text-white/60 text-xs">total</span>
              </div>
              {totalFavs > 0 && (
                <div className="flex items-center gap-2 bg-white/15 rounded-2xl px-3 py-1.5">
                  <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                  <span className="text-white text-sm font-bold">{totalFavs}</span>
                  <span className="text-white/60 text-xs">starred</span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-white/15 rounded-2xl px-3 py-1.5">
                <Building2 className="h-3.5 w-3.5 text-white/70" />
                <span className="text-white text-sm font-bold">{customers.filter(c => c.company_name).length}</span>
                <span className="text-white/60 text-xs">businesses</span>
              </div>
            </div>
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 bg-white text-purple-700 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all hover:bg-white/90 active:scale-95 w-fit shadow-lg">
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, company, email, phone…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl" />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {FILTER_TABS.map(tab => (
            <button key={tab.id} onClick={() => setFilterTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${filterTab === tab.id
                ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                : "bg-white text-muted-foreground border-border hover:border-purple-300 hover:text-purple-700"}`}>
              {tab.label}
              {tab.id === "all" && <span className="ml-1.5 opacity-60">{customers.length}</span>}
              {tab.id === "favorites" && totalFavs > 0 && <span className="ml-1.5 opacity-75">{totalFavs}</span>}
            </button>
          ))}
        </div>

        <div className="hidden sm:flex items-center bg-muted rounded-xl p-0.5 shrink-0">
          {[["grid", LayoutGrid], ["list", List]].map(([v, Icon]) => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`p-2 rounded-lg transition-all ${viewMode === v ? "bg-white shadow text-purple-600" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-14 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-purple-300" />
          </div>
          <p className="font-semibold text-foreground mb-1">{search || filterTab !== "all" ? "No customers match" : "No customers yet"}</p>
          <p className="text-sm text-muted-foreground mb-4">
            {search || filterTab !== "all" ? "Try adjusting your search or filters." : "Start by adding your first customer."}
          </p>
          {!search && filterTab === "all" && (
            <Button onClick={() => { setEditing(null); setShowForm(true); }} size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Customer
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <CustomerCard key={c.id} customer={c} onSelect={setSelectedCustomer} onToggleFav={toggleFav} />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map(c => (
              <CustomerListRow key={c.id} customer={c} onSelect={setSelectedCustomer} onToggleFav={toggleFav} />
            ))}
          </div>
        </div>
      )}

      {/* Customer Drawer */}
      {selectedCustomer && (
        <CustomerDrawer
          customer={customers.find(c => c.id === selectedCustomer.id) || selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onEdit={(c) => { setEditing(c); setShowForm(true); }}
          onDelete={handleDelete}
          onToggleFav={toggleFav}
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] flex flex-col" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <CustomerForm initial={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerCard({ customer: c, onSelect, onToggleFav }) {
  const color = getAvatarColor(c.full_name);
  return (
    <div onClick={() => onSelect(c)}
      className="bg-card rounded-2xl border border-border hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group overflow-hidden">
      <div className="h-1.5 w-full" style={{ background: color }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-black text-white shrink-0 shadow-sm"
              style={{ background: color }}>
              {(c.full_name || "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-foreground truncate">{c.full_name}</p>
              {c.company_name && (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3 w-3 shrink-0" />{c.company_name}
                </p>
              )}
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); onToggleFav(c); }}
            className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors shrink-0">
            <Star className={`h-4 w-4 ${c.is_favorite ? "fill-amber-400 text-amber-400" : "text-gray-200 group-hover:text-gray-300"}`} />
          </button>
        </div>

        <div className="space-y-1.5">
          {c.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0 text-blue-400" />
              <span className="truncate">{c.email}</span>
            </div>
          )}
          {c.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0 text-emerald-400" />
              <span>{c.phone}</span>
            </div>
          )}
        </div>

        {c.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {c.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-100">{tag}</span>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/60 font-medium">{c.country || c.currency || ""}</span>
          <span className="text-[10px] text-purple-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">View profile →</span>
        </div>
      </div>
    </div>
  );
}

function CustomerListRow({ customer: c, onSelect, onToggleFav }) {
  const color = getAvatarColor(c.full_name);
  return (
    <div onClick={() => onSelect(c)}
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-purple-50/30 transition-colors cursor-pointer group">
      <button onClick={e => { e.stopPropagation(); onToggleFav(c); }} className="shrink-0">
        <Star className={`h-4 w-4 ${c.is_favorite ? "fill-amber-400 text-amber-400" : "text-gray-200 hover:text-amber-300"}`} />
      </button>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
        style={{ background: color }}>
        {(c.full_name || "?")[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0 grid md:grid-cols-4 gap-2 items-center">
        <div>
          <p className="text-sm font-semibold text-foreground truncate">{c.full_name}</p>
          {c.tags?.length > 0 && <span className="text-[10px] text-muted-foreground">{c.tags[0]}</span>}
        </div>
        <p className="text-sm text-muted-foreground truncate hidden md:block">{c.company_name || "—"}</p>
        <p className="text-sm text-muted-foreground truncate hidden md:block">{c.email || "—"}</p>
        <p className="text-sm text-muted-foreground hidden md:block">{c.phone || "—"}</p>
      </div>
      <span className="text-xs text-purple-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Open →</span>
    </div>
  );
}