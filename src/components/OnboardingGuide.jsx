import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronRight, ChevronLeft, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ONBOARDING_STEPS from "./onboarding/onboardingSteps";

const STORAGE_KEY = "onboarding_v2_completed";
const STEP_KEY    = "onboarding_v2_step";

export default function OnboardingGuide({ forceOpen = false, onClose }) {
  const navigate  = useNavigate();
  const [visible, setVisible] = useState(false);
  const [step, setStep]       = useState(0);
  const total = ONBOARDING_STEPS.length;

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setVisible(true);
      return;
    }
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

  const next = () => {
    if (step < total - 1) setStep(s => s + 1);
    else close();
  };

  const prev = () => setStep(s => Math.max(0, s - 1));

  const handleCta = (ctaPath) => {
    close();
    navigate(ctaPath);
  };

  if (!visible) return null;

  const current = ONBOARDING_STEPS[step];
  const isLast  = step === total - 1;
  const pct     = Math.round(((step + 1) / total) * 100);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "92dvh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div
          className="px-6 pt-6 pb-5 shrink-0"
          style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#3730a3 100%)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-white/70">Getting Started</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white/50">{step + 1} / {total}</span>
              <button
                onClick={close}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="h-3.5 w-3.5 text-white/70" />
              </button>
            </div>
          </div>

          {/* Category badge */}
          <p className="text-xs font-semibold text-indigo-300 mb-1.5">{current.category}</p>

          {/* Progress bar */}
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg,#818cf8,#a78bfa)" }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl mb-5 shadow-sm border border-indigo-100">
            {current.icon}
          </div>

          <h2 className="text-xl font-black text-slate-900 leading-tight mb-3">{current.title}</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-5">{current.body}</p>

          {/* Tip */}
          {current.tip && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="text-base shrink-0 mt-0.5">💡</span>
              <p className="text-xs text-amber-800 leading-relaxed">{current.tip}</p>
            </div>
          )}
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 px-6 py-2 shrink-0">
          {ONBOARDING_STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all duration-200 ${
                i === step
                  ? "w-5 h-2 bg-indigo-600"
                  : i < step
                  ? "w-2 h-2 bg-indigo-300"
                  : "w-2 h-2 bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 pt-2 flex items-center justify-between gap-3 shrink-0">
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
                className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold"
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
              {isLast ? (
                <><CheckCircle2 className="h-4 w-4" /> Finish</>
              ) : (
                <>Next <ChevronRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}