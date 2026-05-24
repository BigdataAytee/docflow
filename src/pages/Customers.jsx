import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Star, MoreHorizontal, Pencil, Trash2, Users, Building2, Mail, Phone } from "lucide-react";
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{customers.length} total customers</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Customer
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border">
        {/* Search bar */}
        <div className="p-3 md:p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customers..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No customers found</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={e => { e.stopPropagation(); toggleFav(c); }}>
                            <Star className={`h-4 w-4 ${c.is_favorite ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                          </button>
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {(c.full_name || "?")[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">{c.full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{c.company_name || "—"}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{c.email || "—"}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{c.phone || "—"}</td>
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
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
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet cards */}
            <div className="md:hidden divide-y divide-border">
              {filtered.map(c => (
                <div key={c.id} className="flex items-start gap-3 px-4 py-4 hover:bg-muted/30 transition-colors">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {(c.full_name || "?")[0].toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-semibold text-foreground truncate">{c.full_name}</span>
                      {c.is_favorite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                    </div>
                    {c.company_name && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.company_name}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleFav(c)} className="p-1.5 hover:bg-muted rounded-full">
                      <Star className={`h-4 w-4 ${c.is_favorite ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
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
                  </div>
                </div>
              ))}
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