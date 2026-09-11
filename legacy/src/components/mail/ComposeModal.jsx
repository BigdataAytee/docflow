import { useState } from "react";
import { X, ChevronDown, Minus, Maximize2, Send, Paperclip, Smile, Image, Trash2, Bold, Italic, Underline, Link, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ComposeModal({ customers, onSend, onClose, replyTo }) {
  const [form, setForm] = useState({
    customer_id: "",
    to_email: replyTo?.to_email || "",
    to_name: replyTo?.to_name || "",
    subject: replyTo ? `Re: ${replyTo.subject}` : "",
    body: replyTo ? `\n\n\n--- Original Message ---\n${replyTo.body}` : "",
  });
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [ccOpen, setCcOpen] = useState(false);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showFormatBar, setShowFormatBar] = useState(false);

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

  const windowCls = maximized
    ? "fixed inset-4 z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-[#dadce0]"
    : minimized
    ? "fixed bottom-0 right-6 z-50 w-[520px] h-11 flex flex-col bg-white rounded-t-2xl shadow-2xl border border-[#dadce0] overflow-hidden"
    : "fixed bottom-0 right-6 z-50 w-[520px] h-[480px] flex flex-col bg-white rounded-t-2xl shadow-2xl border border-[#dadce0] overflow-hidden";

  return (
    <>
      {/* Mobile: full screen */}
      <div className="sm:hidden fixed inset-0 z-50 flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-3 bg-[#404040] text-white shrink-0 rounded-t-none">
          <span className="text-sm font-medium">New Message</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSend}
              disabled={disabled || sending}
              className="flex items-center gap-1.5 bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white px-4 py-1.5 rounded-full text-xs font-medium transition-colors"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </button>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <ComposeBody form={form} setForm={setForm} cc={cc} setCc={setCc} bcc={bcc} setBcc={setBcc} ccOpen={ccOpen} setCcOpen={setCcOpen} customers={customers} selectCustomer={selectCustomer} />
      </div>

      {/* Desktop: floating window */}
      <div className={`hidden sm:flex ${windowCls}`}>
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-4 py-2 bg-[#404040] text-white shrink-0 cursor-pointer"
          onClick={() => !maximized && setMinimized(m => !m)}
        >
          <span className="text-sm font-medium select-none">{replyTo ? "Reply" : "New Message"}</span>
          <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setMinimized(m => !m); setMaximized(false); }} className="p-1.5 hover:bg-white/20 rounded" title={minimized ? "Expand" : "Minimize"}>
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setMaximized(m => !m); setMinimized(false); }} className="p-1.5 hover:bg-white/20 rounded" title="Full screen">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded" title="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            <ComposeBody form={form} setForm={setForm} cc={cc} setCc={setCc} bcc={bcc} setBcc={setBcc} ccOpen={ccOpen} setCcOpen={setCcOpen} customers={customers} selectCustomer={selectCustomer} />
            {/* Bottom toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-[#e0e0e0] shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSend}
                  disabled={disabled || sending}
                  className="flex items-center gap-1.5 bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white pl-4 pr-5 py-2 rounded-full text-sm font-medium transition-colors"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Send
                </button>
                <button className="p-2 hover:bg-[#e8eaed] rounded-full text-[#444746]" title="Formatting">
                  <Bold className="h-4 w-4" />
                </button>
                <label className="p-2 hover:bg-[#e8eaed] rounded-full text-[#444746] cursor-pointer" title="Attach">
                  <Paperclip className="h-4 w-4" />
                  <input type="file" className="hidden" />
                </label>
                <button className="p-2 hover:bg-[#e8eaed] rounded-full text-[#444746]" title="Emoji">
                  <Smile className="h-4 w-4" />
                </button>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[#e8eaed] rounded-full text-[#444746]" title="Discard">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ComposeBody({ form, setForm, cc, setCc, bcc, setBcc, ccOpen, setCcOpen, customers, selectCustomer }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* To */}
      <div className="flex items-center border-b border-[#e0e0e0] px-3 shrink-0">
        <span className="text-sm text-[#5f6368] w-10 shrink-0">To</span>
        <input
          value={form.to_email}
          onChange={e => setForm(f => ({ ...f, to_email: e.target.value }))}
          placeholder="Recipients"
          className="flex-1 py-2.5 text-sm outline-none bg-transparent placeholder:text-[#bdc1c6]"
        />
        <button onClick={() => setCcOpen(o => !o)} className="text-xs text-[#5f6368] hover:text-[#202124] px-2 py-1 rounded shrink-0">
          Cc Bcc
        </button>
      </div>
      {/* Cc / Bcc */}
      {ccOpen && (
        <>
          <div className="flex items-center border-b border-[#e0e0e0] px-3 shrink-0">
            <span className="text-sm text-[#5f6368] w-10 shrink-0">Cc</span>
            <input value={cc} onChange={e => setCc(e.target.value)} placeholder="Cc" className="flex-1 py-2.5 text-sm outline-none bg-transparent" />
          </div>
          <div className="flex items-center border-b border-[#e0e0e0] px-3 shrink-0">
            <span className="text-sm text-[#5f6368] w-10 shrink-0">Bcc</span>
            <input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="Bcc" className="flex-1 py-2.5 text-sm outline-none bg-transparent" />
          </div>
        </>
      )}
      {/* Subject */}
      <div className="flex items-center border-b border-[#e0e0e0] px-3 shrink-0">
        <input
          value={form.subject}
          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          placeholder="Subject"
          className="flex-1 py-2.5 text-sm outline-none bg-transparent placeholder:text-[#bdc1c6] font-medium"
        />
      </div>
      {/* Body */}
      <textarea
        value={form.body}
        onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
        placeholder="Write your message here…"
        className="flex-1 resize-none text-sm px-4 py-3 outline-none bg-transparent placeholder:text-[#bdc1c6] min-h-0"
        style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}
      />
    </div>
  );
}