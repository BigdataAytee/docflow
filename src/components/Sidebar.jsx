import { Link, useLocation } from "react-router-dom";
import { Users, Settings, LogOut, Mail, LayoutGrid, ShieldAlert, Home } from "lucide-react";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Home",        icon: Home,       path: "/" },
  { label: "Customers",   icon: Users,      path: "/customers" },
  { label: "Mail",        icon: Mail,       path: "/mail" },
  { label: "Apps & Tools",icon: LayoutGrid, path: "/apps" },
  { label: "Settings",    icon: Settings,   path: "/settings" },
];



export default function Sidebar({ onClose }) {
  const location = useLocation();
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user) {
        setCompanyName(user.company_name || user.full_name || "");
        setCompanyEmail(user.company_email || user.email || "");
        setIsAdmin(user.role === "admin");
      }
    });
  }, []);

  return (
    <aside className="h-full w-64 bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="p-6 pb-4">
        <h1 className="text-lg font-bold text-white tracking-tight">{companyName || "My Business"}</h1>
        <p className="text-xs text-sidebar-foreground/50 mt-0.5">{companyEmail}</p>
      </div>



      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {isAdmin && (
          <Link
            to="/admin"
            onClick={() => onClose && onClose()}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              location.pathname === "/admin"
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50"
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            Admin Dashboard
          </Link>
        )}
        {navItems.map((item, idx) => {
          const active = item.path === "/"
            ? location.pathname === "/"
            : location.pathname + location.search === item.path || (item.path !== "/" && location.pathname.startsWith(item.path.split("?")[0]) && item.path.split("?")[0] !== "/");
          return (
            <Link
              key={item.path + idx}
              to={item.path}
              onClick={() => onClose && onClose()}
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