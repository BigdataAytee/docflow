import { Pencil, Inbox, Star, Clock, Send, FileText, AlertOctagon, Trash2, Tag, ChevronDown, Plus } from "lucide-react";

const LABELS = [
  { color: "#ea4335", name: "Work" },
  { color: "#0f9d58", name: "Personal" },
  { color: "#fbbc04", name: "Finance" },
  { color: "#4285f4", name: "Customers" },
];

export const FOLDERS = [
  { id: "inbox",   label: "Inbox",   icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "snoozed", label: "Snoozed", icon: Clock },
  { id: "sent",    label: "Sent",    icon: Send },
  { id: "drafts",  label: "Drafts",  icon: FileText },
  { id: "spam",    label: "Spam",    icon: AlertOctagon },
  { id: "trash",   label: "Trash",   icon: Trash2 },
];

export default function MailSidebar({ folder, setFolder, counts, onCompose, onClose }) {
  return (
    <div className="flex flex-col h-full py-3 select-none">
      {/* Brand */}
      <div className="px-4 mb-5 hidden md:flex items-center gap-2">
        <span className="text-xl">✉️</span>
        <span className="font-bold text-white text-base tracking-tight">Mail</span>
      </div>

      {/* Compose */}
      <div className="px-3 mb-4">
        <button
          onClick={() => { onCompose(); onClose?.(); }}
          className="flex items-center gap-3 w-full pl-4 pr-6 py-3 rounded-2xl text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg,#6366f1 0%,#4f46e5 100%)", boxShadow: "0 4px 16px rgba(99,102,241,0.4)" }}
        >
          <Pencil className="h-4 w-4" />
          Compose
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-0.5 px-2">
        {FOLDERS.map(f => {
          const Icon = f.icon;
          const active = folder === f.id;
          const count = counts?.[f.id] || 0;
          return (
            <button
              key={f.id}
              onClick={() => { setFolder(f.id); onClose?.(); }}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all ${
                active
                  ? "bg-white/15 text-white font-semibold"
                  : "text-white/60 hover:bg-white/8 hover:text-white/90 font-normal"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-indigo-300" : "text-white/40"}`} />
              <span className="flex-1 text-left">{f.label}</span>
              {count > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  active ? "bg-indigo-500 text-white" : "text-white/50"
                }`}>{count > 99 ? "99+" : count}</span>
              )}
            </button>
          );
        })}

        {/* Labels section */}
        <div className="mt-4 px-1">
          <div className="flex items-center justify-between py-2">
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">Labels</span>
            <button className="p-0.5 hover:bg-white/10 rounded-full text-white/30 hover:text-white/60 transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {LABELS.map(l => (
            <button key={l.name}
              onClick={() => { setFolder(`label:${l.name}`); onClose?.(); }}
              className={`flex items-center gap-3 w-full px-2 py-2 rounded-xl text-sm transition-all ${
                folder === `label:${l.name}` ? "bg-white/15 text-white" : "text-white/50 hover:bg-white/8 hover:text-white/80"
              }`}
            >
              <div className="h-3 w-3 rounded-full shrink-0" style={{ background: l.color }} />
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}