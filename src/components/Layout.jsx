import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Menu, FileText, Users, Mail, Settings, Search, LayoutGrid } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CommandPalette from "./CommandPalette";

const bottomNavItems = [
  { label: "Docs",      icon: FileText,   path: "/documents" },
  { label: "Customers", icon: Users,      path: "/customers" },
  { label: "Mail",      icon: Mail,       path: "/mail" },
  { label: "Apps",      icon: LayoutGrid, path: "/apps" },
  { label: "Settings",  icon: Settings,   path: "/settings" },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user) setCompanyName(user.company_name || user.full_name || "");
    });
  }, []);

  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col w-64 shrink-0 fixed left-0 top-0 bottom-0 z-30">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 z-10 shadow-2xl">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 min-h-screen flex flex-col lg:ml-64">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-sidebar border-b border-sidebar-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-2 rounded-lg hover:bg-white/10 active:bg-white/20 min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-white font-bold text-base tracking-tight flex-1 truncate">{companyName || "My Business"}</span>
          <button onClick={() => setCmdOpen(true)} className="text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <Search className="h-4 w-4" />
          </button>
        </div>

        {/* Page content — bottom padding for mobile nav bar */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 lg:pb-8">
          <Outlet />
          {/* Guaranteed bottom spacer for mobile/tablet — clears nav + action bars */}
          <div className="lg:hidden" style={{ height: "calc(64px + env(safe-area-inset-bottom, 0px) + 80px)" }} />
        </div>
      </main>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar border-t border-sidebar-border flex" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {bottomNavItems.map(item => {
          const active = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors ${
                active ? "text-white" : "text-sidebar-foreground/50"
              }`}
            >
              <item.icon className={`h-5 w-5 ${active ? "text-sidebar-primary" : ""}`} />
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}