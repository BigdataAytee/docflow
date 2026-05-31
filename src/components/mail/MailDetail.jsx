import { ArrowLeft, Star, Trash2, MoreVertical, Reply, ReplyAll, Forward, Printer, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Avatar } from "./MailRow";
import { useState } from "react";
import { base44 } from "@/api/base44Client";

export default function MailDetail({ mail, onClose, onStar, onDelete, onReply }) {
  const [showDetails, setShowDetails] = useState(false);

  const displayName = mail.to_name || mail.to_email || "Unknown";
  const date = mail.created_date ? format(new Date(mail.created_date), "EEE, MMM d, yyyy, h:mm a") : "";

  const handleStar = (e) => {
    e.stopPropagation();
    onStar?.(mail);
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header toolbar */}
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border shrink-0 bg-slate-50">
        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full -ml-2 mr-2 text-slate-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors" title="Archive">
          <ArrowLeft className="h-4 w-4 rotate-90" />
        </button>
        <button onClick={() => onDelete?.(mail)} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full text-slate-500 transition-colors" title="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
        <button className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors" title="More">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      {/* Thread content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
        {/* Subject */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="text-[22px] font-normal text-[#202124] flex-1 leading-tight">
            {mail.subject || "(no subject)"}
          </h1>
          <button onClick={handleStar} className="p-2 hover:bg-[#e8eaed] rounded-full mt-1 shrink-0">
            <Star className={`h-5 w-5 ${mail.is_starred ? "fill-[#f4b400] text-[#f4b400]" : "text-[#5f6368]"}`} />
          </button>
        </div>

        {/* Email bubble */}
        <div className="border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Email header */}
          <div className="flex items-start gap-3 px-6 py-4 border-b border-border bg-slate-50/50">
            <Avatar name={displayName} email={mail.to_email} size={40} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[#202124]">{displayName}</span>
                  <button
                    onClick={() => setShowDetails(d => !d)}
                    className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
                  >
                    {showDetails ? "Hide details" : `to ${mail.to_email}`}
                  </button>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{date}</span>
              </div>
              {showDetails && (
                <div className="mt-2 text-xs text-[#5f6368] space-y-0.5">
                  <div><span className="text-[#444746]">from: </span>{mail.to_email}</div>
                  <div><span className="text-[#444746]">to: </span>{mail.to_email}</div>
                  {mail.status && <div><span className="text-[#444746]">status: </span>
                    <span className={mail.status === "sent" ? "text-emerald-600" : "text-red-500"}>{mail.status}</span>
                  </div>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors" title="Reply">
                <Reply className="h-4 w-4" />
              </button>
              <button className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors" title="More">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Email body */}
          <div className="px-6 py-5">
            <div className="text-sm text-[#202124] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "Arial, sans-serif" }}>
              {mail.body}
            </div>
          </div>
        </div>

        {/* Reply / Forward buttons */}
        <div className="flex items-center gap-3 mt-6 flex-wrap">
          <button
            onClick={() => onReply?.(mail)}
            className="flex items-center gap-2 px-5 py-2 border border-indigo-200 rounded-full text-sm text-indigo-600 hover:bg-indigo-50 transition-colors font-medium"
          >
            <Reply className="h-4 w-4" />
            Reply
          </button>
          <button className="flex items-center gap-2 px-5 py-2 border border-border rounded-full text-sm text-slate-500 hover:bg-slate-50 transition-colors">
            <Forward className="h-4 w-4" />
            Forward
          </button>
        </div>
      </div>
    </div>
  );
}