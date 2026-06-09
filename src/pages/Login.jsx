import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, Eye, EyeOff, FileText, FileCheck, Receipt, Truck, Sparkles, ArrowRight } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";

const FEATURES = [
  { icon: FileText,  label: "Invoices",    color: "#3b82f6", desc: "Professional & on-brand" },
  { icon: FileCheck, label: "Quotations",  color: "#8b5cf6", desc: "Win more clients" },
  { icon: Receipt,   label: "Receipts",    color: "#10b981", desc: "Instant confirmation" },
  { icon: Truck,     label: "Waybills",    color: "#f59e0b", desc: "Track every delivery" },
];

function FloatingDoc({ style, type, num, status, gradient }) {
  const statusColors = { paid: "#10b981", sent: "#3b82f6", draft: "#94a3b8", pending: "#f59e0b" };
  return (
    <div
      className="absolute bg-white rounded-2xl shadow-xl border border-white/60 px-3.5 py-2.5 min-w-[140px]"
      style={style}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: gradient }}>
          <div className="w-2.5 h-2.5 bg-white/80 rounded-sm" />
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{type}</span>
      </div>
      <p className="text-xs font-black text-slate-800">{num}</p>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[9px] text-slate-400">Acme Ltd</span>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize"
          style={{ background: (statusColors[status] || "#94a3b8") + "20", color: statusColors[status] || "#94a3b8" }}
        >
          {status}
        </span>
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT BRAND PANEL ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col flex-1 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg,#0f0c29 0%,#1e1b4b 40%,#24166e 70%,#1a3a6b 100%)" }}
      >
        {/* Animated glowing orbs */}
        <div className="absolute top-[-80px] left-[-80px] w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle,#6366f1,transparent 70%)" }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-80 h-80 rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle,#3b82f6,transparent 70%)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle,#a78bfa,transparent 70%)" }} />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)",
            backgroundSize: "40px 40px"
          }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-12">

          {/* Logo / Brand */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6)" }}>
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-black text-white tracking-tight">DocFlow</span>
              <div className="flex items-center gap-1 mt-0.5">
                <Sparkles className="h-2.5 w-2.5 text-yellow-400" />
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Business Suite</span>
              </div>
            </div>
          </div>

          {/* Hero copy */}
          <div className="my-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/80">Trusted by businesses worldwide</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
              Professional<br />
              documents,<br />
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(90deg,#818cf8,#38bdf8)" }}>
                in seconds.
              </span>
            </h1>
            <p className="text-white/50 text-base leading-relaxed max-w-xs">
              Create invoices, quotations, receipts and waybills — branded and ready to send.
            </p>

            {/* Feature pills */}
            <div className="grid grid-cols-2 gap-2.5 mt-8">
              {FEATURES.map(({ icon: Icon, label, color, desc }) => (
                <div key={label}
                  className="flex items-center gap-2.5 bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/12 transition-colors">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: color + "30" }}>
                    <Icon className="h-3.5 w-3.5" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">{label}</p>
                    <p className="text-[9px] text-white/40 leading-tight">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating document cards */}
          <div className="relative h-36 mt-8 mb-4">
            <FloatingDoc
              style={{ bottom: 8, left: 0, transform: "rotate(-3deg)", opacity: 0.92 }}
              type="Invoice" num="#INV-024" status="paid"
              gradient="linear-gradient(135deg,#3b82f6,#1d4ed8)"
            />
            <FloatingDoc
              style={{ bottom: 24, left: 160, transform: "rotate(2deg)", opacity: 0.85 }}
              type="Quotation" num="#QUO-011" status="sent"
              gradient="linear-gradient(135deg,#8b5cf6,#6d28d9)"
            />
            <FloatingDoc
              style={{ bottom: 4, right: 0, transform: "rotate(-1deg)", opacity: 0.80 }}
              type="Waybill" num="#WB-008" status="pending"
              gradient="linear-gradient(135deg,#f59e0b,#d97706)"
            />
          </div>

          {/* Testimonial */}
          <div className="border-t border-white/10 pt-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">S</div>
              <div>
                <p className="text-xs text-white/60 italic leading-relaxed">
                  "DocFlow saves me hours every week. My invoices look incredibly professional."
                </p>
                <p className="text-[10px] text-white/30 mt-1 font-semibold">Sarah K. · Freelance Consultant</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ─────────────────────────────────────── */}
      <div className="flex-1 lg:max-w-[480px] flex flex-col justify-center px-6 py-10 sm:px-10 bg-white relative">

        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 mb-10 lg:hidden">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6)" }}>
            <FileText className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-lg font-black text-slate-900">DocFlow</span>
        </div>

        {/* Heading */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
            Welcome back 👋
          </h2>
          <p className="text-sm text-slate-400 mt-2">Sign in to your DocFlow account to continue</p>
        </div>

        {/* Google */}
        <Button
          variant="outline"
          className="w-full h-12 text-sm font-semibold border-slate-200 hover:border-slate-300 hover:bg-slate-50 mb-6 gap-2.5 shadow-sm"
          onClick={handleGoogle}
        >
          <GoogleIcon className="w-5 h-5" />
          Continue with Google
        </Button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-slate-400 font-medium">or sign in with email</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-10 h-12 border-slate-200 focus-visible:ring-indigo-500 focus-visible:border-indigo-400"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
              <Link to="/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12 border-slate-200 focus-visible:ring-indigo-500 focus-visible:border-indigo-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 font-bold text-sm gap-2 shadow-md mt-2"
            style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6)" }}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
            ) : (
              <>Sign in <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-slate-400 mt-8">
          Don't have an account?{" "}
          <Link to="/register" className="text-indigo-600 font-semibold hover:text-indigo-700 hover:underline">
            Create one free →
          </Link>
        </p>

        <p className="text-center text-xs text-slate-300 mt-6">
          © {new Date().getFullYear()} DocFlow · All rights reserved
        </p>
      </div>
    </div>
  );
}