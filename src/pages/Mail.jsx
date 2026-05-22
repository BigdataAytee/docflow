import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Send, Mail as MailIcon, Loader2, Search, Pencil, X,
  ChevronDown, Trash2, RefreshCw, Star, Inbox, Clock,
  ArrowLeft, AlertOctagon, FileText, Tag, Menu, Paperclip
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isToday, isYesterday } from "date-fns";

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM");
}

function Avatar({ name, email }) {
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : (email || "?")[0].toUpperCase();
  const colors = ["bg-blue-500","bg-purple-500","bg-emerald-500","bg-orange-500","bg-pink-500","bg-cyan-600","bg-red-500","bg-indigo-500"];
  const idx = (name || email || "").charCodeAt(0) % colors.length;
  return (
    <div className={`w-8 h-8 rounded-full ${colors[idx]} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initials}
    </div>
  );
}

const FOLDERS = [
  { id: "inbox",   label: "Inbox",   icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "snoozed", label: "Snoozed", icon: Clock },
  { id: "sent",    label: "Sent",    icon: Send },
  { id: "drafts",  label: "Drafts",  icon: FileText },
  { id: "spam",    label: "Spam",    icon: AlertOctagon },
  { id: "trash",   label: "Trash",   icon: Trash2 },
  { id: "labels",  label: "Labels",  icon: Tag },
];

function MailSidebar({ folder, setFolder, sentCount, onCompose, onClose }) {
  return (
    <div className="flex flex-col h-full bg-white py-2">
      <div className="px-3 mb-2">
        <button
          onClick={() => { onCompose(); onClose && onClose(); }}
          className="flex items-center gap-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl pl-4 pr-6 py-3 text-sm font-semibold shadow-sm transition-all w-full"
        >
          <Pencil className="h-4 w-4" />
          Compose
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {FOLDERS.map(f => {
          const Icon = f.icon;
          const active = folder === f.id;
          return (
            <button
              key={f.id}
              onClick={() => { setFolder(f.id); onClose && onClose(); }}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                active ? "bg-blue-100 text-blue-800 font-semibold" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-blue-700" : "text-gray-500"}`} />
              <span className="flex-1 text-left">{f.label}</span>
              {f.id === "sent" && sentCount > 0 && (
                <span className="text-xs font-bold text-gray-500">{sentCount}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ── Compose form fields ── */
function ComposeFields({ form, setForm, customers, selectCustomer }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* To row */}
      <div className="flex items-center border-b border-gray-200 px-4 shrink-0">
        <span className="text-xs text-gray-500 w-12 shrink-0">To</span>
        <Input
          value={form.to_email}
          onChange={e => setForm(f => ({ ...f, to_email: e.target.value }))}
          placeholder="Recipients"
          className="border-0 shadow-none focus-visible:ring-0 px-1 h-10 text-sm flex-1"
        />
        <Select value={form.customer_id} onValueChange={selectCustomer}>
          <SelectTrigger className="w-7 h-7 border-0 shadow-none px-0 text-gray-400 shrink-0">
            <ChevronDown className="h-3.5 w-3.5" />
          </SelectTrigger>
          <SelectContent align="end" className="max-h-52">
            {customers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.full_name}{c.email ? ` <${c.email}>` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Subject row */}
      <div className="flex items-center border-b border-gray-200 px-4 shrink-0">
        <span className="text-xs text-gray-500 w-12 shrink-0">Subject</span>
        <Input
          value={form.subject}
          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          placeholder="Subject"
          className="border-0 shadow-none focus-visible:ring-0 px-1 h-10 text-sm flex-1"
        />
      </div>
      {/* Body */}
      <textarea
        value={form.body}
        onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
        placeholder="Write your message..."
        className="flex-1 resize-none text-sm px-4 py-3 outline-none border-0 min-h-0"
        style={{ fontFamily: "inherit" }}
      />
    </div>
  );
}

/* ── Compose toolbar (send + attach + discard) ── */
function ComposeToolbar({ onSend, onClose, sending, disabled }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-200 bg-white shrink-0">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={onSend}
          disabled={sending || disabled}
          className="rounded-full px-5"
        >
          {sending
            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending…</>
            : <><Send className="h-3.5 w-3.5 mr-1.5" />Send</>}
        </Button>
        <label
          className="p-2 hover:bg-gray-100 rounded-full cursor-pointer text-gray-500 transition-colors"
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" />
          <input type="file" className="hidden" />
        </label>
      </div>
      <button
        onClick={onClose}
        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        title="Discard"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function ComposeWindow({ customers, onSend, onClose }) {
  const [form, setForm] = useState({ customer_id: "", to_email: "", to_name: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const selectCustomer = (id) => {
    const c = customers.find(x => x.id === id);
    if (c) setForm(f => ({ ...f, customer_id: id, to_email: c.email || "", to_name: c.full_name }));
  };

  const handleSend = async () => {
    if (!form.to_email || !form.subject || !form.body) return;
    setSending(true);
    await onSend(form);
    setSending(false);
    onClose();
  };

  const disabled = !form.to_email || !form.subject || !form.body;

  return (
    <>
      {/* ── Mobile: full-screen overlay ── */}
      <div className="fixed inset-0 z-50 flex flex-col bg-white sm:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white shrink-0">
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">New Message</span>
          <Button size="sm" onClick={handleSend} disabled={sending || disabled}
            className="rounded-full px-4 h-8 text-xs bg-blue-500 hover:bg-blue-600 border-0">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1" />Send</>}
          </Button>
        </div>
        {/* Fields */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ComposeFields form={form} setForm={setForm} customers={customers} selectCustomer={selectCustomer} />
        </div>
        {/* Attachment bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-200 bg-white shrink-0">
          <label className="p-2 hover:bg-gray-100 rounded-full cursor-pointer text-gray-500 flex items-center gap-2 text-xs" title="Attach file">
            <Paperclip className="h-4 w-4" />
            <span>Attach file</span>
            <input type="file" className="hidden" />
          </label>
        </div>
      </div>

      {/* ── Desktop: floating window ── */}
      <div className={`hidden sm:flex fixed bottom-0 right-6 z-50 w-[520px] rounded-t-xl shadow-2xl border border-gray-300 overflow-hidden flex-col bg-white transition-all duration-200 ${minimized ? "h-11" : "h-[490px]"}`}>
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-4 py-2.5 bg-gray-800 text-white cursor-pointer shrink-0"
          onClick={() => setMinimized(m => !m)}
        >
          <span className="text-sm font-semibold">New Message</span>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={() => setMinimized(m => !m)} className="hover:bg-white/20 p-1 rounded">
              <ChevronDown className={`h-4 w-4 transition-transform ${minimized ? "rotate-180" : ""}`} />
            </button>
            <button onClick={onClose} className="hover:bg-white/20 p-1 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <ComposeFields form={form} setForm={setForm} customers={customers} selectCustomer={selectCustomer} />
            </div>
            <ComposeToolbar onSend={handleSend} onClose={onClose} sending={sending} disabled={disabled} />
          </>
        )}
      </div>
    </>
  );
}

function EmailDetail({ mail, onClose }) {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-2 px-3 md:px-6 py-3 border-b border-gray-200 shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full -ml-1">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <h2 className="font-semibold text-gray-800 text-sm md:text-base flex-1 truncate">{mail.subject}</h2>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${mail.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {mail.status}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">{mail.subject}</h1>
          <div className="flex items-start gap-3 mb-6">
            <Avatar name={mail.to_name} email={mail.to_email} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-900 text-sm">{mail.to_name || mail.to_email}</span>
                <span className="text-xs text-gray-400">{mail.created_date ? format(new Date(mail.created_date), "d MMM yyyy, h:mm a") : ""}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">to {mail.to_email}</p>
            </div>
          </div>
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap border border-gray-100 rounded-xl bg-gray-50/60 p-5">
            {mail.body}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Mail() {
  const [customers, setCustomers] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(false);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [folder, setFolder] = useState("sent");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, s] = await Promise.all([
      base44.entities.Customer.list("-created_date", 100),
      base44.entities.Mail.list("-created_date", 100),
    ]);
    setCustomers(c);
    setSent(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    const s = await base44.entities.Mail.list("-created_date", 100);
    setSent(s);
    setRefreshing(false);
  };

  const handleSend = async (form) => {
    try {
      await base44.integrations.Core.SendEmail({ to: form.to_email, subject: form.subject, body: form.body });
      await base44.entities.Mail.create({ ...form, status: "sent" });
    } catch {
      await base44.entities.Mail.create({ ...form, status: "failed" });
    }
    const updated = await base44.entities.Mail.list("-created_date", 100);
    setSent(updated);
  };

  const displayMails = folder === "sent" ? sent : [];
  const filtered = displayMails.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.subject || "").toLowerCase().includes(q)
      || (m.to_name || "").toLowerCase().includes(q)
      || (m.to_email || "").toLowerCase().includes(q)
      || (m.body || "").toLowerCase().includes(q);
  });

  const folderLabel = FOLDERS.find(f => f.id === folder)?.label || "Sent";

  return (
    <div className="flex bg-white rounded-xl border border-border overflow-hidden"
      style={{ height: "calc(100vh - 5rem)" }}>

      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col w-52 lg:w-60 shrink-0 border-r border-gray-200 overflow-y-auto">
        <MailSidebar folder={folder} setFolder={setFolder} sentCount={sent.length} onCompose={() => setComposing(true)} />
      </div>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 bg-white h-full shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-bold text-gray-800">DocFlow Mail</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <MailSidebar folder={folder} setFolder={setFolder} sentCount={sent.length}
                onCompose={() => setComposing(true)} onClose={() => setSidebarOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 shrink-0 bg-white">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 hover:bg-gray-100 rounded-full">
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={`Search in ${folderLabel}`}
                className="w-full pl-9 pr-4 py-1.5 bg-gray-100 hover:bg-gray-200 focus:bg-white focus:ring-1 focus:ring-blue-300 rounded-full text-sm outline-none transition-all" />
            </div>
          </div>
          <button onClick={handleRefresh} className="p-1.5 hover:bg-gray-100 rounded-full">
            <RefreshCw className={`h-4 w-4 text-gray-500 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setComposing(true)}
            className="md:hidden p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full">
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        {/* Folder label */}
        {!selected && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
            <span className="text-sm font-semibold text-gray-700 capitalize">{folderLabel}</span>
            <span className="text-xs text-gray-400">{filtered.length} {filtered.length === 1 ? "message" : "messages"}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          {selected ? (
            <div className="flex-1 min-w-0">
              <EmailDetail mail={selected} onClose={() => setSelected(null)} />
            </div>
          ) : (
            <div className="flex-1 min-w-0 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400 px-6">
                  <MailIcon className="h-14 w-14 opacity-10 mb-3" />
                  <p className="text-sm font-medium">{search ? "No results found" : `No messages in ${folderLabel}`}</p>
                  {folder === "sent" && !search && (
                    <button onClick={() => setComposing(true)}
                      className="mt-4 flex items-center gap-2 text-blue-600 hover:underline text-sm">
                      <Pencil className="h-4 w-4" /> Compose your first email
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filtered.map(m => (
                    <button key={m.id} onClick={() => setSelected(m)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50/60 active:bg-blue-100 transition-colors flex items-start gap-3">
                      <Avatar name={m.to_name} email={m.to_email} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-800 truncate">{m.to_name || m.to_email}</span>
                          <span className="text-[11px] text-gray-400 shrink-0">{formatTime(m.created_date)}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-700 truncate">{m.subject}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{(m.body || "").slice(0, 90)}</p>
                      </div>
                      {m.status === "failed" && (
                        <span className="shrink-0 mt-1 text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-medium">Failed</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {composing && <ComposeWindow customers={customers} onSend={handleSend} onClose={() => setComposing(false)} />}
    </div>
  );
}