import { Link, useLocation } from "react-router-dom";
import { Users, Settings, LogOut, ShieldAlert, Home, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Home",        icon: Home,       path: "/" },
  { label: "Customers",   icon: Users,      path: "/customers" },
  { label: "Settings",    icon: Settings,   path: "/settings" },
  { label: "Help Center", icon: HelpCircle, path: "/help" },
];



export default function Sidebar({ onClose }) {
  const location = useLocation();
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user) {
        setCompanyName(user.company_name || user.full_name || "");
        setCompanyEmail(user.company_email || user.email || "");
        setIsAdmin(user.role === "admin");
        setLogoUrl(user.logo_url || "");
      }
    });
  }, []);

  const initials = companyName
    ? companyName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "MB";

  return (
    <aside className="h-full w-64 flex flex-col" style={{ background: "linear-gradient(180deg, hsl(224,30%,10%) 0%, hsl(228,28%,13%) 100%)" }}>

      {/* Brand header */}
      <div className="relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #818cf8, transparent 70%)" }} />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #38bdf8, transparent 70%)" }} />

        <div className="relative px-4 pt-5 pb-4">
          {/* Logo / Avatar */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="relative">
              {/* Glow ring */}
              <div className="absolute inset-0 rounded-2xl blur-md opacity-60" style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }} />
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="relative w-14 h-14 rounded-2xl object-contain bg-white/95 shadow-xl"
                  style={{ padding: 3 }}
                />
              ) : (
                <div
                  className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-xl"
                  style={{ background: "linear-gradient(135deg,#6366f1 0%,#3b82f6 50%,#06b6d4 100%)" }}
                >
                  {initials}
                </div>
              )}
              {/* Active dot */}
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 rounded-full" style={{ borderColor: "hsl(226,30%,11%)" }} />
            </div>

            <div className="min-w-0 w-full">
              <p
                className="font-black text-sm leading-tight truncate"
                style={{
                  background: "linear-gradient(90deg, #e0e7ff 0%, #a5b4fc 40%, #38bdf8 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  letterSpacing: "0.04em",
                  textShadow: "none",
                }}
              >
                {companyName || "My Business"}
              </p>
              <p className="text-white/35 text-[10px] truncate mt-0.5 font-medium lowercase">{companyEmail}</p>
            </div>

            {/* Decorative accent line */}
            <div className="flex items-center gap-1.5 w-full mt-0.5">
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(99,102,241,0.6))" }} />
              <div className="w-1 h-1 rounded-full bg-indigo-400/70" />
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400/80" />
              <div className="w-1 h-1 rounded-full bg-indigo-400/70" />
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, rgba(99,102,241,0.6))" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/[0.07] mb-3" />

      {/* Nav label */}
      <p className="px-5 text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Navigation</p>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {isAdmin && (
          <Link
            to="/admin"
            onClick={() => onClose && onClose()}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
              location.pathname === "/admin"
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/50 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
              location.pathname === "/admin" ? "bg-red-500/20" : "bg-white/5 group-hover:bg-white/10"
            }`}>
              <ShieldAlert className={`h-3.5 w-3.5 ${ location.pathname === "/admin" ? "text-red-400" : "text-white/50 group-hover:text-white/80" }`} />
            </div>
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                active
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/50 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                active
                  ? "bg-white/15"
                  : "bg-white/5 group-hover:bg-white/10"
              }`}>
                <item.icon className={`h-3.5 w-3.5 transition-colors ${ active ? "text-white" : "text-white/50 group-hover:text-white/80" }`} />
              </div>
              {item.label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom sign out */}
      <div className="mx-4 h-px bg-white/[0.07] mt-2" />
      <div className="p-3">
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/[0.06] transition-all w-full group"
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