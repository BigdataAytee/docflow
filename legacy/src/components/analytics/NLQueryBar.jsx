import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, Loader2, Search } from "lucide-react";

const SUGGESTIONS = [
  "Which customer generated the most revenue?",
  "How many invoices are unpaid?",
  "What is my total revenue this month?",
  "Which product sells the most?",
  "How many quotes were converted to invoices?",
];

export default function NLQueryBar({ docs, customers, onResult }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async (q) => {
    const text = q || query;
    if (!text.trim()) return;
    setLoading(true);
    try {
      // Detect dominant currency
      const currencyMap = {};
      docs.forEach(d => { if (d.currency) currencyMap[d.currency] = (currencyMap[d.currency] || 0) + 1; });
      const currency = Object.entries(currencyMap).sort(([,a],[,b]) => b-a)[0]?.[0] || "NGN";

      const summary = {
        currency,
        totalDocs: docs.length,
        invoices: docs.filter(d => d.type === "invoice").length,
        paidInvoices: docs.filter(d => d.type === "invoice" && d.status === "paid").length,
        unpaidInvoices: docs.filter(d => d.type === "invoice" && ["sent","overdue"].includes(d.status)).length,
        totalRevenue: docs.filter(d => d.type === "invoice" && d.status === "paid").reduce((s, d) => s + (d.total || 0), 0),
        outstanding: docs.filter(d => d.type === "invoice" && ["sent","overdue","partially_paid"].includes(d.status)).reduce((s, d) => s + (d.balance_due || d.total || 0), 0),
        quotations: docs.filter(d => d.type === "quotation").length,
        acceptedQuotations: docs.filter(d => d.type === "quotation" && d.status === "accepted").length,
        receipts: docs.filter(d => d.type === "receipt").length,
        customerCount: customers.length,
        topCustomers: (() => {
          const map = {};
          docs.filter(d => d.type === "invoice").forEach(d => {
            const n = d.customer_name || "Unknown";
            map[n] = (map[n] || 0) + (d.total || 0);
          });
          return Object.entries(map).sort(([,a],[,b]) => b-a).slice(0,5).map(([name, revenue]) => ({ name, revenue }));
        })(),
      };
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a business analytics assistant. Answer this question clearly and concisely using the provided data. IMPORTANT: All monetary values are in ${currency} — always use the ${currency} currency symbol/code when mentioning amounts, never use $ unless the currency is USD. Question: "${text}"\n\nBusiness data: ${JSON.stringify(summary)}`,
      });
      onResult(result);
    } catch {
      onResult("Sorry, I couldn't process that query. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Ask Your Data</h3>
          <p className="text-[11px] text-muted-foreground">Natural language business queries</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAsk()}
            placeholder="e.g. Which customer owes the most money?"
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={() => handleAsk()}
          disabled={loading || !query.trim()}
          className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center gap-2 transition-opacity"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Ask
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => { setQuery(s); handleAsk(s); }}
            className="text-[11px] px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}