/**
 * StepVisual — renders a decorative UI mockup for each onboarding step.
 * Uses pure SVG/JSX — no external images required.
 */
export default function StepVisual({ visual }) {
  switch (visual) {
    case "welcome":
      return <WelcomeVisual />;
    case "company":
      return <CompanyVisual />;
    case "branding":
      return <BrandingVisual />;
    case "customers":
      return <CustomersVisual />;
    case "document":
      return <DocumentVisual />;
    case "waybill":
      return <WaybillVisual />;
    case "mail":
      return <MailVisual />;
    case "help":
      return <HelpVisual />;
    default:
      return null;
  }
}

// ── Shared helpers ────────────────────────────────────────────────

function MockCard({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function MockRow({ label, value, accent = false }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <div className="w-2 h-2 rounded-full bg-indigo-200 shrink-0" />
      <span className="text-[10px] text-slate-400 w-20 shrink-0">{label}</span>
      <div className={`h-2 rounded flex-1 ${accent ? "bg-indigo-300" : "bg-slate-100"}`} style={{ maxWidth: value }} />
    </div>
  );
}

function DocHeader({ type = "INVOICE", num = "#INV-001" }) {
  const colors = {
    INVOICE: "#3b82f6",
    QUOTATION: "#8b5cf6",
    RECEIPT: "#10b981",
    WAYBILL: "#f59e0b",
  };
  const c = colors[type] || "#3b82f6";
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-t-xl" style={{ background: c }}>
      <div>
        <div className="h-2 w-16 bg-white/60 rounded mb-1" />
        <div className="h-1.5 w-10 bg-white/30 rounded" />
      </div>
      <div className="text-right">
        <div className="text-[9px] font-bold text-white/80 uppercase tracking-wide">{type}</div>
        <div className="text-[10px] font-bold text-white">{num}</div>
      </div>
    </div>
  );
}

// ── Welcome ───────────────────────────────────────────────────────

function WelcomeVisual() {
  const cards = [
    { label: "Invoices", color: "#3b82f6", icon: "📄", count: "12" },
    { label: "Quotations", color: "#8b5cf6", icon: "📋", count: "5" },
    { label: "Receipts", color: "#10b981", icon: "🧾", count: "8" },
    { label: "Waybills", color: "#f59e0b", icon: "🚚", count: "3" },
  ];
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl p-3 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg,${c.color},${c.color}cc)` }}>
            <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-white/10" />
            <div className="text-lg mb-1">{c.icon}</div>
            <div className="text-xs font-bold">{c.label}</div>
            <div className="text-[10px] text-white/70">{c.count} docs</div>
          </div>
        ))}
      </div>
      <MockCard>
        <div className="px-3 py-2">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Recent Documents</div>
          {["INV-012 · Acme Ltd", "QUO-005 · Beta Corp", "REC-008 · Delta Inc"].map(r => (
            <div key={r} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
              <div className="w-5 h-5 rounded-md bg-indigo-100 flex items-center justify-center text-[8px]">📄</div>
              <div className="h-1.5 bg-slate-100 rounded flex-1" />
              <div className="w-8 h-3 rounded-full bg-emerald-100" />
            </div>
          ))}
        </div>
      </MockCard>
    </div>
  );
}

// ── Company ───────────────────────────────────────────────────────

function CompanyVisual() {
  return (
    <MockCard>
      <div className="bg-indigo-600 px-3 py-2 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm">🏢</div>
        <div>
          <div className="h-2 w-20 bg-white/70 rounded mb-1" />
          <div className="h-1.5 w-14 bg-white/40 rounded" />
        </div>
      </div>
      <div className="px-3 py-3 space-y-2">
        {[
          { l: "Company Name", w: "80%", hi: true },
          { l: "Address", w: "65%" },
          { l: "Email", w: "70%", hi: true },
          { l: "Phone", w: "55%" },
          { l: "VAT Number", w: "50%" },
          { l: "Website", w: "60%" },
        ].map(f => (
          <div key={f.l} className="flex items-center gap-2">
            <span className="text-[9px] text-slate-400 w-20 shrink-0">{f.l}</span>
            <div className={`h-5 rounded-md border flex-1 ${f.hi ? "border-indigo-300 bg-indigo-50" : "border-slate-100 bg-slate-50"}`} style={{ maxWidth: f.w }} />
          </div>
        ))}
        <div className="pt-1 flex justify-end">
          <div className="h-6 w-20 rounded-lg bg-indigo-500 flex items-center justify-center">
            <div className="h-1.5 w-12 bg-white/70 rounded" />
          </div>
        </div>
      </div>
    </MockCard>
  );
}

// ── Branding ──────────────────────────────────────────────────────

function BrandingVisual() {
  const templates = [
    { name: "Classic", color: "#3b82f6", active: false },
    { name: "Modern", color: "#8b5cf6", active: true },
    { name: "Minimal", color: "#64748b", active: false },
    { name: "Bold", color: "#ef4444", active: false },
  ];
  const colors = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#475569"];
  return (
    <div className="space-y-2.5">
      <MockCard>
        <div className="px-3 pt-2.5 pb-1">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-2">Layout Template</div>
          <div className="grid grid-cols-4 gap-1.5">
            {templates.map(t => (
              <div key={t.name}
                className={`rounded-lg border-2 p-1.5 text-center cursor-pointer ${t.active ? "border-indigo-500 bg-indigo-50" : "border-slate-100"}`}>
                <div className="h-6 rounded-md mb-1" style={{ background: t.active ? t.color : "#e2e8f0" }} />
                <div className="text-[8px] font-semibold" style={{ color: t.active ? "#4f46e5" : "#94a3b8" }}>{t.name}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="px-3 pb-3 pt-1">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-2">Brand Colour</div>
          <div className="flex gap-1.5 flex-wrap">
            {colors.map((c, i) => (
              <div key={c} className={`w-5 h-5 rounded-full border-2 ${i === 0 ? "border-slate-900 scale-110" : "border-transparent"}`} style={{ background: c }} />
            ))}
          </div>
        </div>
      </MockCard>
      <MockCard>
        <DocHeader type="INVOICE" />
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-200" />
            <div>
              <div className="h-2 w-16 bg-slate-200 rounded mb-1" />
              <div className="h-1.5 w-12 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-1.5 bg-slate-100 rounded w-full" />
            <div className="h-1.5 bg-slate-100 rounded w-3/4" />
          </div>
        </div>
      </MockCard>
    </div>
  );
}

// ── Customers ─────────────────────────────────────────────────────

function CustomersVisual() {
  const customers = [
    { name: "Acme Ltd", email: "info@acme.com", tag: "GBP", fav: true },
    { name: "Beta Corp", email: "hello@beta.io", tag: "USD", fav: false },
    { name: "Delta Inc", email: "ops@delta.com", tag: "EUR", fav: false },
  ];
  return (
    <MockCard>
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <div className="text-[10px] font-bold text-slate-700">Customers</div>
        <div className="h-5 w-14 rounded-lg bg-indigo-500 flex items-center justify-center">
          <div className="h-1.5 w-8 bg-white/70 rounded" />
        </div>
      </div>
      <div className="px-3 py-1.5">
        <div className="flex items-center gap-1.5 mb-2 bg-slate-50 rounded-lg px-2 py-1">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
          <div className="h-1.5 w-20 bg-slate-200 rounded" />
        </div>
        {customers.map(c => (
          <div key={c.name} className="flex items-center gap-2.5 py-2.5 border-b border-slate-50 last:border-0">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[11px] font-bold text-indigo-600 shrink-0">
              {c.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-slate-700">{c.name}</div>
              <div className="text-[9px] text-slate-400">{c.email}</div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{c.tag}</span>
              {c.fav && <span className="text-yellow-400 text-[10px]">★</span>}
            </div>
          </div>
        ))}
      </div>
    </MockCard>
  );
}

// ── Document ──────────────────────────────────────────────────────

function DocumentVisual() {
  return (
    <MockCard>
      <DocHeader type="INVOICE" num="#INV-001" />
      <div className="px-3 py-2.5 space-y-2">
        {/* From / To */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[8px] font-bold text-slate-400 mb-1">FROM</div>
            <div className="h-1.5 bg-slate-200 rounded w-full mb-1" />
            <div className="h-1.5 bg-slate-100 rounded w-3/4" />
          </div>
          <div>
            <div className="text-[8px] font-bold text-slate-400 mb-1">TO</div>
            <div className="h-1.5 bg-indigo-200 rounded w-full mb-1" />
            <div className="h-1.5 bg-indigo-100 rounded w-2/3" />
          </div>
        </div>
        {/* Line items */}
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="grid grid-cols-4 gap-1 mb-1.5">
            {["Description", "Qty", "Price", "Total"].map(h => (
              <div key={h} className="text-[8px] font-bold text-slate-400">{h}</div>
            ))}
          </div>
          {[["Web Design", "1", "£1,200", "£1,200"], ["Hosting", "12", "£10", "£120"]].map((row, i) => (
            <div key={i} className="grid grid-cols-4 gap-1 py-1 border-t border-slate-100">
              {row.map((cell, j) => (
                <div key={j} className="text-[8px] text-slate-500">{cell}</div>
              ))}
            </div>
          ))}
        </div>
        {/* Totals */}
        <div className="flex justify-end">
          <div className="space-y-1 text-right">
            {[["Subtotal", "£1,320"], ["VAT 20%", "£264"], ["Total", "£1,584"]].map(([l, v]) => (
              <div key={l} className="flex items-center gap-4">
                <span className="text-[8px] text-slate-400">{l}</span>
                <span className={`text-[9px] font-bold ${l === "Total" ? "text-indigo-600" : "text-slate-600"}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockCard>
  );
}

// ── Waybill ───────────────────────────────────────────────────────

function WaybillVisual() {
  return (
    <div className="space-y-2">
      <MockCard>
        <DocHeader type="WAYBILL" num="#WB-007" />
        <div className="px-3 py-2.5 space-y-2">
          {[
            { l: "Driver", v: "James Okafor" },
            { l: "Vehicle", v: "LND 234 KJA" },
            { l: "Tracking #", v: "TRK-00892" },
          ].map(f => (
            <div key={f.l} className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 w-16 shrink-0">{f.l}</span>
              <span className="text-[9px] font-semibold text-slate-600">{f.v}</span>
            </div>
          ))}
        </div>
      </MockCard>
      {/* Signature box */}
      <MockCard>
        <div className="px-3 py-2.5">
          <div className="text-[9px] font-bold text-slate-400 mb-2">Digital Signature</div>
          <div className="h-14 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 flex flex-col items-center justify-center gap-1">
            <div className="text-base">✍️</div>
            <div className="text-[8px] text-amber-600 font-medium">Awaiting receiver signature</div>
          </div>
          <div className="mt-2 flex gap-1.5">
            <div className="flex-1 h-6 rounded-lg bg-amber-500 flex items-center justify-center">
              <div className="h-1.5 w-12 bg-white/70 rounded" />
            </div>
            <div className="w-16 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
              <div className="h-1.5 w-8 bg-slate-300 rounded" />
            </div>
          </div>
        </div>
      </MockCard>
    </div>
  );
}

// ── Mail ──────────────────────────────────────────────────────────

function MailVisual() {
  return (
    <MockCard>
      <div className="bg-red-500 px-3 py-2 flex items-center gap-2">
        <div className="text-white text-sm">✉️</div>
        <div className="h-2 w-10 bg-white/70 rounded" />
        <div className="ml-auto flex items-center gap-1.5">
          <div className="h-5 w-14 rounded-md bg-white/20 flex items-center justify-center">
            <div className="h-1.5 w-8 bg-white/70 rounded" />
          </div>
        </div>
      </div>
      <div className="px-3 py-2 space-y-2">
        {[
          { sub: "Invoice #INV-012 from MyBizPad", from: "info@company.com", time: "10:24am", unread: true },
          { sub: "Quotation #QUO-005 attached", from: "info@company.com", time: "Yesterday", unread: false },
          { sub: "Receipt #REC-008 for your records", from: "info@company.com", time: "Mon", unread: false },
        ].map((m, i) => (
          <div key={i} className={`flex items-start gap-2.5 p-2 rounded-lg ${m.unread ? "bg-red-50 border border-red-100" : ""}`}>
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">M</div>
            <div className="flex-1 min-w-0">
              <div className={`text-[9px] truncate ${m.unread ? "font-bold text-slate-800" : "text-slate-500"}`}>{m.sub}</div>
              <div className="text-[8px] text-slate-400">{m.from}</div>
            </div>
            <div className="text-[8px] text-slate-400 shrink-0">{m.time}</div>
          </div>
        ))}
      </div>
    </MockCard>
  );
}

// ── Help ──────────────────────────────────────────────────────────

function HelpVisual() {
  const faqs = ["How do I create an invoice?", "How do I add my logo?", "How do Waybills work?"];
  return (
    <div className="space-y-2">
      <MockCard>
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
          <span className="text-sm">🙋</span>
          <div className="h-2 w-16 bg-slate-200 rounded" />
          <div className="ml-auto h-5 w-20 rounded-lg bg-indigo-100" />
        </div>
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            <div className="h-1.5 w-24 bg-slate-200 rounded" />
          </div>
          {faqs.map((q, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div className="h-1.5 rounded bg-slate-100" style={{ width: `${55 + i * 10}%` }} />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-100 shrink-0" />
            </div>
          ))}
        </div>
      </MockCard>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-base">🎉</div>
        <div>
          <div className="text-[10px] font-bold text-emerald-800">Setup Complete!</div>
          <div className="text-[9px] text-emerald-600 mt-0.5">You're ready to use MyBizPad</div>
        </div>
        <div className="ml-auto">
          <div className="w-5 h-5 rounded-full bg-emerald-200 flex items-center justify-center">
            <div className="text-[8px] text-emerald-700 font-bold">✓</div>
          </div>
        </div>
      </div>
    </div>
  );
}