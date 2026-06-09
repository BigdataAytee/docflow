import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, ChevronRight, Sparkles, X, PlayCircle } from "lucide-react";
import { useState } from "react";
import OnboardingGuide from "@/components/OnboardingGuide";

const CHECKLIST_ITEMS = [
  {
    id: "company_profile",
    step: 1,
    label: "Set up your company profile",
    desc: "Add your company name, address, email and phone",
    path: "/settings",
    time: "2 min",
    checkFn: (user) => !!(user?.company_name && user?.company_address && user?.company_email && user?.company_phone),
  },
  {
    id: "logo",
    step: 2,
    label: "Upload your company logo",
    desc: "Brand all your documents with your logo",
    path: "/settings",
    time: "1 min",
    checkFn: (user) => !!user?.logo_url,
  },
  {
    id: "customer",
    step: 3,
    label: "Add your first customer",
    desc: "Save a customer for quick document creation",
    path: "/customers",
    time: "1 min",
    checkFn: (user, counts) => (counts?.customers || 0) > 0,
  },
  {
    id: "document",
    step: 4,
    label: "Create your first document",
    desc: "Issue an invoice, quotation, receipt or waybill",
    path: "/documents/new",
    time: "3 min",
    checkFn: (user, counts) => (counts?.documents || 0) > 0,
  },
];

const DISMISS_KEY = "setup_checklist_dismissed_v2";

export default function SetupChecklist({ user, counts }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed]       = useState(() => !!localStorage.getItem(DISMISS_KEY));
  const [showGuide, setShowGuide]       = useState(false);

  if (dismissed) return null;

  const items = CHECKLIST_ITEMS.map(item => ({
    ...item,
    done: item.checkFn(user, counts),
  }));

  const completedCount = items.filter(i => i.done).length;
  const allDone        = completedCount === items.length;
  const pct            = Math.round((completedCount / items.length) * 100);
  const nextItem       = items.find(i => !i.done);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (allDone) {
    return (
      <div className="relative rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 text-xl">🎉</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-emerald-900">Setup Complete!</p>
          <p className="text-xs text-emerald-700 mt-0.5">Your account is fully set up. You're ready to create professional documents.</p>
        </div>
        <button onClick={handleDismiss} className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-400 hover:text-emerald-700 transition-colors shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">

        {/* Header */}
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 70%,#3730a3 100%)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-yellow-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Getting Started</p>
              <p className="text-[11px] text-white/50 mt-0.5">{completedCount} of {items.length} steps done</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Progress pill */}
            <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-full px-3 py-1">
              <div className="w-20 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: "linear-gradient(90deg,#818cf8,#a78bfa)" }}
                />
              </div>
              <span className="text-[11px] font-bold text-white/70">{pct}%</span>
            </div>

            <button
              onClick={() => setShowGuide(true)}
              className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-white/70 hover:text-white transition-colors"
            >
              <PlayCircle className="h-3.5 w-3.5" /> Guide
            </button>

            <button onClick={handleDismiss} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile progress bar */}
        <div className="sm:hidden h-1 bg-slate-100">
          <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#6366f1,#3b82f6)" }} />
        </div>

        {/* Steps */}
        <div className="divide-y divide-border">
          {items.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => !item.done && navigate(item.path)}
              disabled={item.done}
              className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors ${
                item.done ? "cursor-default bg-slate-50/50" : "hover:bg-indigo-50/60 cursor-pointer group"
              }`}
            >
              {/* Step circle */}
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                item.done
                  ? "border-emerald-400 bg-emerald-50"
                  : nextItem?.id === item.id
                  ? "border-indigo-400 bg-indigo-50 group-hover:bg-indigo-100"
                  : "border-slate-200 bg-white"
              }`}>
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <span className={`text-xs font-bold ${nextItem?.id === item.id ? "text-indigo-500" : "text-slate-300"}`}>
                    {item.step}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-tight ${
                  item.done ? "text-slate-400 line-through" : "text-slate-800"
                }`}>
                  {item.label}
                </p>
                {!item.done && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                )}
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2 shrink-0">
                {!item.done && (
                  <>
                    <span className="text-[10px] text-muted-foreground hidden sm:block">{item.time}</span>
                    {nextItem?.id === item.id && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">Next</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-border bg-slate-50/60 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            {nextItem
              ? <>Up next: <span className="font-semibold text-slate-600">{nextItem.label}</span></>
              : "All steps complete!"}
          </p>
          <button
            onClick={() => setShowGuide(true)}
            className="sm:hidden flex items-center gap-1 text-[11px] font-semibold text-indigo-600"
          >
            <PlayCircle className="h-3.5 w-3.5" /> View guide
          </button>
        </div>
      </div>

      {showGuide && <OnboardingGuide forceOpen onClose={() => setShowGuide(false)} />}
    </>
  );
}