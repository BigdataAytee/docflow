import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import MailConnectModal from "../components/mail/MailConnectModal";
import { toast } from "sonner";
import {
  Search, RefreshCw, ChevronDown, MoreVertical, Menu, X,
  CheckSquare, Square, Inbox, Settings, HelpCircle, Grid3x3,
  ChevronLeft, ChevronRight, Loader2
} from "lucide-react";
import MailSidebar from "../components/mail/MailSidebar";
import MailRow from "../components/mail/MailRow";
import MailDetail from "../components/mail/MailDetail";
import ComposeModal from "../components/mail/ComposeModal";

const GMAIL_BLUE = "#1a73e8";

export default function Mail() {
  const [mails, setMails] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [folder, setFolder] = useState("sent");
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [mailConnected, setMailConnected] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");
  const [showMailSettings, setShowMailSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const user = await base44.auth.me();
    if (!user) { setLoading(false); return; }

    const isConnected = !!(user.mail_smtp_host && user.mail_smtp_user);
    setMailConnected(isConnected);
    setConnectedEmail(user.mail_smtp_user || "");

    const customerPromise = base44.entities.Customer.filter({ created_by: user.email }, "-created_date", 200);

    if (isConnected) {
      try {
        const [c, inboxRes, sentMails] = await Promise.all([
          customerPromise,
          base44.functions.invoke("mailFetch", { folder: "INBOX", limit: 100 }),
          base44.entities.Mail.filter({ created_by: user.email }, "-created_date", 200),
        ]);
        setCustomers(c);
        if (inboxRes.data?.error) {
          toast.error(`Inbox error: ${inboxRes.data.error}`);
          setMails(sentMails);
        } else {
          const inboxMails = (inboxRes.data?.messages || []).map((m, idx) => ({
            id: `imap-${m.uid || idx}`,
            ...m,
            folder: "inbox",
          }));
          setMails([...inboxMails, ...sentMails]);
        }
      } catch (err) {
        toast.error(`Could not load inbox: ${err.message}`);
        const [c, m] = await Promise.all([customerPromise, base44.entities.Mail.filter({ created_by: user.email }, "-created_date", 200)]);
        setCustomers(c);
        setMails(m);
      }
    } else {
      const [c, m] = await Promise.all([
        customerPromise,
        base44.entities.Mail.filter({ created_by: user.email }, "-created_date", 200),
      ]);
      setCustomers(c);
      setMails(m);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSend = async (form) => {
    if (mailConnected) {
      // Use the user's real SMTP — never fall back to platform email (which shows 'DocFlow')
      const res = await base44.functions.invoke("mailSend", form);
      if (res.data?.error) {
        toast.error(`Send failed: ${res.data.error}`);
        await base44.entities.Mail.create({ ...form, status: "failed", folder: "sent", is_read: true });
      }
      // On success, mailSend backend already saves the entity record
    } else {
      // Not connected — use platform email
      try {
        await base44.integrations.Core.SendEmail({ to: form.to_email, subject: form.subject, body: form.body });
        await base44.entities.Mail.create({ ...form, status: "sent", folder: "sent", is_read: true });
      } catch {
        await base44.entities.Mail.create({ ...form, status: "failed", folder: "sent", is_read: true });
      }
    }
    await load();
  };

  const handleStar = async (mail) => {
    const updated = { ...mail, is_starred: !mail.is_starred };
    setMails(prev => prev.map(m => m.id === mail.id ? updated : m));
    if (selected?.id === mail.id) setSelected(updated);
    await base44.entities.Mail.update(mail.id, { is_starred: !mail.is_starred });
  };

  const handleDelete = async (mail) => {
    setMails(prev => prev.filter(m => m.id !== mail.id));
    if (selected?.id === mail.id) setSelected(null);
    // Only delete from entity if it's an entity-backed mail
    if (!mail.id?.startsWith("imap-")) {
      await base44.entities.Mail.delete(mail.id);
    }
  };

  const handleDisconnect = async () => {
    await base44.auth.updateMe({
      mail_smtp_host: "", mail_smtp_port: "",
      mail_smtp_user: "", mail_smtp_pass: "",
      mail_imap_host: "", mail_imap_port: "",
    });
    setMailConnected(false);
    setConnectedEmail("");
    await load();
  };

  const handleMarkRead = async (mail) => {
    const updated = { ...mail, is_read: true };
    setMails(prev => prev.map(m => m.id === mail.id ? updated : m));
    await base44.entities.Mail.update(mail.id, { is_read: true });
  };

  const openMail = async (mail) => {
    setSelected(mail);
    if (!mail.is_read) handleMarkRead(mail);
    setSidebarOpen(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "c" || e.key === "C") { setComposing(true); setReplyTo(null); }
      if (e.key === "Escape") { setSelected(null); setComposing(false); }
      if (e.key === "/" || e.key === "f") { document.getElementById("mail-search")?.focus(); e.preventDefault(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Filter mails by folder + search
  const filteredMails = useMemo(() => {
    let list = mails;
    if (folder === "starred") {
      list = mails.filter(m => m.is_starred);
    } else if (folder.startsWith("label:")) {
      const label = folder.replace("label:", "");
      list = mails.filter(m => (m.labels || []).includes(label));
    } else {
      list = mails.filter(m => (m.folder || "sent") === folder);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        (m.subject || "").toLowerCase().includes(q) ||
        (m.to_name || "").toLowerCase().includes(q) ||
        (m.to_email || "").toLowerCase().includes(q) ||
        (m.body || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [mails, folder, search]);

  const folderCounts = useMemo(() => ({
    sent: mails.filter(m => (m.folder || "sent") === "sent").length,
    inbox: mails.filter(m => m.folder === "inbox").length,
    drafts: mails.filter(m => m.folder === "drafts").length,
    spam: mails.filter(m => m.folder === "spam").length,
    trash: mails.filter(m => m.folder === "trash").length,
    starred: mails.filter(m => m.is_starred).length,
  }), [mails]);

  const toggleCheck = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setCheckedIds(new Set());
      setSelectAll(false);
    } else {
      setCheckedIds(new Set(filteredMails.map(m => m.id)));
      setSelectAll(true);
    }
  };

  const hasChecked = checkedIds.size > 0;

  const FOLDER_LABELS = {
    inbox: "Inbox", sent: "Sent", starred: "Starred", snoozed: "Snoozed",
    drafts: "Drafts", spam: "Spam", trash: "Trash",
  };
  const folderLabel = folder.startsWith("label:")
    ? folder.replace("label:", "")
    : FOLDER_LABELS[folder] || folder;

  return (
    <div className="flex overflow-hidden rounded-2xl border border-border shadow-lg bg-white h-[calc(100dvh-11rem)] md:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-5rem)]">
      {/* ── Desktop Sidebar ── */}
      <div className="hidden md:flex flex-col w-56 xl:w-64 shrink-0 overflow-y-auto" style={{ background: "hsl(224 30% 12%)", borderRight: "1px solid hsl(224 20% 20%)" }}>
        <MailSidebar
          folder={folder}
          setFolder={(f) => { setFolder(f); setSelected(null); setCheckedIds(new Set()); }}
          counts={folderCounts}
          onCompose={() => { setComposing(true); setReplyTo(null); }}
        />
      </div>

      {/* ── Mobile Sidebar Drawer ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 h-full shadow-2xl flex flex-col overflow-y-auto" style={{ background: "hsl(224 30% 12%)" }}>
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid hsl(224 20% 20%)" }}>
              <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="h-5 w-5 text-white/70" />
              </button>
              <span className="font-semibold text-white">✉️ Mail</span>
            </div>
            <MailSidebar
              folder={folder}
              setFolder={(f) => { setFolder(f); setSelected(null); setSidebarOpen(false); setCheckedIds(new Set()); }}
              counts={folderCounts}
              onCompose={() => { setComposing(true); setReplyTo(null); setSidebarOpen(false); }}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Connection banner */}
        {!mailConnected && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-indigo-50 border-b border-indigo-200 shrink-0">
            <div className="flex items-center gap-2 text-xs text-indigo-800">
              <span className="text-base">📭</span>
              <span>Connect your Gmail or workmailtech to send and receive real emails.</span>
            </div>
            <button
              onClick={() => setShowConnectModal(true)}
              className="shrink-0 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-full transition-colors"
            >
              Connect Email
            </button>
          </div>
        )}
        {mailConnected && (
          <div className="flex items-center justify-between gap-3 px-4 py-1.5 bg-green-50 border-b border-green-200 shrink-0">
            <div className="flex items-center gap-2 text-xs text-green-800">
              <span className="text-green-500">●</span>
              <span>Connected: <strong>{connectedEmail}</strong></span>
            </div>
            <button onClick={handleDisconnect} className="text-xs text-red-500 hover:underline shrink-0">Disconnect</button>
          </div>
        )}

        {/* Top search bar */}
        <div className="flex items-center gap-2 px-3 py-2 shrink-0 bg-slate-50" style={{ borderBottom: "1px solid hsl(220 13% 91%)" }}>
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 hover:bg-slate-200 rounded-full text-slate-500">
            <Menu className="h-5 w-5" />
          </button>
          <div className={`flex-1 max-w-2xl flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${searchFocused ? "bg-white shadow-md border border-indigo-200" : "bg-indigo-50 hover:bg-indigo-100/80"}`}>
            <Search className="h-4 w-4 text-indigo-400 shrink-0" />
            <input
              id="mail-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search mail"
              className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button onClick={handleRefresh} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShowMailSettings(s => !s)}
              className="p-2 hover:bg-slate-200 rounded-full text-slate-500"
              title="Mail settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            {showMailSettings && (
              <div className="absolute right-0 top-10 z-50 bg-white border border-border rounded-xl shadow-xl w-72 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Mail Settings</p>
                {mailConnected ? (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-green-700 font-medium">Connected account</p>
                      <p className="text-sm font-semibold text-green-900 truncate">{connectedEmail}</p>
                    </div>
                    <button
                      onClick={() => { setShowMailSettings(false); setShowConnectModal(true); }}
                      className="w-full text-sm text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-700 transition-colors"
                    >
                      🔄 Switch / Reconnect account
                    </button>
                    <button
                      onClick={() => { setShowMailSettings(false); handleDisconnect(); }}
                      className="w-full text-sm text-left px-3 py-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                    >
                      🔌 Disconnect email
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-500">No email account connected yet.</p>
                    <button
                      onClick={() => { setShowMailSettings(false); setShowConnectModal(true); }}
                      className="w-full text-sm font-bold px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    >
                      Connect Email Account
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowMailSettings(false)}
                  className="w-full text-xs text-slate-400 hover:text-slate-600 pt-1"
                >
                  Close
                </button>
              </div>
            )}
          </div>
          <button className="md:hidden px-4 py-2 text-white rounded-2xl text-xs font-bold transition-all" style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
            onClick={() => { setComposing(true); setReplyTo(null); }}>
            + Compose
          </button>
        </div>

        {/* Email detail or list */}
        {selected ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <MailDetail
              mail={selected}
              onClose={() => setSelected(null)}
              onStar={handleStar}
              onDelete={(m) => { handleDelete(m); setSelected(null); }}
              onReply={(m) => { setReplyTo(m); setComposing(true); }}
            />
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* List toolbar */}
            <div className="flex items-center gap-1 px-4 py-1 border-b border-border shrink-0 bg-white">
              <button onClick={toggleSelectAll} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                {selectAll ? <CheckSquare className="h-4 w-4 text-[#1a73e8]" /> : <Square className="h-4 w-4" />}
              </button>
              {hasChecked && (
                <>
                  <button
                    onClick={async () => {
                      for (const id of checkedIds) {
                        const m = mails.find(m => m.id === id);
                        if (m) await handleDelete(m);
                      }
                      setCheckedIds(new Set());
                      setSelectAll(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"
                  >
                    Delete selected ({checkedIds.size})
                  </button>
                </>
              )}
              {!hasChecked && (
                <>
                  <button onClick={handleRefresh} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  </button>
                  <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <span>{filteredMails.length > 0 ? `1–${filteredMails.length} of ${filteredMails.length}` : "0"}</span>
                    <button className="p-1.5 hover:bg-[#e8eaed] rounded-full"><ChevronLeft className="h-3.5 w-3.5" /></button>
                    <button className="p-1.5 hover:bg-[#e8eaed] rounded-full"><ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                </>
              )}
            </div>

            {/* Email list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-[#5f6368]" />
                </div>
              ) : filteredMails.length === 0 ? (
                <EmptyState folder={folderLabel} search={search} onCompose={() => { setComposing(true); setReplyTo(null); }} />
              ) : (
                filteredMails.map(mail => (
                  <MailRow
                    key={mail.id}
                    mail={mail}
                    selected={selected?.id === mail.id}
                    checked={checkedIds.has(mail.id)}
                    onCheck={() => toggleCheck(mail.id)}
                    onClick={() => openMail(mail)}
                    onStar={() => handleStar(mail)}
                    onDelete={() => handleDelete(mail)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Compose modal */}
      {composing && (
        <ComposeModal
          customers={customers}
          onSend={handleSend}
          onClose={() => { setComposing(false); setReplyTo(null); }}
          replyTo={replyTo}
        />
      )}

      {showConnectModal && (
        <MailConnectModal
          onClose={() => setShowConnectModal(false)}
          onConnected={() => { setShowConnectModal(false); load(); }}
        />
      )}
    </div>
  );
}

function EmptyState({ folder, search, onCompose }) {
  const EMPTY = {
    Inbox: { icon: "📥", msg: "Your inbox is empty", sub: "Messages you receive will appear here." },
    Sent: { icon: "📤", msg: "No sent messages", sub: "Emails you send will appear here." },
    Starred: { icon: "⭐", msg: "No starred messages", sub: "Star important messages to find them here." },
    Drafts: { icon: "📝", msg: "No drafts saved", sub: "Your drafts will appear here." },
    Spam: { icon: "🚫", msg: "No spam detected", sub: "Spam messages will be filtered here." },
    Trash: { icon: "🗑️", msg: "Trash is empty", sub: "Deleted messages will appear here." },
  };
  const info = search
    ? { icon: "🔍", msg: `No results for "${search}"`, sub: "Try different keywords or check the folder." }
    : EMPTY[folder] || { icon: "📭", msg: "No messages", sub: "" };

  return (
    <div className="flex flex-col items-center justify-center h-full py-24 px-6 text-center">
      <div className="text-5xl mb-4 opacity-70">{info.icon}</div>
      <p className="text-lg font-medium text-[#202124] mb-1">{info.msg}</p>
      <p className="text-sm text-[#5f6368] max-w-sm">{info.sub}</p>
      {folder === "Sent" && !search && (
        <button
          onClick={onCompose}
          className="mt-6 flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-6 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm"
        >
          + Compose your first email
        </button>
      )}
    </div>
  );
}