import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { format, subDays, startOfDay } from "date-fns";
import {
  Users, FileText, DollarSign, TrendingUp, ShieldAlert,
  Activity, BarChart2, Calendar, RefreshCw
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const currencySymbols = { NGN: "₦", USD: "$", EUR: "€", GBP: "£" };
const sym = (c) => currencySymbols[c] || "₦";

function StatCard({ title, value, sub, icon: Icon, color = "blue" }) {
  const colors = {
    blue:   { bg: "bg-blue-50",    icon: "text-blue-500",    border: "border-blue-100" },
    green:  { bg: "bg-emerald-50", icon: "text-emerald-500", border: "border-emerald-100" },
    purple: { bg: "bg-purple-50",  icon: "text-purple-500",  border: "border-purple-100" },
    orange: { bg: "bg-orange-50",  icon: "text-orange-500",  border: "border-orange-100" },
    red:    { bg: "bg-red-50",     icon: "text-red-500",     border: "border-red-100" },
  };
  const c = colors[color];
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      <div className={`h-10 w-10 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center shrink-0`}>
        <Icon className={`h-5 w-5 ${c.icon}`} />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  draft: "#94a3b8", sent: "#3b82f6", paid: "#10b981",
  overdue: "#ef4444", cancelled: "#64748b", accepted: "#059669", rejected: "#dc2626"
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = async () => {
    setLoading(true);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      navigate("/documents");
      return;
    }
    setAuthorized(true);
    const [docs, allUsers, allCustomers] = await Promise.all([
      base44.entities.Document.list("-created_date", 500),
      base44.entities.User.list("-created_date", 500),
      base44.entities.Customer.list("-created_date", 500),
    ]);
    setDocuments(docs);
    setUsers(allUsers);
    setCustomers(allCustomers);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const paid = documents.filter(d => d.status === "paid");
    const overdue = documents.filter(d => d.status === "overdue");
    const totalRevenue = paid.reduce((s, d) => s + (d.total || 0), 0);
    const outstanding = documents.filter(d => ["sent", "accepted"].includes(d.status))
      .reduce((s, d) => s + (d.total || 0), 0);
    const now = new Date();
    const thisMonth = documents.filter(d => {
      const dt = d.created_date ? new Date(d.created_date) : null;
      return dt && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    });
    return { paid: paid.length, overdue: overdue.length, totalRevenue, outstanding, thisMonth: thisMonth.length };
  }, [documents]);

  // Daily docs created over last 14 days
  const dailyData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = startOfDay(subDays(new Date(), 13 - i));
      return { date: format(d, "MMM d"), ts: d.getTime(), count: 0, revenue: 0 };
    });
    documents.forEach(doc => {
      if (!doc.created_date) return;
      const ts = startOfDay(new Date(doc.created_date)).getTime();
      const day = days.find(d => d.ts === ts);
      if (day) { day.count++; day.revenue += doc.total || 0; }
    });
    return days;
  }, [documents]);

  // Status breakdown for pie
  const statusData = useMemo(() => {
    const counts = {};
    documents.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });
    return Object.entries(counts).map(([status, value]) => ({ name: status, value }));
  }, [documents]);

  // Doc type breakdown
  const typeData = useMemo(() => {
    const counts = {};
    documents.forEach(d => { counts[d.type] = (counts[d.type] || 0) + 1; });
    return Object.entries(counts).map(([type, count]) => ({ type, count }));
  }, [documents]);

  // User growth (signups per day last 14 days)
  const userGrowth = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = startOfDay(subDays(new Date(), 13 - i));
      return { date: format(d, "MMM d"), ts: d.getTime(), signups: 0 };
    });
    users.forEach(u => {
      if (!u.created_date) return;
      const ts = startOfDay(new Date(u.created_date)).getTime();
      const day = days.find(d => d.ts === ts);
      if (day) day.signups++;
    });
    return days;
  }, [users]);

  // Recent documents
  const recentDocs = documents.slice(0, 10);

  const primaryCurrency = documents[0]?.currency || "NGN";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Platform-wide analytics and monitoring</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-xl hover:bg-muted/50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh · {format(lastRefresh, "HH:mm:ss")}
        </button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={users.length} sub={`${customers.length} customers`} icon={Users} color="blue" />
        <StatCard title="Total Documents" value={documents.length} sub={`${stats.thisMonth} this month`} icon={FileText} color="purple" />
        <StatCard title="Total Revenue" value={`${sym(primaryCurrency)}${stats.totalRevenue.toLocaleString("en", { minimumFractionDigits: 0 })}`} sub={`${stats.paid} paid documents`} icon={DollarSign} color="green" />
        <StatCard title="Outstanding" value={`${sym(primaryCurrency)}${stats.outstanding.toLocaleString("en", { minimumFractionDigits: 0 })}`} sub={`${stats.overdue} overdue`} icon={TrendingUp} color="orange" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Documents over time */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Documents Created — Last 14 Days</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="docGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Area type="monotone" dataKey="count" name="Documents" stroke="hsl(var(--primary))" fill="url(#docGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* User signups */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">User Signups — Last 14 Days</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="signups" name="Signups" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4">Document Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Type breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4">Document Types</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="count" name="Count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue last 14 days */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4">Revenue Trend — Last 14 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                formatter={(v) => [`${sym(primaryCurrency)}${v.toLocaleString()}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Users Table + Recent Docs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* All Users */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">All Users ({users.length})</h3>
          </div>
          <div className="divide-y divide-border max-h-72 overflow-y-auto">
            {users.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">No users yet.</p>}
            {users.map(u => (
              <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                  {u.role || "user"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Documents */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Recent Documents</h3>
          </div>
          <div className="divide-y divide-border max-h-72 overflow-y-auto">
            {recentDocs.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">No documents yet.</p>}
            {recentDocs.map(doc => (
              <div key={doc.id} className="px-5 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{doc.number}</p>
                  <p className="text-xs text-muted-foreground truncate">{doc.customer_name} · {doc.created_by}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{sym(doc.currency)}{(doc.total || 0).toLocaleString("en", { minimumFractionDigits: 0 })}</p>
                  <p className="text-xs text-muted-foreground">{doc.created_date ? format(new Date(doc.created_date), "d MMM") : "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform Summary */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Platform Summary</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: "Total Documents", value: documents.length },
            { label: "Total Users", value: users.length },
            { label: "Total Customers", value: customers.length },
            { label: "Paid Documents", value: stats.paid },
          ].map(item => (
            <div key={item.label} className="bg-muted/30 rounded-xl p-4">
              <p className="text-2xl font-black text-primary">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}