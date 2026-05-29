import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
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

  const load = useCallback(async () => {
    setLoading(true);
    const user = await base44.auth.me();
    if (!user) { setLoading(false); return; }
    const [c, m] = await Promise.all([
      base44.entities.Customer.filter({ created_by: user.email }, "-created_date", 200),
      base44.entities.Mail.filter({ created_by: user.email }, "-created_date", 200),
    ]);
    setCustomers(c);
    setMails(m);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSend = async (form) => {
    try {
      await base44.integrations.Core.SendEmail({ to: form.to_email, subject: form.subject, body: form.body });
      await base44.entities.Mail.create({ ...form, status: "sent", folder: "sent", is_read: true });
    } catch {
      await base44.entities.Mail.create({ ...form, status: "failed", folder: "sent", is_read: true });
    }
    const user = await base44.auth.me();
    if (user) {
      const updated = await base44.entities.Mail.filter({ created_by: user.email }, "-created_date", 200);
      setMails(updated);
    }
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
    await base44.entities.Mail.delete(mail.id);
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
    <div className="flex overflow-hidden rounded-2xl border border-[#e0e0e0] bg-white h-[calc(100dvh-11rem)] md:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-5rem)]">
      {/* ── Desktop Sidebar ── */}
      <div className="hidden md:flex flex-col w-56 xl:w-64 shrink-0 overflow-y-auto bg-[#f6f8fc]" style={{ borderRight: "1px solid #e0e0e0" }}>
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
          <div className="relative w-72 bg-[#f6f8fc] h-full shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e0e0e0]">
              <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-[#e8eaed] rounded-full">
                <X className="h-5 w-5 text-[#444746]" />
              </button>
              <span className="font-medium text-[#202124]">Mail</span>
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

        {/* Top search bar */}
        <div className="flex items-center gap-2 px-3 py-2 shrink-0 bg-[#f6f8fc]" style={{ borderBottom: "1px solid #e0e0e0" }}>
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 hover:bg-[#e8eaed] rounded-full text-[#5f6368]">
            <Menu className="h-5 w-5" />
          </button>
          <div className={`flex-1 max-w-2xl flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${searchFocused ? "bg-white shadow-md border border-[#dadce0]" : "bg-[#eaf1fb] hover:bg-[#e4ecf9]"}`}>
            <Search className="h-4 w-4 text-[#5f6368] shrink-0" />
            <input
              id="mail-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search mail"
              className="flex-1 text-sm bg-transparent outline-none text-[#202124] placeholder:text-[#5f6368]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-[#5f6368] hover:text-[#202124]">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button onClick={handleRefresh} className="p-2 hover:bg-[#e8eaed] rounded-full text-[#5f6368]">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button className="p-2 hover:bg-[#e8eaed] rounded-full text-[#5f6368] hidden sm:block">
            <Settings className="h-4 w-4" />
          </button>
          <button className="md:hidden p-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-2xl text-xs font-medium px-3"
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
            <div className="flex items-center gap-1 px-4 py-1 border-b border-[#e0e0e0] shrink-0 bg-white">
              <button onClick={toggleSelectAll} className="p-2 hover:bg-[#e8eaed] rounded-full text-[#5f6368]">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#5f6368] hover:bg-[#e8eaed] rounded-full transition-colors"
                  >
                    Delete selected ({checkedIds.size})
                  </button>
                </>
              )}
              {!hasChecked && (
                <>
                  <button onClick={handleRefresh} className="p-2 hover:bg-[#e8eaed] rounded-full text-[#5f6368]">
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  </button>
                  <button className="p-2 hover:bg-[#e8eaed] rounded-full text-[#5f6368]">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 text-xs text-[#5f6368]">
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