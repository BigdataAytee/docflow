import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, Eye, EyeOff, FileText, FileCheck, Receipt, Truck, Sparkles, ArrowRight, Shield, Zap, Star } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";

const FEATURES = [
  { icon: FileText,  label: "Invoices",   color: "#6366f1", desc: "Professional & on-brand" },
  { icon: FileCheck, label: "Quotations", color: "#8b5cf6", desc: "Win more clients"        },
  { icon: Receipt,   label: "Receipts",   color: "#10b981", desc: "Instant confirmation"    },
  { icon: Truck,     label: "Waybills",   color: "#f59e0b", desc: "Track every delivery"    },
];

const STATS = [
  { icon: Zap,    value: "2 min",  label: "avg. doc creation" },
  { icon: Shield, value: "100%",   label: "secure & private"  },
  { icon: Star,   value: "4.9★",   label: "user rating"       },
];

function FloatingDoc({ style, type, num, status, gradient, amount }) {
  const statusColors = { paid: "#10b981", sent: "#6366f1", draft: "#94a3b8", pending: "#f59e0b" };
  const sc = statusColors[status] || "#94a3b8";
  return (
    <div
      className="absolute bg-white/95 backdrop-blur-sm rounded-2xl border border-white/80 px-4 py-3 min-w-[152px]"
      style={{ ...style, boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: gradient }}>
            <div className="w-2 h-2 bg-white/90 rounded-sm" />
          </div>
          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{type}</span>
        </div>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize"
          style={{ background: sc + "22", color: sc }}>
          {status}
        </span>
      </div>
      <p className="text-xs font-black text-slate-800 mb-0.5">{num}</p>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-slate-400">Acme Ltd.</span>
        {amount && <span className="text-[10px] font-extrabold text-slate-700">{amount}</span>}
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [error, setError]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [showPassword, setShowPassword]   = useState(false);
  const [focusedField, setFocusedField]   = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => base44.auth.loginWithProvider("google", "/");

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans">

      {/* ══ LEFT BRAND PANEL ══════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col flex-1 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg,#09090f 0%,#12103a 35%,#1e1560 65%,#0e2a5c 100%)" }}
      >
        {/* Layered glow orbs */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle at 40% 40%,rgba(99,102,241,0.35),transparent 65%)", filter: "blur(60px)" }} />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle,rgba(59,130,246,0.28),transparent 65%)", filter: "blur(50px)" }} />
        <div className="absolute top-1/3 right-0 w-72 h-72 rounded-full"
          style={{ background: "radial-gradient(circle,rgba(167,139,250,0.18),transparent 65%)", filter: "blur(40px)" }} />

        {/* Subtle dot grid */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px,transparent 1px)",
            backgroundSize: "28px 28px",
          }} />

        {/* Diagonal accent line */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-[38%] w-px h-full opacity-10"
            style={{ background: "linear-gradient(180deg,transparent,rgba(99,102,241,0.8),transparent)" }} />
        </div>

        {/* Main content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-12">

          {/* Brand mark */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-2xl"
                style={{ background: "linear-gradient(135deg,#818cf8 0%,#6366f1 50%,#4338ca 100%)" }}>
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#12103a] bg-emerald-400" />
            </div>
            <div>
              <span className="text-[22px] font-black text-white tracking-tight leading-none">DocFlow</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Sparkles className="h-2.5 w-2.5 text-yellow-400" />
                <span className="text-[9px] font-bold text-white/35 uppercase tracking-[0.2em]">Business Suite</span>
              </div>
            </div>
          </div>

          {/* Hero section */}
          <div className="my-auto pt-10 pb-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-7 bg-white/[0.07] border border-white/[0.12] backdrop-blur-sm rounded-full px-4 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-white/75 tracking-wide">Trusted by 10,000+ businesses</span>
            </div>

            {/* Headline */}
            <h1 className="text-[2.8rem] xl:text-[3.2rem] font-black text-white leading-[1.08] tracking-tight mb-5">
              Beautiful docs,<br />
              <span style={{
                background: "linear-gradient(90deg,#a5b4fc 10%,#67e8f9 90%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                zero hassle.
              </span>
            </h1>
            <p className="text-[15px] text-white/45 leading-relaxed max-w-[300px]">
              Create stunning invoices, quotes, receipts & waybills — branded and ready to send in minutes.
            </p>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-2 mt-8">
              {FEATURES.map(({ icon: Icon, label, color, desc }) => (
                <div key={label}
                  className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.09] hover:border-white/[0.15] transition-all duration-200 cursor-default">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: color + "28" }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white/90 leading-tight">{label}</p>
                    <p className="text-[9px] text-white/35 leading-tight mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6 mt-8 pt-8 border-t border-white/[0.08]">
              {STATS.map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-indigo-400/80" />
                  <div>
                    <p className="text-[11px] font-extrabold text-white/80 leading-none">{value}</p>
                    <p className="text-[9px] text-white/30 mt-0.5 leading-none">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating document cards */}
          <div className="relative h-40 mb-5 mt-2">
            <FloatingDoc
              style={{ bottom: 10, left: 0, transform: "rotate(-4deg)" }}
              type="Invoice" num="INV-2024-047" status="paid" amount="₦142,000"
              gradient="linear-gradient(135deg,#6366f1,#4338ca)"
            />
            <FloatingDoc
              style={{ bottom: 30, left: "38%", transform: "rotate(2.5deg)" }}
              type="Quotation" num="QUO-2024-011" status="sent" amount="$8,500"
              gradient="linear-gradient(135deg,#8b5cf6,#6d28d9)"
            />
            <FloatingDoc
              style={{ bottom: 6, right: 0, transform: "rotate(-1.5deg)" }}
              type="Waybill" num="WB-2024-008" status="pending"
              gradient="linear-gradient(135deg,#f59e0b,#d97706)"
            />
          </div>

          {/* Testimonial */}
          <div className="flex items-start gap-3 pt-5 border-t border-white/[0.08]">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0"
              style={{ background: "linear-gradient(135deg,#818cf8,#a78bfa)" }}>S</div>
            <div>
              <p className="text-[12px] text-white/55 italic leading-relaxed">
                "DocFlow transformed how I bill clients. It's fast, beautiful, and my customers always compliment the invoices."
              </p>
              <p className="text-[10px] text-white/25 mt-1.5 font-semibold tracking-wide">Sarah K. · Freelance Consultant</p>
            </div>
          </div>
        </div>
      </div>

      {/* ══ RIGHT FORM PANEL ══════════════════════════════════════════ */}
      <div
        className="flex-1 lg:max-w-[460px] flex flex-col justify-center relative overflow-hidden"
        style={{ background: "linear-gradient(170deg,#fafbff 0%,#f4f6fd 60%,#eef1fa 100%)" }}
      >
        {/* Subtle top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 lg:h-1.5"
          style={{ background: "linear-gradient(90deg,#6366f1,#818cf8,#38bdf8)" }} />

        {/* Very faint background orb */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle at 80% 20%,rgba(99,102,241,0.07),transparent 65%)" }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle at 20% 80%,rgba(59,130,246,0.06),transparent 65%)" }} />

        <div className="relative z-10 flex flex-col px-8 sm:px-12 py-14 w-full">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg,#6366f1,#4338ca)" }}>
              <FileText className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tight">DocFlow</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-[0.15em] mb-2">Welcome back</p>
            <h2 className="text-[1.85rem] font-black text-slate-900 leading-tight tracking-tight">
              Sign in to DocFlow
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Your business documents, ready when you are.
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-xl font-semibold text-sm text-slate-700 bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-700 shadow-sm hover:shadow-md transition-all duration-200 mb-5"
          >
            <GoogleIcon className="w-5 h-5 shrink-0" />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-200/70" />
            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap tracking-wide">or with email</span>
            <div className="flex-1 h-px bg-slate-200/70" />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              </div>
              {error}
            </div>
          )}

          {/* Form card */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm space-y-4"
            style={{ boxShadow: "0 2px 24px rgba(99,102,241,0.07), 0 1px 4px rgba(0,0,0,0.05)" }}>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13px] font-semibold text-slate-600">Email address</Label>
                <div className="relative">
                  <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${focusedField === 'email' ? 'text-indigo-500' : 'text-slate-350'}`} style={{ color: focusedField === 'email' ? '#6366f1' : '#94a3b8' }} />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full pl-10 pr-4 h-12 rounded-xl border text-[15px] bg-slate-50/60 placeholder-slate-300 text-slate-800 outline-none transition-all duration-200"
                    style={{
                      borderColor: focusedField === 'email' ? '#a5b4fc' : '#e2e8f0',
                      boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
                    }}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[13px] font-semibold text-slate-600">Password</Label>
                  <Link to="/forgot-password" className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-600 hover:underline transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors" style={{ color: focusedField === 'password' ? '#6366f1' : '#94a3b8' }} />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full pl-10 pr-11 h-12 rounded-xl border text-[15px] bg-slate-50/60 placeholder-slate-300 text-slate-800 outline-none transition-all duration-200"
                    style={{
                      borderColor: focusedField === 'password' ? '#a5b4fc' : '#e2e8f0',
                      boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl font-bold text-[15px] text-white flex items-center justify-center gap-2.5 mt-1 transition-all duration-200 disabled:opacity-70"
                style={{
                  background: loading ? "#818cf8" : "linear-gradient(135deg,#6366f1 0%,#4f46e5 50%,#3730a3 100%)",
                  boxShadow: loading ? "none" : "0 4px 20px rgba(99,102,241,0.45), 0 1px 4px rgba(0,0,0,0.1)",
                }}
                onMouseEnter={e => !loading && (e.currentTarget.style.transform = "translateY(-1px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                ) : (
                  <>Sign in <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-[13px] text-slate-400 mt-6">
            New to DocFlow?{" "}
            <Link to="/register" className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors">
              Create a free account →
            </Link>
          </p>

          <p className="text-center text-[11px] text-slate-300 mt-5">
            © {new Date().getFullYear()} DocFlow · Secure & encrypted
          </p>
        </div>
      </div>
    </div>
  );
}