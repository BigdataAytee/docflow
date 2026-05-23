import { buildTheme } from "./TemplateSelector";

const TYPE_LABELS = {
  invoice: "INVOICE", quotation: "QUOTATION", receipt: "RECEIPT",
  purchase_order: "PURCHASE ORDER", credit_note: "CREDIT NOTE",
  waybill: "WAYBILL", delivery_note: "DELIVERY NOTE", letterhead: "LETTER",
};
const BILL_TO_LABEL = { purchase_order: "VENDOR", waybill: "SHIP TO", delivery_note: "SHIP TO", letterhead: "ADDRESSED TO" };
const AMOUNT_LABEL  = { receipt: "AMOUNT RECEIVED", credit_note: "AMOUNT CREDITED", quotation: "QUOTED AMOUNT", purchase_order: "ORDER TOTAL" };

const fmt = (n) => (n || 0).toLocaleString("en", { minimumFractionDigits: 2 });

// ─── Shared sub-sections ────────────────────────────────────────────────────

function ItemsTable({ items, docType, T }) {
  const showPrice = docType !== "waybill";
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={{ background: T.tableHeaderBg, borderBottom: `2px solid ${T.accentColor}` }}>
          <th style={{ textAlign: "left", padding: "9px 28px", color: T.tableHeaderColor, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Description</th>
          <th style={{ textAlign: "right", padding: "9px 12px", color: T.tableHeaderColor, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Qty</th>
          {showPrice && <th style={{ textAlign: "right", padding: "9px 12px", color: T.tableHeaderColor, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Rate</th>}
          {showPrice && <th style={{ textAlign: "right", padding: "9px 28px 9px 12px", color: T.tableHeaderColor, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Amount</th>}
        </tr>
      </thead>
      <tbody>
        {items.length > 0 ? items.map((item, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "transparent" : T.stripBg === "#ffffff" || T.stripBg === "#fafafa" ? "#fafafa" : "transparent" }}>
            <td style={{ padding: "10px 28px", color: "#334155" }}>{item.description || <span style={{ color: "#cbd5e1" }}>Item description</span>}</td>
            <td style={{ padding: "10px 12px", textAlign: "right", color: "#64748b" }}>{(item.quantity || 0).toFixed(2)}</td>
            {showPrice && <td style={{ padding: "10px 12px", textAlign: "right", color: "#64748b" }}>{fmt(item.unit_price)}</td>}
            {showPrice && <td style={{ padding: "10px 28px 10px 12px", textAlign: "right", fontWeight: 600, color: "#1e293b" }}>{fmt(item.amount)}</td>}
          </tr>
        )) : (
          <tr><td colSpan={4} style={{ padding: "24px 28px", color: "#cbd5e1", textAlign: "center", fontSize: 11 }}>No items added yet</td></tr>
        )}
      </tbody>
    </table>
  );
}

function TotalsBlock({ calcs, form, sym, T, amountLabel }) {
  if (!calcs) return null;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 28px 20px" }}>
      <div style={{ width: 260, fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#64748b" }}><span>Subtotal</span><span>{fmt(calcs.subtotal)}</span></div>
        {(calcs.taxAmt || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#64748b" }}><span>VAT ({form.tax_rate}%)</span><span>{fmt(calcs.taxAmt)}</span></div>}
        {(form.shipping || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#64748b" }}><span>Shipping</span><span>{fmt(form.shipping)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 6px", borderTop: `2px solid ${T.totalBorder}`, marginTop: 6, fontWeight: 800, fontSize: 14, color: "#111827" }}>
          <span>{amountLabel}</span><span style={{ color: T.accentColor }}>{sym}{fmt(calcs.total)}</span>
        </div>
      </div>
    </div>
  );
}

function Sigs({ managerSig, customerSig, form, T, docType }) {
  const showCustomer = docType === "waybill";
  return (
    <div style={{ display: "flex", gap: 40, padding: "16px 28px", borderTop: "1px solid #e2e8f0" }}>
      <div style={{ minWidth: 160 }}>
        {(managerSig || form?.manager_signature) ? <img src={managerSig || form.manager_signature} alt="" style={{ height: 48, objectFit: "contain", display: "block", marginBottom: 4 }} /> : <div style={{ height: 48 }} />}
        <div style={{ borderTop: `1px solid ${T.accentColor}`, paddingTop: 3 }}>
          <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1 }}>Manager's Signature</div>
          {form?.company_name && <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{form.company_name}</div>}
        </div>
      </div>
      {showCustomer && (
      <div style={{ minWidth: 160 }}>
        {(customerSig || form?.customer_signature) ? <img src={customerSig || form.customer_signature} alt="" style={{ height: 48, objectFit: "contain", display: "block", marginBottom: 4 }} /> : <div style={{ height: 48 }} />}
        <div style={{ borderTop: `1px solid ${T.accentColor}`, paddingTop: 3 }}>
          <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1 }}>Customer's Signature</div>
        </div>
      </div>
      )}
    </div>
  );
}

// ─── Layout 1: Classic ───────────────────────────────────────────────────────
// Logo+company left | type+number+amount right. Standard 2-col bill strip.
function ClassicDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  const isLetter = docType === "letterhead";
  const isColoredHeader = T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb";

  return (
    <div style={{ background: "#fff", minHeight: 1040 }}>
      {/* Header */}
      <div style={{ background: T.headerBg, borderBottom: `2px solid ${T.accentColor}`, padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {form.logo_url ? <img src={form.logo_url} alt="logo" style={{ height: 110, maxWidth: 200, objectFit: "contain", display: "block", marginBottom: 8 }} /> : <div style={{ height: 8 }} />}
          <div style={{ fontWeight: 900, fontSize: 18, color: T.headerColor }}>{form.company_name || "Your Company"}</div>
          {form.company_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.65, marginTop: 3, whiteSpace: "pre-line" }}>{form.company_address}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 3, color: T.docTitleColor }}>{label}</div>
          <div style={{ fontSize: 12, color: T.headerColor, opacity: 0.5, marginTop: 4, fontFamily: "monospace" }}>{form.number || "—"}</div>
          {!isLetter && docType !== "waybill" && (
            <div style={{ marginTop: 10, background: isColoredHeader ? "rgba(255,255,255,0.15)" : "#f8fafc", border: `1px solid ${isColoredHeader ? "rgba(255,255,255,0.2)" : "#e2e8f0"}`, borderRadius: 6, padding: "6px 14px", display: "inline-block" }}>
              <div style={{ fontSize: 8, color: isColoredHeader ? "rgba(255,255,255,0.65)" : "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isColoredHeader ? "#fff" : "#111827", marginTop: 2 }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          )}
        </div>
      </div>
      {/* Bill strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: T.stripBg, borderBottom: `1px solid ${T.stripBorder}` }}>
        <div style={{ padding: "16px 32px", borderRight: `1px solid ${T.stripBorder}` }}>
          <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>From</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.company_name || "—"}</div>
          {form.company_email && <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>{form.company_email}</div>}
        </div>
        <div style={{ padding: "16px 32px" }}>
          <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>{billToLabel}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
          {form.customer_address && <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
          {form.customer_email && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{form.customer_email}</div>}
        </div>
      </div>
      {/* Dates */}
      {!isLetter && <div style={{ display: "flex", gap: 28, padding: "10px 32px", borderBottom: `1px solid ${T.stripBorder}`, fontSize: 11, background: "#fff" }}>
        {form.issue_date && <div><span style={{ color: "#94a3b8" }}>Date: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.issue_date}</span></div>}
        {form.due_date && <div><span style={{ color: "#94a3b8" }}>Due: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.due_date}</span></div>}
        {form.terms_label && <div><span style={{ color: "#94a3b8" }}>Terms: </span><span style={{ color: "#334155" }}>{form.terms_label}</span></div>}
      </div>}
      {/* Body */}
      {isLetter ? <div style={{ padding: "28px 32px", minHeight: 400, fontSize: 12, color: "#334155", lineHeight: 2 }} dangerouslySetInnerHTML={{ __html: form.notes || "<p>Letter content...</p>" }} />
        : <><ItemsTable items={items} docType={docType} T={T} />{docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}</>}
      {!isLetter && <Sigs managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} />}
      <div style={{ padding: "10px 32px", background: T.stripBg, borderTop: `1px solid ${T.stripBorder}`, textAlign: "center", fontSize: 9, color: T.tableHeaderColor }}>
        {[form.company_phone, form.company_email, form.company_website].filter(Boolean).join("  ·  ")}
      </div>
    </div>
  );
}

// ─── Layout 2: Modern ────────────────────────────────────────────────────────
// Full-bleed bold color header band. Company info on left with logo above.
// Document type huge right. Info strip below is single row with 3 panels.
function ModernDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  const isLetter = docType === "letterhead";

  return (
    <div style={{ background: "#fff", minHeight: 1040 }}>
      {/* Full-bleed header */}
      <div style={{ background: T.headerBg, padding: "0" }}>
        <div style={{ padding: "28px 36px 0", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ flex: 1 }}>
            {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 100, maxWidth: 180, objectFit: "contain", display: "block", marginBottom: 10, filter: T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb" ? "brightness(0) invert(1)" : "none", opacity: 0.9 }} />}
            <div style={{ fontSize: 22, fontWeight: 900, color: T.headerColor, letterSpacing: -0.5 }}>{form.company_name || "Your Company"}</div>
            {form.company_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.6, marginTop: 4, whiteSpace: "pre-line" }}>{form.company_address}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: T.docTitleColor, lineHeight: 1, letterSpacing: 2 }}>{label}</div>
            <div style={{ fontSize: 13, color: T.headerColor, opacity: 0.5, fontFamily: "monospace", marginTop: 6 }}>{form.number || "—"}</div>
          </div>
        </div>
        {/* Colored bottom accent strip */}
        <div style={{ height: 6, background: T.accentColor, marginTop: 20 }} />
      </div>
      {/* 3-panel info strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${T.stripBorder}`, background: T.stripBg }}>
        <div style={{ padding: "14px 20px", borderRight: `1px solid ${T.stripBorder}` }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>From</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.company_name || "—"}</div>
          {form.company_email && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{form.company_email}</div>}
        </div>
        <div style={{ padding: "14px 20px", borderRight: `1px solid ${T.stripBorder}` }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>{billToLabel}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
          {form.customer_address && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
        </div>
        <div style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>Details</div>
          {form.issue_date && <div style={{ fontSize: 10, color: "#64748b" }}><span style={{ color: "#94a3b8" }}>Date </span>{form.issue_date}</div>}
          {form.due_date && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}><span style={{ color: "#94a3b8" }}>Due </span>{form.due_date}</div>}
          {!isLetter && docType !== "waybill" && (
            <div style={{ marginTop: 8, borderTop: `1px solid ${T.stripBorder}`, paddingTop: 6 }}>
              <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase" }}>{amountLabel}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.accentColor }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          )}
        </div>
      </div>
      {/* Body */}
      {isLetter ? <div style={{ padding: "28px 36px", minHeight: 400, fontSize: 12, color: "#334155", lineHeight: 2 }} dangerouslySetInnerHTML={{ __html: form.notes || "<p>Letter content...</p>" }} />
        : <><ItemsTable items={items} docType={docType} T={T} />{docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}</>}
      {!isLetter && <Sigs managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} />}
      <div style={{ height: 6, background: T.accentColor }} />
      <div style={{ padding: "8px 36px", background: T.stripBg, textAlign: "center", fontSize: 9, color: T.tableHeaderColor }}>
        {[form.company_phone, form.company_email, form.company_website].filter(Boolean).join("  ·  ")}
      </div>
    </div>
  );
}

// ─── Layout 3: Minimal ────────────────────────────────────────────────────────
// Ultra-clean: thin top accent bar only, logo tiny left, doc type small right.
// No colored background bands. Just thin dividers. Very whitespace-forward.
function MinimalDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  const isLetter = docType === "letterhead";

  return (
    <div style={{ background: "#fff", minHeight: 1040 }}>
      {/* Thin top bar */}
      <div style={{ height: 4, background: T.accentColor }} />
      {/* Header row */}
      <div style={{ padding: "28px 40px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {form.logo_url ? <img src={form.logo_url} alt="logo" style={{ height: 80, maxWidth: 160, objectFit: "contain", display: "block", marginBottom: 6 }} /> : null}
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{form.company_name || "Your Company"}</div>
          {form.company_address && <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 3, whiteSpace: "pre-line" }}>{form.company_address}</div>}
          {form.company_email && <div style={{ fontSize: 9, color: "#9ca3af" }}>{form.company_email}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 4, color: T.accentColor, textTransform: "uppercase" }}>{label}</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af", marginTop: 4 }}>{form.number || "—"}</div>
          {form.issue_date && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Issued: {form.issue_date}</div>}
          {form.due_date && <div style={{ fontSize: 10, color: "#9ca3af" }}>Due: {form.due_date}</div>}
        </div>
      </div>
      {/* Thin divider */}
      <div style={{ borderTop: "1px solid #f3f4f6", margin: "0 40px" }} />
      {/* Bill-to row */}
      <div style={{ padding: "16px 40px", display: "flex", gap: 48 }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.accentColor, textTransform: "uppercase", marginBottom: 5 }}>{billToLabel}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{form.customer_name || "—"}</div>
          {form.customer_address && <div style={{ fontSize: 10, color: "#6b7280", whiteSpace: "pre-line", marginTop: 2 }}>{form.customer_address}</div>}
          {form.customer_email && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{form.customer_email}</div>}
        </div>
        {!isLetter && docType !== "waybill" && (
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.accentColor, textTransform: "uppercase", marginBottom: 5 }}>{amountLabel}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#111827" }}>{sym}{fmt(calcs?.total || 0)}</div>
            {form.terms_label && <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 3 }}>{form.terms_label}</div>}
          </div>
        )}
      </div>
      <div style={{ borderTop: "1px solid #f3f4f6", margin: "0 40px 0" }} />
      {/* Body */}
      {isLetter ? <div style={{ padding: "28px 40px", minHeight: 400, fontSize: 12, color: "#374151", lineHeight: 2 }} dangerouslySetInnerHTML={{ __html: form.notes || "<p>Letter content...</p>" }} />
        : <><ItemsTable items={items} docType={docType} T={T} />{docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}</>}
      {!isLetter && <Sigs managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} />}
      <div style={{ padding: "10px 40px", borderTop: "1px solid #f3f4f6", textAlign: "center", fontSize: 9, color: "#d1d5db", letterSpacing: 1 }}>
        {[form.company_phone, form.company_email, form.company_website].filter(Boolean).join("  ·  ")}
      </div>
    </div>
  );
}

// ─── Layout 4: Bold ──────────────────────────────────────────────────────────
// Split header: left ~55% colored panel with company, right ~45% white with
// doc type large + amount. No strip — info is inside the split header.
function BoldDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  const isLetter = docType === "letterhead";
  const isColoredHeader = T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb";
  const rightBg = isColoredHeader ? "#ffffff" : T.stripBg;
  const rightBorder = isColoredHeader ? T.accentColor : T.stripBorder;

  return (
    <div style={{ background: "#fff", minHeight: 1040 }}>
      {/* Split header */}
      <div style={{ display: "grid", gridTemplateColumns: "55% 45%" }}>
        {/* Left colored panel */}
        <div style={{ background: T.headerBg, padding: "32px 32px", minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 90, maxWidth: 160, objectFit: "contain", display: "block", marginBottom: 10, filter: isColoredHeader ? "brightness(0) invert(1)" : "none", opacity: 0.9 }} />}
            <div style={{ fontSize: 20, fontWeight: 900, color: T.headerColor }}>{form.company_name || "Your Company"}</div>
            {form.company_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.6, marginTop: 4, whiteSpace: "pre-line" }}>{form.company_address}</div>}
            {form.company_email && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.5, marginTop: 2 }}>{form.company_email}</div>}
          </div>
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: T.headerColor, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{billToLabel}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.headerColor }}>{form.customer_name || "—"}</div>
            {form.customer_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.65, whiteSpace: "pre-line", marginTop: 2 }}>{form.customer_address}</div>}
          </div>
        </div>
        {/* Right white panel */}
        <div style={{ background: rightBg, borderLeft: `4px solid ${rightBorder}`, padding: "32px 28px", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: T.accentColor, lineHeight: 1, letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8", marginTop: 6 }}>{form.number || "—"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            {form.issue_date && <div style={{ fontSize: 10, color: "#94a3b8" }}>Date: <span style={{ fontWeight: 600, color: "#374151" }}>{form.issue_date}</span></div>}
            {form.due_date && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Due: <span style={{ fontWeight: 600, color: "#374151" }}>{form.due_date}</span></div>}
            {!isLetter && docType !== "waybill" && (
              <div style={{ marginTop: 10, padding: "8px 14px", background: T.accentColor, borderRadius: 6, display: "inline-block", textAlign: "right" }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{sym}{fmt(calcs?.total || 0)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Body */}
      {isLetter ? <div style={{ padding: "28px 32px", minHeight: 400, fontSize: 12, color: "#334155", lineHeight: 2 }} dangerouslySetInnerHTML={{ __html: form.notes || "<p>Letter content...</p>" }} />
        : <><ItemsTable items={items} docType={docType} T={T} />{docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}</>}
      {!isLetter && <Sigs managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} />}
      <div style={{ height: 4, background: T.accentColor }} />
      <div style={{ padding: "8px 32px", background: T.stripBg, textAlign: "center", fontSize: 9, color: T.tableHeaderColor }}>
        {[form.company_phone, form.company_email, form.company_website].filter(Boolean).join("  ·  ")}
      </div>
    </div>
  );
}

// ─── Layout 5: Elegant ───────────────────────────────────────────────────────
// Centered logo + company name at top. Ornamental thin borders.
// Bill-to and dates in a 3-column centered row. Refined serif feel.
function ElegantDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  const isLetter = docType === "letterhead";

  return (
    <div style={{ background: "#fff", minHeight: 1040 }}>
      {/* Decorative top border */}
      <div style={{ height: 2, background: T.accentColor }} />
      <div style={{ height: 2, background: T.accentColor, margin: "3px 0 0", opacity: 0.3 }} />

      {/* Centered header */}
      <div style={{ padding: "28px 40px 20px", textAlign: "center", borderBottom: `1px solid ${T.stripBorder}` }}>
        {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 90, maxWidth: 200, objectFit: "contain", display: "inline-block", marginBottom: 10 }} />}
        <div style={{ fontSize: 22, fontWeight: 700, color: T.headerColor, letterSpacing: 1 }}>{form.company_name || "Your Company"}</div>
        {form.company_address && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{form.company_address.replace(/\n/g, "  ·  ")}</div>}
        {/* Ornamental divider */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "14px auto", maxWidth: 300 }}>
          <div style={{ flex: 1, height: 1, background: T.accentColor, opacity: 0.4 }} />
          <div style={{ width: 6, height: 6, background: T.accentColor, transform: "rotate(45deg)" }} />
          <div style={{ flex: 1, height: 1, background: T.accentColor, opacity: 0.4 }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 6, color: T.docTitleColor, textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", marginTop: 4 }}>{form.number || "—"}</div>
      </div>

      {/* 3-column info row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: T.stripBg, borderBottom: `1px solid ${T.stripBorder}` }}>
        <div style={{ padding: "14px 24px", borderRight: `1px solid ${T.stripBorder}`, textAlign: "center" }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.tableHeaderColor, textTransform: "uppercase", marginBottom: 6 }}>From</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.company_name || "—"}</div>
          {form.company_email && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 3 }}>{form.company_email}</div>}
        </div>
        <div style={{ padding: "14px 24px", borderRight: `1px solid ${T.stripBorder}`, textAlign: "center" }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.tableHeaderColor, textTransform: "uppercase", marginBottom: 6 }}>{billToLabel}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
          {form.customer_address && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 3, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
        </div>
        <div style={{ padding: "14px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.tableHeaderColor, textTransform: "uppercase", marginBottom: 6 }}>Invoice Details</div>
          {form.issue_date && <div style={{ fontSize: 10, color: "#6b7280" }}>Issued: {form.issue_date}</div>}
          {form.due_date && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>Due: {form.due_date}</div>}
          {form.terms_label && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, fontStyle: "italic" }}>{form.terms_label}</div>}
          {!isLetter && docType !== "waybill" && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.accentColor, marginTop: 2 }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      {isLetter ? <div style={{ padding: "28px 40px", minHeight: 400, fontSize: 12, color: "#374151", lineHeight: 2 }} dangerouslySetInnerHTML={{ __html: form.notes || "<p>Letter content...</p>" }} />
        : <><ItemsTable items={items} docType={docType} T={T} />{docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}</>}
      {!isLetter && <Sigs managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} />}

      {/* Decorative footer */}
      <div style={{ padding: "12px 40px", textAlign: "center", borderTop: `1px solid ${T.stripBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ flex: 1, height: 1, background: T.accentColor, opacity: 0.3 }} />
          <div style={{ width: 4, height: 4, background: T.accentColor, transform: "rotate(45deg)", opacity: 0.5 }} />
          <div style={{ flex: 1, height: 1, background: T.accentColor, opacity: 0.3 }} />
        </div>
        <div style={{ fontSize: 9, color: "#d1d5db", letterSpacing: 1 }}>
          {[form.company_phone, form.company_email, form.company_website].filter(Boolean).join("  ·  ")}
        </div>
      </div>
      <div style={{ height: 2, background: T.accentColor, opacity: 0.3 }} />
      <div style={{ height: 2, background: T.accentColor, margin: "3px 0 0" }} />
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function DocumentPreview({ form, items, calcs, sym, docType, managerSig, customerSig, template, templateColor }) {
  const T = buildTheme(template || form?.template || "classic", templateColor || form?.template_color || "slate");
  const lineItems = items || [];

  const shared = { form, items: lineItems, calcs, sym, docType, managerSig, customerSig, T };

  const layout = template || form?.template || "classic";

  return (
    <div style={{ width: 760, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", fontFamily: T.font }}>
      {layout === "modern"  && <ModernDoc  {...shared} />}
      {layout === "minimal" && <MinimalDoc {...shared} />}
      {layout === "bold"    && <BoldDoc    {...shared} />}
      {layout === "elegant" && <ElegantDoc {...shared} />}
      {(layout === "classic" || !["modern","minimal","bold","elegant"].includes(layout)) && <ClassicDoc {...shared} />}
    </div>
  );
}