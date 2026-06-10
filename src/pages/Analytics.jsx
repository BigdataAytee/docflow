import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import { BarChart2, ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function Analytics() {
  const navigate = useNavigate();

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex-1" />
      </div>

      <div
        className="relative rounded-3xl overflow-hidden px-6 py-8 md:px-10 md:py-10"
        style={{ background: "linear-gradient(120deg, #0f0f23 0%, #0d1a2e 40%, #0a1628 100%)" }}
      >
        {/* Animated grid bg */}
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute -top-10 left-1/3 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.3), transparent 65%)", filter: "blur(40px)" }} />
        <div className="absolute -bottom-10 right-1/4 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.2), transparent 65%)", filter: "blur(30px)" }} />

        <div className="relative z-10 flex items-center gap-5">
          <div className="relative shrink-0">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #6366f1, #4338ca)", boxShadow: "0 6px 28px rgba(99,102,241,0.55)" }}>
              <BarChart2 className="h-7 w-7 md:h-8 md:w-8 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#0f0f23]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-ping absolute inset-0 m-auto" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(99,102,241,0.85)" }}>Business Intelligence</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>AI</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">Analytics & Insights</h1>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
              Revenue trends, top customers, sales funnel & AI-powered recommendations
            </p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-300">Powered by AI</span>
          </div>
        </div>
      </div>

      {user && <AnalyticsDashboard user={user} />}
    </div>
  );
}