import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Star, MoreHorizontal, Pencil, Trash2, Users, Building2, Mail, Phone, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import CustomerForm from "../components/CustomerForm";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => {
    base44.auth.me().then(user => {
      if (!user) return;
      base44.entities.Customer.filter({ created_by: user.email }, "-created_date", 100).then(c => { setCustomers(c); setLoading(false); });
    });
  };
  useEffect(load, []);

  const filtered = customers.filter(c =>
    (c.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data) => {
    if (editing) await base44.entities.Customer.update(editing.id, data);
    else await base44.entities.Customer.create(data);
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.Customer.delete(id);
    load();
  };

  const toggleFav = async (c) => {
    await base44.entities.Customer.update(c.id, { is_favorite: !c.is_favorite });
    load();
  };

  const favorites = customers.filter(c => c.is_favorite).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Hero banner */}
      <div
        className="relative rounded-3xl overflow-hidden px-6 py-7 md:px-10 md:py-9"
        style={{ background: "linear-gradient(135deg,#7c3aed 0%,#4f46e5 60%,#2563eb 100%)", boxShadow: "0 8px 40px rgba(124,58,237,0.25)" }}
      >
        <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-10 -left-6 w-36 h-36 rounded-full bg-black/10 pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Contact Book</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">👥 Customers</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-white/70 text-sm">{customers.length} total</span>
              {favorites > 0 && (
                <span className="flex items-center gap-1 text-amber-300 text-sm font-medium">
                  <Star className="h-3.5 w-3.5 fill-amber-300" /> {favorites} starred
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 w-fit border border-white/20"
          >
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm">
        {/* Search bar */}
        <div className="p-3 md:p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, company, or email…" value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-purple-300" />
            </div>
            <p className="font-semibold text-foreground mb-1">No customers found</p>
            <p className="text-sm text-muted-foreground">Try a different search or add a new customer.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40 text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => {
                    const colors = ["#7c3aed","#4f46e5","#2563eb","#0891b2","#059669","#d97706","#dc2626","#db2777"];
                    const avatarColor = colors[(c.full_name || "").charCodeAt(0) % colors.length];
                    return (
                      <tr key={c.id} className={`border-t border-border hover:bg-purple-50/40 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <button onClick={e => { e.stopPropagation(); toggleFav(c); }} className="shrink-0">
                              <Star className={`h-4 w-4 transition-colors ${c.is_favorite ? "fill-amber-400 text-amber-400" : "text-gray-200 hover:text-amber-300"}`} />
                            </button>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: avatarColor }}>
                              {(c.full_name || "?")[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{c.full_name}</p>
                              {c.tags?.length > 0 && <span className="text-xs text-muted-foreground">{c.tags.slice(0,2).join(", ")}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          {c.company_name ? (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Building2 className="h-3.5 w-3.5 shrink-0" />{c.company_name}
                            </div>
                          ) : <span className="text-muted-foreground/40 text-sm">—</span>}
                        </td>
                        <td className="px-6 py-3.5">
                          {c.email ? (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="h-3.5 w-3.5 shrink-0" />{c.email}
                            </div>
                          ) : <span className="text-muted-foreground/40 text-sm">—</span>}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-muted-foreground">{c.phone || <span className="text-muted-foreground/40">—</span>}</td>
                        <td className="px-6 py-3.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-purple-100"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditing(c); setShowForm(true); }}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {filtered.map(c => {
                const colors = ["#7c3aed","#4f46e5","#2563eb","#0891b2","#059669","#d97706","#dc2626","#db2777"];
                const avatarColor = colors[(c.full_name || "").charCodeAt(0) % colors.length];
                return (
                  <div key={c.id} className="flex items-start gap-3 px-4 py-4 hover:bg-purple-50/30 transition-colors">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: avatarColor }}>
                      {(c.full_name || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm font-semibold text-foreground truncate">{c.full_name}</span>
                        {c.is_favorite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                      </div>
                      {c.company_name && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{c.company_name}</span></div>}
                      {c.email && <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{c.email}</span></div>}
                      {c.phone && <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Phone className="h-3 w-3 shrink-0" /><span>{c.phone}</span></div>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleFav(c)} className="p-1.5 hover:bg-amber-50 rounded-xl transition-colors">
                        <Star className={`h-4 w-4 ${c.is_favorite ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(c); setShowForm(true); }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
          <CustomerForm initial={editing} onSave={handleSave} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}