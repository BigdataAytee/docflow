import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Mail as MailIcon, Loader2, Search, Pencil, X, ChevronDown, Trash2, RefreshCw, Star, Inbox, Clock } from "lucide-react";
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
  const initials = name ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : (email || "?")[0].toUpperCase();
  const colors = ["bg-blue-500","bg-purple-500","bg-emerald-500","bg-orange-500","bg-pink-500","bg-cyan-500","bg-red-500","bg-indigo-500"];
  const idx = (name || email || "").charCodeAt(0) % colors.length;
  return (
    <div className={`w-9 h-9 rounded-full ${colors[idx]} flex items-center justify-center text-white text-sm font-semibold shrink-0`}>
      {initials}
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

  return (
    <div className={`fixed bottom-0 right-4 sm:right-8 z-50 w-full sm:w-[520px] bg-white rounded-t-xl shadow-2xl border border-gray-300 flex flex-col transition-all ${minimized ? "h-12" : "h-[520px]"}`}>
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-gray-800 text-white rounded-t-xl cursor-pointer select-none"
        onClick={() => setMinimized(!minimized)}
      >
        <span className="text-sm font-semibold">New Message</span>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => setMinimized(!minimized)} className="hover:bg-white/20 p-1 rounded">
            <ChevronDown className={`h-4 w-4 transition-transform ${minimized ? "rotate-180" : ""}`} />
          </button>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* To field */}
          <div className="flex items-center border-b border-gray-200 px-4">
            <span className="text-xs text-gray-500 w-12 shrink-0">To</span>
            <div className="flex-1 flex items-center gap-2 py-1.5">
              <Input
                value={form.to_email}
                onChange={e => setForm(f => ({ ...f, to_email: e.target.value }))}
                placeholder="Recipients"
                className="border-0 shadow-none focus-visible:ring-0 px-0 h-7 text-sm"
              />
              <Select value={form.customer_id} onValueChange={selectCustomer}>
                <SelectTrigger className="w-7 h-7 border-0 shadow-none px-0 text-gray-400 hover:text-gray-600">
                  <ChevronDown className="h-3.5 w-3.5" />
                </SelectTrigger>
                <SelectContent align="end">
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}{c.email ? ` <${c.email}>` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subject */}
          <div className="flex items-center border-b border-gray-200 px-4">
            <span className="text-xs text-gray-500 w-12 shrink-0">Subject</span>
            <Input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Subject"
              className="border-0 shadow-none focus-visible:ring-0 px-0 h-9 text-sm flex-1"
            />
          </div>

          {/* Body */}
          <Textarea
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Write your message..."
            className="flex-1 resize-none border-0 shadow-none focus-visible:ring-0 rounded-none text-sm px-4 py-3 min-h-0"
          />

          {/* Toolbar */}
          <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between">
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sending || !form.to_email || !form.subject || !form.body}
              className="rounded-full px-5"
            >
              {sending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending...</> : <><Send className="h-3.5 w-3.5 mr-1.5" />Send</>}
            </Button>
            <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailDetail({ mail, onClose }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-gray-200 shrink-0">
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full">
          <X className="h-4 w-4 text-gray-600" />
        </button>
        <h2 className="font-semibold text-gray-800 text-base flex-1 truncate">{mail.subject}</h2>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${mail.status === "sent" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
          {mail.status}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-2xl">
          {/* Sender meta */}
          <div className="flex items-start gap-3 mb-6">
            <Avatar name={mail.to_name} email={mail.to_email} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">{mail.to_name || mail.to_email}</span>
                <span className="text-xs text-gray-400 shrink-0">{mail.created_date ? format(new Date(mail.created_date), "EEE, d MMM yyyy, h:mm a") : ""}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">to {mail.to_email}</p>
            </div>
          </div>

          {/* Body */}
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap border border-gray-100 rounded-xl bg-gray-50/50 p-5">
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

  const load = async () => {
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

  const filtered = sent.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.subject || "").toLowerCase().includes(q)
      || (m.to_name || "").toLowerCase().includes(q)
      || (m.to_email || "").toLowerCase().includes(q)
      || (m.body || "").toLowerCase().includes(q);
  });

  return (
    <div className="h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)] flex flex-col -m-4 md:-m-6 lg:-m-8">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2 text-gray-700 font-semibold text-base w-48 shrink-0 hidden md:flex">
          <MailIcon className="h-5 w-5 text-blue-500" />
          <span>Mail</span>
        </div>
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search mail"
              className="w-full pl-10 pr-4 py-2 bg-gray-100 hover:bg-gray-200 focus:bg-white focus:ring-1 focus:ring-blue-300 rounded-full text-sm outline-none transition-all"
            />
          </div>
        </div>
        <button onClick={handleRefresh} className="p-2 hover:bg-gray-100 rounded-full ml-auto md:ml-0">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <div className="hidden md:flex flex-col w-48 lg:w-52 shrink-0 pt-3 px-2 gap-1 border-r border-gray-200 bg-white">
          <button
            onClick={() => setComposing(true)}
            className="flex items-center gap-3 mx-2 mb-3 mt-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm transition-all"
          >
            <Pencil className="h-4 w-4" />
            Compose
          </button>

          <NavItem icon={Inbox} label="Inbox" count={0} active={false} />
          <NavItem icon={Star} label="Starred" count={0} active={false} />
          <NavItem icon={Clock} label="Snoozed" count={0} active={false} />
          <NavItem icon={Send} label="Sent" count={sent.length} active={true} />
        </div>

        {/* Email list + detail */}
        <div className="flex flex-1 min-w-0">
          {/* Email list */}
          <div className={`flex flex-col border-r border-gray-200 bg-white ${selected ? "hidden md:flex md:w-72 lg:w-96 shrink-0" : "flex-1"}`}>
            {/* Mobile compose */}
            <div className="md:hidden flex items-center justify-between px-4 py-2 border-b border-gray-200">
              <span className="font-semibold text-sm text-gray-700">Sent ({sent.length})</span>
              <button onClick={() => setComposing(true)} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-1.5 text-xs font-semibold">
                <Pencil className="h-3.5 w-3.5" /> Compose
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center text-gray-400 py-16 px-6">
                <MailIcon className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">{search ? "No results found" : "No sent emails yet"}</p>
                {!search && <p className="text-xs mt-1 text-gray-400">Click Compose to send your first email</p>}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {filtered.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50/50 transition-colors flex items-start gap-3 ${selected?.id === m.id ? "bg-blue-50" : ""}`}
                  >
                    <Avatar name={m.to_name} email={m.to_email} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1 mb-0.5">
                        <span className="text-sm font-semibold text-gray-800 truncate">{m.to_name || m.to_email}</span>
                        <span className="text-[11px] text-gray-400 shrink-0">{formatTime(m.created_date)}</span>
                      </div>
                      <p className="text-xs text-gray-700 truncate font-medium">{m.subject}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{(m.body || "").slice(0, 80)}</p>
                    </div>
                    {m.status === "failed" && (
                      <span className="shrink-0 mt-1 w-2 h-2 rounded-full bg-red-500" title="Failed" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail pane */}
          {selected ? (
            <div className="flex-1 min-w-0 bg-white">
              <EmailDetail mail={selected} onClose={() => setSelected(null)} />
            </div>
          ) : (
            <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50/60 text-gray-400 flex-col gap-3">
              <MailIcon className="h-16 w-16 opacity-10" />
              <p className="text-sm">Select an email to read</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating compose window */}
      {composing && (
        <ComposeWindow customers={customers} onSend={handleSend} onClose={() => setComposing(false)} />
      )}
    </div>
  );
}

function NavItem({ icon: Icon, label, count, active }) {
  return (
    <button className={`flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium w-full text-left transition-colors ${active ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {count > 0 && <span className="text-xs font-semibold">{count}</span>}
    </button>
  );
}