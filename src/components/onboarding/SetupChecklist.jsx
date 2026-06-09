import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, ChevronRight, Sparkles, X } from "lucide-react";
import { useState } from "react";

const CHECKLIST_ITEMS = [
  {
    id: "company_profile",
    label: "Set up your company profile",
    desc: "Add your company name, address, email and phone",
    path: "/settings",
    checkFn: (user) => !!(user?.company_name && user?.company_address && user?.company_email && user?.company_phone),
  },
  {
    id: "logo",
    label: "Upload your company logo",
    desc: "Brand all your documents with your logo",
    path: "/settings",
    checkFn: (user) => !!user?.logo_url,
  },
  {
    id: "customer",
    label: "Add your first customer",
    desc: "Save a customer for quick document creation",
    path: "/customers",
    checkFn: (user, counts) => (counts?.customers || 0) > 0,
  },
  {
    id: "document",
    label: "Create your first document",
    desc: "Issue an invoice, quotation, receipt or waybill",
    path: "/documents/new",
    checkFn: (user, counts) => (counts?.documents || 0) > 0,
  },
];

const STORAGE_KEY = "setup_checklist_dismissed_v1";

export default function SetupChecklist({ user, counts }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(STORAGE_KEY));

  if (dismissed) return null;

  const items = CHECKLIST_ITEMS.map(item => ({
    ...item,
    done: item.checkFn(user, counts),
  }));

  const completedCount = items.filter(i => i.done).length;
  const allDone = completedCount === items.length;
  const pct = Math.round((completedCount / items.length) * 100);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  if (allDone) {
    return (
      <div className="relative rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-emerald-900">Setup Complete 🎉</p>
          <p className="text-xs text-emerald-700 mt-0.5">Your account is fully set up. You're ready to go!</p>
        </div>
        <button onClick={handleDismiss} className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-400 hover:text-emerald-700 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Account Setup</p>
            <p className="text-[11px] text-muted-foreground">{completedCount} of {items.length} steps completed</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Mini progress bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: "linear-gradient(90deg,#6366f1,#3b82f6)" }}
              />
            </div>
            <span className="text-xs font-bold text-indigo-600">{pct}%</span>
          </div>
          <button onClick={handleDismiss} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => !item.done && navigate(item.path)}
            disabled={item.done}
            className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors ${
              item.done
                ? "cursor-default"
                : "hover:bg-indigo-50/60 cursor-pointer group"
            }`}
          >
            {item.done ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-slate-200 group-hover:text-indigo-300 shrink-0 transition-colors" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-tight ${item.done ? "text-muted-foreground line-through" : "text-slate-800"}`}>
                {item.label}
              </p>
              {!item.done && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              )}
            </div>
            {!item.done && (
              <ChevronRight className="h-4 w-4 text-indigo-400 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}