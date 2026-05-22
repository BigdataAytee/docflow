import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, FileText, Settings, Plus, ChevronDown, LogOut, Mail, LayoutGrid } from "lucide-react";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Documents", icon: FileText, path: "/documents" },
  { label: "Customers", icon: Users, path: "/customers" },
  { label: "Mail", icon: Mail, path: "/mail" },
  { label: "Apps & Tools", icon: LayoutGrid, path: "/apps" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

const docTypes = [
  { label: "Invoice", value: "invoice" },
  { label: "Quotation", value: "quotation" },
  { label: "Receipt", value: "receipt" },
  { label: "Waybill", value: "waybill" },
  { label: "Letterhead", value: "letterhead" },
  { label: "Purchase Order", value: "purchase_order" },
  { label: "Delivery Note", value: "delivery_note" },
  { label: "Credit Note", value: "credit_note" },
];

export default function Sidebar() {
  const location = useLocation();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar text-sidebar-foreground flex flex-col z-50">
      <div className="p-6 pb-4">
        <h1 className="text-lg font-bold text-white tracking-tight">DocFlow</h1>
        <p className="text-xs text-sidebar-foreground/50 mt-0.5">Business Documents</p>
      </div>

      <div className="px-3 mb-4">
        <div className="relative">
          <Button
            onClick={() => setShowCreate(!showCreate)}
            className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-white justify-between"
          >
            <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> New Document</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${showCreate ? "rotate-180" : ""}`} />
          </Button>
          {showCreate && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-sidebar-accent rounded-lg border border-sidebar-border overflow-hidden shadow-xl z-10">
              {docTypes.map(dt => (
                <Link
                  key={dt.value}
                  to={`/documents/new?type=${dt.value}`}
                  onClick={() => setShowCreate(false)}
                  className="block px-4 py-2.5 text-sm hover:bg-sidebar-primary/20 text-sidebar-foreground transition-colors"
                >
                  {dt.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(item => {
          const active = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-accent/50 transition-all w-full"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </aside>
  );
}