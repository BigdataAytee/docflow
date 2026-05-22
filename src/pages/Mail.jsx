import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Send, Mail as MailIcon, Loader2, Search, Pencil, X,
  ChevronDown, Trash2, RefreshCw, Star, Inbox, Clock, ArrowLeft
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
    <>
      {/* Mobile: full-screen overlay */}
      <div className="fixed inset-0 z-50 flex flex-col bg-white sm:hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white shrink-0">
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">New Message</span>
          <Button size="sm" onClick={handleSend} disabled={sending || !form.to_email || !form.subject || !form.body}
            className="rounded-full px-4 h-8 text-xs bg-blue-500 hover:bg-blue-600">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1" />Send</>}
          </Button>
        </div>
        <ComposeFields form={form} setForm={setForm} customers={customers} selectCustomer={selectCustomer} />
      </div>

      {/* Tablet / Desktop: floating window */}
      <div className={`hidden sm:flex fixed bottom-0 right-4 md:right-8 z-50 w-[90vw] sm:w-[480px] md:w-[540px] bg-white rounded-t-xl shadow-2xl border border-gray-300 flex-col transition-all ${minimized ? "h-12" : "h-[480px] md:h-[520px]"}`}>
        <div
          className="flex items-center justify-between px-4 py-2.5 bg-gray-800 text-white rounded-t-xl cursor-pointer select-none shrink-0"
          onClick={() => setMinimized(!minimized)}
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
            <ComposeFields form={form} setForm={setForm} customers={customers} selectCustomer={selectCustomer} />
            <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between shrink-0">
              <Button size="sm" onClick={handleSend}
                disabled={sending || !form.to_email || !form.subject || !form.body}
                className="rounded-full px-5">
                {sending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending...</> : <><Send className="h-3.5 w-3.5 mr-1.5" />Send</>}
              </Button>
              <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ComposeFields({ form, setForm, customers, selectCustomer }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center border-b border-gray-200 px-4">
        <span className="text-xs text-gray-500 w-14 shrink-0">To</span>
        <div className="flex-1 flex items-center gap-1">
          <Input value={form.to_email} onChange={e => setForm(f => ({ ...f, to_email: e.target.value }))}
            placeholder="Recipients" className="border-0 shadow-none focus-visible:ring-0 px-0 h-10 text-sm" />
          <Select value={form.customer_id} onValueChange={selectCustomer}>
            <SelectTrigger className="w-7 h-7 border-0 shadow-none px-0 text-gray-400">
              <ChevronDown className="h-3.5 w-3.5" />
            </SelectTrigger>
            <SelectContent align="end" className="max-h-52">
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.full_name}{c.email ? ` <${c.email}>` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center border-b border-gray-200 px-4">
        <span className="text-xs text-gray-500 w-14 shrink-0">Subject</span>
        <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          placeholder="Subject" className="border-0 shadow-none focus-visible:ring-0 px-0 h-10 text-sm flex-1" />
      </div>
      <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
        placeholder="Write your message..."
        className="flex-1 resize-none border-0 shadow-none focus-visible:ring-0 rounded-none text-sm px-4 py-3 min-h-0" />
    </div>
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
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${mail.status === "sent" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
          {mail.status}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start gap-3 mb-5">
            <Avatar name={mail.to_name} email={mail.to_email} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <span className="font-semibold text-gray-900 text-sm">{mail.to_name || mail.to_email}</span>
                <span className="text-xs text-gray-400">{mail.created_date ? format(new Date(mail.created_date), "d MMM yyyy, h:mm a") : ""}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">to {mail.to_email}</p>
            </div>
          </div>
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap border border-gray-100 rounded-xl bg-gray-50/50 p-4 md:p-5">
            {mail.body}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, count, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium w-full text-left transition-colors ${active ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {count > 0 && <span className="text-xs font-semibold">{count}</span>}
    </button>
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

  const filtered = sent.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.subject || "").toLowerCase().includes(q)
      || (m.to_name || "").toLowerCase().includes(q)
      || (m.to_email || "").toLowerCase().includes(q)
      || (m.body || "").toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col bg-white rounded-xl border border-border overflow-hidden"
      style={{ height: "calc(100vh - 5rem)" }}>

      {/* Top toolbar */}
      <div className="flex items-center gap-2 px-3 md:px-4 py-2 border-b border-gray-200 shrink-0 bg-white">
        <div className="hidden md:flex items-center gap-2 text-gray-700 font-semibold text-sm w-44 shrink-0">
          <MailIcon className="h-4 w-4 text-blue-500" />
          <span>Mail</span>
        </div>
        {/* Search */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search mail"
              className="w-full pl-9 pr-4 py-1.5 bg-gray-100 hover:bg-gray-200 focus:bg-white focus:ring-1 focus:ring-blue-300 rounded-full text-sm outline-none transition-all" />
          </div>
        </div>
        <button onClick={handleRefresh} className="p-1.5 hover:bg-gray-100 rounded-full">
          <RefreshCw className={`h-4 w-4 text-gray-500 ${refreshing ? "animate-spin" : ""}`} />
        </button>
        {/* Mobile compose button */}
        <button onClick={() => setComposing(true)}
          className="sm:hidden flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1.5 text-xs font-semibold">
          <Pencil className="h-3.5 w-3.5" />
          <span>Compose</span>
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left nav — hidden on mobile */}
        <div className="hidden sm:flex flex-col w-40 md:w-48 shrink-0 pt-3 px-2 gap-0.5 border-r border-gray-200">
          <button onClick={() => setComposing(true)}
            className="flex items-center gap-2 mx-1 mb-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all">
            <Pencil className="h-4 w-4" />Compose
          </button>
          <NavItem icon={Inbox} label="Inbox" count={0} active={false} />
          <NavItem icon={Star} label="Starred" count={0} active={false} />
          <NavItem icon={Clock} label="Snoozed" count={0} active={false} />
          <NavItem icon={Send} label="Sent" count={sent.length} active={true} />
        </div>

        {/* Email list */}
        <div className={`flex flex-col border-r border-gray-200 bg-white overflow-hidden
          ${selected ? "hidden md:flex md:w-64 lg:w-80 xl:w-96 shrink-0" : "flex-1"}`}>
          {/* List header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sent · {filtered.length}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center text-gray-400 px-6 py-12">
              <MailIcon className="h-12 w-12 mb-3 opacity-15" />
              <p className="text-sm font-medium">{search ? "No results" : "No sent emails yet"}</p>
              {!search && <p className="text-xs mt-1">Tap Compose to send your first email</p>}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filtered.map(m => (
                <button key={m.id} onClick={() => setSelected(m)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50/60 transition-colors flex items-start gap-3 ${selected?.id === m.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}>
                  <Avatar name={m.to_name} email={m.to_email} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1 mb-0.5">
                      <span className="text-sm font-semibold text-gray-800 truncate">{m.to_name || m.to_email}</span>
                      <span className="text-[10px] text-gray-400 shrink-0 ml-1">{formatTime(m.created_date)}</span>
                    </div>
                    <p className="text-xs font-medium text-gray-700 truncate">{m.subject}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5 leading-relaxed">{(m.body || "").slice(0, 70)}</p>
                  </div>
                  {m.status === "failed" && <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail pane */}
        {selected ? (
          <div className="flex-1 min-w-0">
            <EmailDetail mail={selected} onClose={() => setSelected(null)} />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50/50 flex-col gap-3 text-gray-300">
            <MailIcon className="h-16 w-16 opacity-20" />
            <p className="text-sm">Select an email to read</p>
          </div>
        )}
      </div>

      {composing && <ComposeWindow customers={customers} onSend={handleSend} onClose={() => setComposing(false)} />}
    </div>
  );
}