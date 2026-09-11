import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronRight, ChevronLeft, CheckCircle2, Sparkles, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import ONBOARDING_STEPS from "./onboarding/onboardingSteps";
import StepVisual from "./onboarding/StepVisual";

const STORAGE_KEY = "onboarding_v3_completed";
const STEP_KEY    = "onboarding_v3_step";

export default function OnboardingGuide({ forceOpen = false, onClose }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [step, setStep]       = useState(0);
  const total = ONBOARDING_STEPS.length;

  useEffect(() => {
    if (forceOpen) { setStep(0); setVisible(true); return; }
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const saved = parseInt(localStorage.getItem(STEP_KEY) || "0", 10);
      setStep(Math.min(saved, total - 1));
      setVisible(true);
    }
  }, [forceOpen]);

  useEffect(() => {
    if (visible) localStorage.setItem(STEP_KEY, String(step));
  }, [step, visible]);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    onClose && onClose();
  };

  const next = () => step < total - 1 ? setStep(s => s + 1) : close();
  const prev = () => setStep(s => Math.max(0, s - 1));
  const goTo = (i) => setStep(i);

  const handleCta = (path) => { close(); navigate(path); };

  if (!visible) return null;

  const current = ONBOARDING_STEPS[step];
  const isLast  = step === total - 1;
  const pct     = Math.round(((step + 1) / total) * 100);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />

      <div
        className="relative w-full sm:max-w-3xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "95dvh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col md:flex-row flex-1 min-h-0">

          {/* ── LEFT PANEL: visual + step nav ── */}
          <div
            className="hidden md:flex flex-col w-64 shrink-0 relative overflow-hidden"
            style={{ background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 55%,#3730a3 100%)" }}
          >
            {/* Top branding */}
            <div className="px-5 pt-5 pb-4 shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-yellow-300" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Getting Started</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: "linear-gradient(90deg,#818cf8,#a78bfa)" }}
                />
              </div>
              <p className="text-[10px] text-white/40 mt-1.5">{step + 1} of {total} steps · {pct}% complete</p>
            </div>

            {/* Step nav list */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
              {ONBOARDING_STEPS.map((s, i) => {
                const done = i < step;
                const active = i === step;
                return (
                  <button
                    key={s.id}
                    onClick={() => goTo(i)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all ${
                      active ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80 hover:bg-white/8"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      done ? "bg-emerald-400 border-emerald-400" : active ? "border-white bg-white/20" : "border-white/30"
                    }`}>
                      {done
                        ? <Check className="h-2.5 w-2.5 text-white" />
                        : <span className="text-[8px] font-bold text-white">{i + 1}</span>
                      }
                    </div>
                    <span className={`text-[11px] font-semibold leading-tight truncate ${active ? "text-white" : ""}`}>
                      {s.category}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Decorative blob */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-10 pointer-events-none"
              style={{ background: "radial-gradient(circle,#a78bfa,transparent 70%)" }} />
          </div>

          {/* ── RIGHT PANEL: content ── */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

            {/* Mobile header */}
            <div className="md:hidden px-5 pt-4 pb-3 border-b border-border shrink-0 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg,#1e1b4b,#3730a3)" }}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Getting Started</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/50 font-bold">{step + 1}/{total}</span>
                <button onClick={close} className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                  <X className="h-3 w-3 text-white/70" />
                </button>
              </div>
            </div>

            {/* Mobile progress */}
            <div className="md:hidden h-1 bg-slate-100 shrink-0">
              <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#6366f1,#3b82f6)" }} />
            </div>

            {/* Desktop close */}
            <button
              onClick={close}
              className="hidden md:flex absolute top-4 right-4 z-10 w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 items-center justify-center transition-colors"
            >
              <X className="h-4 w-4 text-slate-500" />
            </button>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col md:flex-row gap-0 h-full">

                {/* Content */}
                <div className="flex-1 px-6 pt-6 pb-4 md:pb-6">
                  {/* Category */}
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">{current.category}</p>

                  {/* Icon + Title */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl shrink-0">
                      {current.icon}
                    </div>
                    <h2 className="text-xl font-black text-slate-900 leading-tight pt-1">{current.title}</h2>
                  </div>

                  <p className="text-sm text-slate-500 leading-relaxed mb-4">{current.body}</p>

                  {/* Bullet highlights */}
                  {current.bullets && (
                    <div className="space-y-2 mb-4">
                      {current.bullets.map((b, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="h-2.5 w-2.5 text-indigo-600" />
                          </div>
                          <span className="text-sm text-slate-600 leading-snug">{b}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tip */}
                  {current.tip && (
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <span className="text-base shrink-0 mt-0.5">💡</span>
                      <p className="text-xs text-amber-800 leading-relaxed">{current.tip}</p>
                    </div>
                  )}
                </div>

                {/* Visual preview — right side on desktop, below content on mobile */}
                <div className="md:w-52 shrink-0 px-4 pb-4 md:py-6 md:pr-5 md:pl-0">
                  <div className="md:sticky md:top-4">
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2 hidden md:block text-center">Preview</p>
                    <div className="scale-90 origin-top-left md:scale-100 md:origin-top">
                      <StepVisual visual={current.visual} />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3 bg-white">
              <button
                onClick={prev}
                disabled={step === 0}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>

              <div className="flex items-center gap-2">
                {current.cta && current.ctaPath && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCta(current.ctaPath)}
                    className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs"
                  >
                    {current.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={next}
                  className="gap-1.5 font-bold px-5"
                  style={{ background: "linear-gradient(135deg,#4f46e5,#3b82f6)" }}
                >
                  {isLast
                    ? <><CheckCircle2 className="h-4 w-4" /> Finish</>
                    : <>Next <ChevronRight className="h-4 w-4" /></>
                  }
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}