import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, CheckCircle2, XCircle, Clock, AlertCircle, X } from "lucide-react";

const TYPE_ICONS = {
  payment_received: { icon: CheckCircle2, color: "#10b981", bg: "#ecfdf5" },
  payment_failed:   { icon: XCircle,      color: "#ef4444", bg: "#fef2f2" },
  payment_pending:  { icon: Clock,        color: "#f59e0b", bg: "#fffbeb" },
  receipt_generated:{ icon: CheckCircle2, color: "#6366f1", bg: "#eef2ff" },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [user, setUser] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u) {
        setUser(u);
        loadNotifications(u.id);
      }
    });
  }, []);

  const loadNotifications = async (userId) => {
    const notifs = await base44.entities.Notification.filter({ target_user_id: userId }, "-created_date", 20);
    setNotifications(notifs || []);
  };

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const unsub = base44.entities.Notification.subscribe((event) => {
      if (event.type === "create" && event.data?.target_user_id === user.id) {
        setNotifications(prev => [event.data, ...prev]);
      }
      if (event.type === "update") {
        setNotifications(prev => prev.map(n => n.id === event.data.id ? event.data : n));
      }
    });
    return unsub;
  }, [user]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = notifications.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.is_read);
    await Promise.all(unreadNotifs.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (id) => {
    await base44.entities.Notification.update(id, { is_read: true });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-popover border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-foreground" />
              <span className="font-semibold text-sm">Notifications</span>
              {unread > 0 && <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_ICONS[n.type] || TYPE_ICONS.payment_received;
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors hover:bg-muted/30 ${!n.is_read ? "bg-primary/5" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                      <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold text-foreground truncate ${!n.is_read ? "font-bold" : ""}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(n.created_date).toLocaleString()}</p>
                    </div>
                    {!n.is_read && <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}