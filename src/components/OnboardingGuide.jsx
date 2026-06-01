import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronRight, ChevronLeft, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ONBOARDING_STEPS from "./onboarding/onboardingSteps";

const STORAGE_KEY = "onboarding_v1_completed";
const STEP_KEY    = "onboarding_v1_step";

export default function OnboardingGuide({ forceOpen = false, onClose }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
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
  const isLast = step === total - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: "90dvh" }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-500">Getting Started</span>
          </div>
          <button
            onClick={close}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step card */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl mb-5 shadow-sm">
            {current.icon}
          </div>

          {/* Content */}
          <h2 className="text-xl font-black text-foreground leading-tight mb-3">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">{current.body}</p>

          {/* Tip */}
          {current.tip && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="text-base shrink-0 mt-0.5">💡</span>
              <p className="text-xs text-amber-800 leading-relaxed">{current.tip}</p>
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 px-6 py-3 shrink-0">
          {ONBOARDING_STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all duration-200 ${
                i === step
                  ? "w-6 h-2 bg-indigo-600"
                  : i < step
                  ? "w-2 h-2 bg-indigo-300"
                  : "w-2 h-2 bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={prev}
            disabled={step === 0}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <div className="flex items-center gap-2">
            {current.cta && current.ctaPath && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCta(current.ctaPath)}
                className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                {current.cta}
              </Button>
            )}
            <Button
              size="sm"
              onClick={next}
              className="gap-1.5 font-bold"
              style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6)" }}
            >
              {isLast ? (
                <><CheckCircle2 className="h-4 w-4" /> Done</>
              ) : (
                <>Next <ChevronRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>

        {/* Step counter */}
        <div className="absolute top-5 right-12 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
          {step + 1} / {total}
        </div>
      </div>
    </div>
  );
}