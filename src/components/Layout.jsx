import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Menu, Home, Users, Mail, Settings, Search, LayoutGrid } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CommandPalette from "./CommandPalette";
import OnboardingGuide from "./OnboardingGuide";

const bottomNavItems = [
{ label: "Home", icon: Home, path: "/" },
{ label: "Customers", icon: Users, path: "/customers" },
{ label: "Mail", icon: Mail, path: "/mail" },
{ label: "Apps", icon: LayoutGrid, path: "/apps" },
{ label: "Settings", icon: Settings, path: "/settings" }];


export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    base44.auth.me().then((user) => {
      if (user) setCompanyName(user.company_name || user.full_name || "");
    });
  }, []);

  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col w-64 shrink-0 fixed left-0 top-0 bottom-0 z-30">
        <Sidebar />
      </div>

      {/* Mobile/Tablet sidebar drawer overlay */}
      {sidebarOpen &&
      <div className="fixed inset-0 z-50 lg:hidden">
          <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)} />
        
          <div className="absolute left-0 top-0 bottom-0 w-72 z-10 shadow-2xl">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      }

      {/* Main content */}
      <main className="flex-1 min-w-0 min-h-screen flex flex-col lg:ml-64 overflow-x-hidden">
        {/* Mobile/Tablet top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-sidebar border-b border-sidebar-border shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-2 rounded-lg hover:bg-white/10 active:bg-white/20 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Open menu">
            
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-white font-bold text-base tracking-tight flex-1 truncate">
            {companyName || "My Business"}
          </span>
          <button
            onClick={() => setCmdOpen(true)}
            className="text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center hidden"
            aria-label="Search">
            
            <Search className="h-4 w-4" />
          </button>
        </div>

        {/* Page content */}
        <div className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 lg:pb-8">
          <Outlet />
          {/* Bottom spacer — clears fixed nav (56px) + action bar (~110px) + buffer */}
          <div
            className="lg:hidden"
            style={{ height: "calc(56px + env(safe-area-inset-bottom, 0px) + 140px)" }} />
          
        </div>
      </main>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <OnboardingGuide />

      {/* Mobile/Tablet Bottom Navigation */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar border-t border-sidebar-border flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        
        {bottomNavItems.map((item) => {
          const active =
          location.pathname === item.path ||
          item.path !== "/" && location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors touch-manipulation ${
              active ? "text-white" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80"}`
              }>
              
              <item.icon
                className={`h-5 w-5 transition-colors ${
                active ? "text-sidebar-primary" : ""}`
                } />
              
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </Link>);

        })}
      </nav>
    </div>);

}