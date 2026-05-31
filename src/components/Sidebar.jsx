import { Link, useLocation } from "react-router-dom";
import { Users, Settings, LogOut, Mail, LayoutGrid, ShieldAlert, Home, FileText, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const navItems = [
  { label: "Home",         icon: Home,       path: "/",          color: "#6366f1" },
  { label: "Customers",    icon: Users,       path: "/customers", color: "#3b82f6" },
  { label: "Mail",         icon: Mail,        path: "/mail",      color: "#10b981" },
  { label: "Apps & Tools", icon: LayoutGrid,  path: "/apps",      color: "#f59e0b" },
  { label: "Settings",     icon: Settings,    path: "/settings",  color: "#8b5cf6" },
];

export default function Sidebar({ onClose }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u) { setUser(u); setIsAdmin(u.role === "admin"); }
    });
  }, []);

  const companyName = user?.company_name || user?.full_name || "My Business";
  const companyEmail = user?.company_email || user?.email || "";
  const initials = companyName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside
      className="h-full w-64 flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0f1629 0%, #111827 50%, #0d1520 100%)" }}
    >
      {/* Ambient glow blobs */}
      <div className="absolute top-0 left-0 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", transform: "translate(-30%, -30%)" }} />
      <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)", transform: "translate(30%, 30%)" }} />

      {/* Brand card */}
      <div className="relative z-10 mx-3 mt-4 mb-3 rounded-2xl p-4"
        style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(59,130,246,0.08) 100%)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" }}
            >
              {initials}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111827]" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">{companyName}</p>
            <p className="text-white/35 text-[11px] truncate mt-0.5">{companyEmail}</p>
          </div>
        </div>
      </div>

      {/* Section label */}
      <p className="relative z-10 px-5 text-[9px] font-black uppercase tracking-[0.18em] text-white/20 mb-2">Menu</p>

      {/* Nav */}
      <nav className="relative z-10 flex-1 px-2.5 space-y-0.5 overflow-y-auto">
        {isAdmin && (() => {
          const active = location.pathname === "/admin";
          return (
            <Link
              to="/admin"
              onClick={() => onClose?.()}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group relative overflow-hidden"
              style={{ background: active ? "rgba(239,68,68,0.12)" : "transparent", color: active ? "#fca5a5" : "rgba(255,255,255,0.4)" }}
            >
              {active && <div className="absolute inset-0 rounded-xl" style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.12), transparent)" }} />}
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative z-10"
                style={{ background: active ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)" }}>
                <ShieldAlert className="h-3.5 w-3.5" />
              </div>
              <span className="relative z-10">Admin</span>
              {active && <div className="ml-auto w-1 h-5 rounded-full relative z-10" style={{ background: "#f87171" }} />}
            </Link>
          );
        })()}

        {navItems.map((item, idx) => {
          const active = item.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.path.split("?")[0]) && item.path.split("?")[0] !== "/";
          return (
            <Link
              key={item.path + idx}
              to={item.path}
              onClick={() => onClose?.()}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group relative overflow-hidden"
              style={{
                background: active ? `${item.color}18` : "transparent",
                color: active ? "#ffffff" : "rgba(255,255,255,0.4)",
              }}
            >
              {/* Active background shimmer */}
              {active && (
                <div className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{ background: `linear-gradient(90deg, ${item.color}14, transparent)` }} />
              )}
              {/* Icon container */}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative z-10 transition-all"
                style={{
                  background: active ? `${item.color}30` : "rgba(255,255,255,0.05)",
                  boxShadow: active ? `0 0 12px ${item.color}40` : "none",
                }}
              >
                <item.icon
                  className="h-3.5 w-3.5 transition-colors"
                  style={{ color: active ? item.color : undefined }}
                />
              </div>
              <span className="relative z-10 flex-1">{item.label}</span>
              {/* Active pill */}
              {active && (
                <div className="ml-auto w-1 h-5 rounded-full relative z-10"
                  style={{ background: item.color }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom area */}
      <div className="relative z-10 p-2.5">
        <div className="h-px w-full mb-2.5" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-all w-full group"
        >
          <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-white/10 flex items-center justify-center shrink-0 transition-all">
            <LogOut className="h-3.5 w-3.5" />
          </div>
          Sign Out
        </button>
      </div>
    </aside>
  );
}