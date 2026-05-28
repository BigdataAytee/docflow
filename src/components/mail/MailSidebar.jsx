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
    <div className="flex flex-col h-full py-2 select-none">
      {/* Compose */}
      <div className="px-3 mb-4">
        <button
          onClick={() => { onCompose(); onClose?.(); }}
          className="flex items-center gap-3 bg-[#c2e7ff] hover:bg-[#b3d9f5] text-[#001d35] rounded-2xl pl-4 pr-6 py-[14px] text-sm font-medium shadow-sm transition-all w-full"
        >
          <Pencil className="h-5 w-5" />
          Compose
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-0.5">
        {FOLDERS.map(f => {
          const Icon = f.icon;
          const active = folder === f.id;
          const count = counts?.[f.id] || 0;
          return (
            <button
              key={f.id}
              onClick={() => { setFolder(f.id); onClose?.(); }}
              className={`flex items-center gap-3 w-full px-4 py-2 rounded-r-full text-sm transition-colors ${
                active
                  ? "bg-[#d3e3fd] text-[#001d35] font-semibold"
                  : "text-[#444746] hover:bg-[#e8eaed]/70 font-normal"
              }`}
              style={{ borderRadius: "0 100px 100px 0" }}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-[#001d35]" : "text-[#444746]"}`} />
              <span className="flex-1 text-left">{f.label}</span>
              {count > 0 && !active && (
                <span className={`text-xs font-bold ${f.id === "inbox" ? "text-[#001d35]" : "text-[#444746]"}`}>{count > 99 ? "99+" : count}</span>
              )}
            </button>
          );
        })}

        {/* Labels section */}
        <div className="mt-2 px-4">
          <div className="flex items-center justify-between py-2">
            <span className="text-xs font-medium text-[#444746] uppercase tracking-wide">Labels</span>
            <button className="p-0.5 hover:bg-gray-100 rounded-full text-[#444746]">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {LABELS.map(l => (
            <button key={l.name}
              onClick={() => { setFolder(`label:${l.name}`); onClose?.(); }}
              className={`flex items-center gap-3 w-full px-1 py-1.5 rounded-full text-sm transition-colors text-[#444746] hover:bg-[#e8eaed]/70 ${folder === `label:${l.name}` ? "bg-[#d3e3fd]" : ""}`}
            >
              <Tag className="h-[18px] w-[18px] shrink-0" style={{ color: l.color }} />
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}