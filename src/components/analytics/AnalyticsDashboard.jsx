import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import {
  TrendingUp, DollarSign, FileText, FileCheck, Receipt,
  Users, ShoppingBag, Target, Zap, Sparkles, ArrowUpRight, ArrowDownRight,
  AlertCircle, ChevronRight, RefreshCw, Filter, X, Loader2,
  Award, Package, BarChart2, PieChart as PieIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import NLQueryBar from "@/components/analytics/NLQueryBar";
import DrillDownModal from "@/components/analytics/DrillDownModal";

const COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#14b8a6","#f97316","#ec4899","#3b82f6","#84cc16"];

function fmt(n, currency = "") {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${currency}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency}${(n / 1_000).toFixed(1)}K`;
  return `${currency}${Number(n).toFixed(0)}`;
}

function KpiCard({ label, value, sub, trend, icon: Icon, color, onClick }) {
  const up = trend >= 0;
  return (
    <div
      className={`bg-card border border-border rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + "20" }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-bold ${up ? "text-emerald-600" : "text-red-500"}`}>
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AnalyticsDashboard({ user }) {
  const [dateRange, setDateRange] = useState("all");
  const [nlResult, setNlResult] = useState(null);
  const [drillDown, setDrillDown] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["analytics-docs", user?.id],
    queryFn: () => base44.entities.Document.filter({ created_by_id: user.id }, "-created_date", 10000),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["analytics-customers", user?.id],
    queryFn: () => base44.entities.Customer.list(),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    if (dateRange === "all") return docs;
    const now = new Date();
    const cutoff = new Date();
    if (dateRange === "7d") cutoff.setDate(now.getDate() - 7);
    else if (dateRange === "30d") cutoff.setDate(now.getDate() - 30);
    else if (dateRange === "90d") cutoff.setDate(now.getDate() - 90);
    else if (dateRange === "ytd") cutoff.setMonth(0, 1);
    return docs.filter(d => new Date(d.issue_date || d.created_date) >= cutoff);
  }, [docs, dateRange]);

  const kpis = useMemo(() => {
    const invoices = filtered.filter(d => d.type === "invoice");
    const quotations = filtered.filter(d => d.type === "quotation");
    const receipts = filtered.filter(d => d.type === "receipt");
    const totalRevenue = invoices.filter(d => d.status === "paid").reduce((s, d) => s + (d.total || 0), 0);
    const outstanding = invoices.filter(d => ["sent","overdue","partially_paid"].includes(d.status)).reduce((s, d) => s + (d.balance_due || d.total || 0), 0);
    const receiptTotal = receipts.reduce((s, d) => s + (d.total || 0), 0);
    const avgOrderValue = invoices.length ? invoices.reduce((s, d) => s + (d.total || 0), 0) / invoices.length : 0;
    const convertedQuotes = quotations.filter(d => d.status === "accepted").length;
    const conversionRate = quotations.length ? (convertedQuotes / quotations.length) * 100 : 0;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const prevYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const thisMoRevenue = invoices.filter(d => {
      const dt = new Date(d.issue_date || d.created_date);
      return dt.getMonth() === thisMonth && dt.getFullYear() === thisYear && d.status === "paid";
    }).reduce((s, d) => s + (d.total || 0), 0);
    const prevMoRevenue = invoices.filter(d => {
      const dt = new Date(d.issue_date || d.created_date);
      return dt.getMonth() === prevMonth && dt.getFullYear() === prevYear && d.status === "paid";
    }).reduce((s, d) => s + (d.total || 0), 0);
    const monthGrowth = prevMoRevenue ? ((thisMoRevenue - prevMoRevenue) / prevMoRevenue) * 100 : 0;
    return { totalRevenue, outstanding, receiptTotal, avgOrderValue, conversionRate, monthGrowth, invoiceCount: invoices.length, quotationCount: quotations.length };
  }, [filtered]);

  const monthlyRevenue = useMemo(() => {
    const map = {};
    docs.filter(d => d.type === "invoice" && d.status === "paid").forEach(d => {
      const dt = new Date(d.issue_date || d.created_date);
      const key = `${dt.getFullYear()}-${String(dt.getMonth()).padStart(2,"0")}`;
      map[key] = (map[key] || 0) + (d.total || 0);
    });
    const sorted = Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).slice(-12);
    return sorted.map(([key, val]) => {
      const [, m] = key.split("-");
      return { month: MONTHS[parseInt(m)], revenue: val };
    });
  }, [docs]);

  const topCustomers = useMemo(() => {
    const map = {};
    filtered.filter(d => d.type === "invoice").forEach(d => {
      const name = d.customer_name || "Unknown";
      if (!map[name]) map[name] = { name, revenue: 0, count: 0 };
      map[name].revenue += d.total || 0;
      map[name].count++;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [filtered]);

  const topProducts = useMemo(() => {
    const map = {};
    filtered.forEach(d => {
      (d.items || []).forEach(item => {
        const name = item.description || "Unknown Item";
        if (!map[name]) map[name] = { name, revenue: 0, qty: 0, count: 0 };
        map[name].revenue += item.amount || (item.unit_price * item.quantity) || 0;
        map[name].qty += item.quantity || 1;
        map[name].count++;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filtered]);

  const funnel = useMemo(() => {
    const quotes = filtered.filter(d => d.type === "quotation").length;
    const invoices = filtered.filter(d => d.type === "invoice").length;
    const paid = filtered.filter(d => d.type === "invoice" && d.status === "paid").length;
    const receipts = filtered.filter(d => d.type === "receipt").length;
    return [
      { name: "Quotations", value: quotes, fill: "#8b5cf6" },
      { name: "Invoices", value: invoices, fill: "#3b82f6" },
      { name: "Paid", value: paid, fill: "#10b981" },
      { name: "Receipts", value: receipts, fill: "#f59e0b" },
    ];
  }, [filtered]);

  const forecast = useMemo(() => {
    if (monthlyRevenue.length < 3) return null;
    const recent = monthlyRevenue.slice(-3);
    const avg = recent.reduce((s, r) => s + r.revenue, 0) / recent.length;
    const growth = recent.length > 1 ? (recent[recent.length-1].revenue - recent[0].revenue) / (recent.length - 1) : 0;
    const nextVal = Math.max(0, avg + growth);
    const nextMonth = MONTHS[(MONTHS.indexOf(recent[recent.length-1].month) + 1) % 12];
    return { month: nextMonth, value: nextVal, confidence: 72 };
  }, [monthlyRevenue]);

  // Detect dominant currency from documents
  const dominantCurrency = useMemo(() => {
    const map = {};
    docs.forEach(d => { if (d.currency) map[d.currency] = (map[d.currency] || 0) + 1; });
    const sorted = Object.entries(map).sort(([,a],[,b]) => b - a);
    return sorted[0]?.[0] || "NGN";
  }, [docs]);

  const generateInsights = async () => {
    setAiLoading(true);
    try {
      const summary = {
        totalDocs: filtered.length,
        invoiceRevenue: kpis.totalRevenue,
        topProduct: topProducts[0]?.name,
        topCustomer: topCustomers[0]?.name,
        conversionRate: kpis.conversionRate.toFixed(1),
        outstanding: kpis.outstanding,
        monthGrowth: kpis.monthGrowth.toFixed(1),
        productCount: topProducts.length,
        currency: dominantCurrency,
      };
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a business analytics AI. Analyze this business data and return 5 concise, actionable insights and recommendations. Be specific and data-driven. IMPORTANT: All monetary values are in ${dominantCurrency} — always use the ${dominantCurrency} currency symbol/code when mentioning amounts, never use $ unless the currency is USD. Data: ${JSON.stringify(summary)}`,
        response_json_schema: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  type: { type: "string", enum: ["opportunity", "warning", "info", "success"] },
                  action: { type: "string" }
                }
              }
            }
          }
        }
      });
      setAiInsights(result.insights || []);
    } catch {
      setAiInsights([]);
    } finally {
      setAiLoading(false);
    }
  };

  const docBreakdown = useMemo(() => [
    { name: "Invoices", value: filtered.filter(d => d.type === "invoice").length },
    { name: "Quotations", value: filtered.filter(d => d.type === "quotation").length },
    { name: "Receipts", value: filtered.filter(d => d.type === "receipt").length },
    { name: "Waybills", value: filtered.filter(d => d.type === "waybill").length },
  ].filter(d => d.value > 0), [filtered]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <BarChart2 className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground font-medium">No data yet</p>
        <p className="text-sm text-muted-foreground/70">Create some documents to see analytics here.</p>
      </div>
    );
  }

  const insightColors = { opportunity: "#10b981", warning: "#f59e0b", info: "#6366f1", success: "#3b82f6" };
  const insightIcons = { opportunity: Target, warning: AlertCircle, info: Sparkles, success: Award };

  return (
    <div className="space-y-8">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {[
          { id: "all", label: "All Time" },
          { id: "7d", label: "7 Days" },
          { id: "30d", label: "30 Days" },
          { id: "90d", label: "90 Days" },
          { id: "ytd", label: "This Year" },
        ].map(opt => (
          <button key={opt.id} onClick={() => setDateRange(opt.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${dateRange === opt.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} documents</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Revenue" value={fmt(kpis.totalRevenue, "₦")} sub="From paid invoices" trend={kpis.monthGrowth} icon={DollarSign} color="#10b981" />
        <KpiCard label="Outstanding" value={fmt(kpis.outstanding, "₦")} sub="Unpaid invoices" icon={AlertCircle} color="#f59e0b" />
        <KpiCard label="Conversion Rate" value={`${kpis.conversionRate.toFixed(0)}%`} sub="Quotes → Invoices" trend={kpis.conversionRate - 50} icon={Target} color="#6366f1" />
        <KpiCard label="Avg Order Value" value={fmt(kpis.avgOrderValue, "₦")} sub="Per invoice" icon={ShoppingBag} color="#3b82f6" />
        <KpiCard label="Invoices" value={kpis.invoiceCount} sub="Total issued" icon={FileText} color="#6366f1" />
        <KpiCard label="Quotations" value={kpis.quotationCount} sub="Total sent" icon={FileCheck} color="#8b5cf6" />
        <KpiCard label="Receipts Collected" value={fmt(kpis.receiptTotal, "₦")} sub="Total receipts" icon={Receipt} color="#10b981" />
        <KpiCard label="Monthly Growth" value={`${kpis.monthGrowth >= 0 ? "+" : ""}${kpis.monthGrowth.toFixed(1)}%`} sub="vs last month" trend={kpis.monthGrowth} icon={TrendingUp} color="#f59e0b" />
      </div>

      {/* Revenue Trend */}
      {monthlyRevenue.length > 1 && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <SectionTitle icon={TrendingUp} title="Revenue Trend" subtitle="Monthly paid invoice revenue" />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={v => [fmt(v, "₦"), "Revenue"]} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 4, fill: "#6366f1" }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
          {forecast && (
            <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900">
              <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
              <p className="text-xs text-indigo-700 dark:text-indigo-300">
                <span className="font-bold">Forecast:</span> {forecast.month} revenue projected at{" "}
                <span className="font-bold">{fmt(forecast.value, "₦")}</span> — {forecast.confidence}% confidence
              </p>
            </div>
          )}
        </div>
      )}

      {/* Top Customers + Top Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <SectionTitle icon={Users} title="Top Customers" subtitle="By invoice revenue" />
          {topCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No customer data yet</p>
          ) : (
            <div className="space-y-2">
              {topCustomers.slice(0, 6).map((c, i) => (
                <div key={c.name}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => setDrillDown({ type: "customer", data: c, allDocs: filtered })}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.count} invoice{c.count !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground">{fmt(c.revenue, "₦")}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <SectionTitle icon={Package} title="Top Products / Services" subtitle="By revenue generated" />
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No line-item data yet</p>
          ) : (
            <div className="space-y-2">
              {topProducts.slice(0, 6).map((p, i) => (
                <div key={p.name}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => setDrillDown({ type: "product", data: p, allDocs: filtered })}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">Qty: {p.qty}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground">{fmt(p.revenue, "₦")}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sales Funnel + Doc Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <SectionTitle icon={Filter} title="Sales Funnel" subtitle="Quote → Invoice → Paid → Receipt" />
          <div className="space-y-2.5">
            {funnel.map((stage) => {
              const max = funnel[0]?.value || 1;
              const pct = max ? (stage.value / max) * 100 : 0;
              return (
                <div key={stage.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-foreground">{stage.name}</span>
                    <span className="text-muted-foreground">{stage.value}</span>
                  </div>
                  <div className="h-5 rounded-full overflow-hidden bg-muted">
                    <div className="h-full rounded-full transition-all duration-700 flex items-center pl-2"
                      style={{ width: `${Math.max(pct, 2)}%`, background: stage.fill }}>
                      {pct > 15 && <span className="text-[10px] font-bold text-white">{pct.toFixed(0)}%</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {funnel[0]?.value > 0 && funnel[1]?.value > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Conversion: <span className="font-semibold text-foreground">{((funnel[1].value / funnel[0].value) * 100).toFixed(0)}%</span> of quotes become invoices
            </p>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <SectionTitle icon={PieIcon} title="Document Breakdown" subtitle="By type" />
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={docBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {docBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 flex-1">
              {docBreakdown.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                  <span className="text-xs font-bold text-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Products Bar Chart */}
      {topProducts.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <SectionTitle icon={BarChart2} title="Product Revenue Chart" subtitle="Top products by revenue" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topProducts.slice(0, 8)} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={v => [fmt(v, "₦"), "Revenue"]} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]} onClick={(d) => setDrillDown({ type: "product", data: d, allDocs: filtered })}>
                {topProducts.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} cursor="pointer" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* NL Query Bar */}
      <NLQueryBar docs={filtered} customers={customers} onResult={setNlResult} />
      {nlResult && (
        <div className="bg-card border border-primary/20 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">AI Answer</span>
            </div>
            <button onClick={() => setNlResult(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ReactMarkdown className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none prose-strong:font-bold prose-strong:text-foreground">{nlResult}</ReactMarkdown>
        </div>
      )}

      {/* AI Insights */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon={Sparkles} title="AI Business Insights" subtitle="Powered by intelligent analysis" />
          <Button size="sm" variant="outline" onClick={generateInsights} disabled={aiLoading} className="gap-2 text-xs">
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {aiInsights ? "Refresh" : "Generate Insights"}
          </Button>
        </div>

        {!aiInsights && !aiLoading && (
          <div className="text-center py-8">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Click "Generate Insights" to get AI-powered recommendations for your business.</p>
          </div>
        )}

        {aiLoading && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Analyzing your business data…</p>
          </div>
        )}

        {aiInsights && !aiLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aiInsights.map((insight, i) => {
              const color = insightColors[insight.type] || "#6366f1";
              const Icon = insightIcons[insight.type] || Sparkles;
              return (
                <div key={i} className="flex gap-3 p-4 rounded-xl border" style={{ borderColor: color + "30", background: color + "08" }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "20" }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{insight.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.description}</p>
                    {insight.action && (
                      <p className="text-xs font-semibold mt-1.5" style={{ color }}>→ {insight.action}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {drillDown && (
        <DrillDownModal
          type={drillDown.type}
          data={drillDown.data}
          allDocs={drillDown.allDocs}
          onClose={() => setDrillDown(null)}
        />
      )}
    </div>
  );
}