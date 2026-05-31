import { useState } from "react";
import { Star, Trash2, Archive, Clock } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  if (new Date().getFullYear() === d.getFullYear()) return format(d, "MMM d");
  return format(d, "MM/dd/yy");
}

const AVATAR_COLORS = [
  "#ea4335","#4285f4","#0f9d58","#fbbc04","#ab47bc","#00acc1","#ff7043","#5c6bc0"
];

function Avatar({ name, email, size = 32 }) {
  const str = name || email || "?";
  const initial = str[0].toUpperCase();
  const color = AVATAR_COLORS[str.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 font-medium text-white select-none"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}>
      {initial}
    </div>
  );
}

export { Avatar };

export default function MailRow({ mail, selected, checked, onCheck, onClick, onStar, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const isRead = mail.is_read !== false;
  const isStarred = mail.is_starred;
  const displayName = mail.to_name || mail.to_email || "Unknown";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      className={`flex items-center gap-1 px-4 py-0.5 cursor-pointer group border-b border-transparent transition-all ${
        selected ? "bg-indigo-50 border-b-indigo-100" :
        hovered ? "bg-slate-50 shadow-sm" :
        isRead ? "bg-white" : "bg-white"
      }`}
      style={{ minHeight: 48 }}
    >
      {/* Checkbox */}
      <div className="w-8 flex items-center justify-center shrink-0" onClick={e => { e.stopPropagation(); onCheck?.(); }}>
        <input
          type="checkbox"
          checked={!!checked}
          onChange={() => {}}
          className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
          onClick={e => e.stopPropagation()}
        />
      </div>

      {/* Star */}
      <div className="w-7 flex items-center justify-center shrink-0" onClick={e => { e.stopPropagation(); onStar?.(mail); }}>
        <Star
          className={`h-4 w-4 transition-colors ${isStarred ? "fill-amber-400 text-amber-400" : "text-gray-200 hover:text-amber-300"}`}
        />
      </div>

      {/* Avatar */}
      <div className="w-8 flex items-center justify-center shrink-0 mr-1">
        <Avatar name={displayName} email={mail.to_email} size={28} />
      </div>

      {/* Sender */}
      <div className={`w-36 lg:w-44 shrink-0 text-sm truncate ${!isRead ? "font-bold text-slate-900" : "text-slate-700"}`}>
        {displayName}
      </div>

      {/* Subject + snippet */}
      <div className="flex-1 min-w-0 flex items-center gap-2 text-sm truncate">
        <span className={`shrink-0 truncate max-w-[300px] ${!isRead ? "font-bold text-slate-900" : "text-slate-700"}`}>
          {mail.subject || "(no subject)"}
        </span>
        <span className="text-slate-400 font-normal truncate hidden sm:inline">
          — {(mail.body || "").replace(/<[^>]*>/g, "").slice(0, 80)}
        </span>
      </div>

      {/* Hover actions */}
      {hovered ? (
        <div className="flex items-center gap-1 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => onDelete?.(mail)} className="p-1.5 rounded-full hover:bg-red-50 hover:text-red-500 text-slate-400 transition-colors" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors" title="Snooze">
            <Clock className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors" title="Archive">
            <Archive className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="shrink-0 ml-2 text-xs text-slate-400 whitespace-nowrap w-[50px] text-right">
          {formatTime(mail.created_date)}
        </div>
      )}

      {/* Failed badge */}
      {mail.status === "failed" && (
        <span className="shrink-0 ml-1 text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-medium">Failed</span>
      )}
    </div>
  );
}