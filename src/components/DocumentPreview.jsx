import { buildTheme } from "./TemplateSelector";

const TYPE_LABELS = {
  invoice: "INVOICE", quotation: "QUOTATION", receipt: "RECEIPT", waybill: "WAYBILL",
};
const BILL_TO_LABEL = { invoice: "BILL TO", quotation: "PREPARED FOR", receipt: "RECEIVED FROM", waybill: "DELIVER TO" };
const AMOUNT_LABEL  = { invoice: "BALANCE DUE", receipt: "AMOUNT RECEIVED", quotation: "ESTIMATED TOTAL", waybill: null };
const ISSUE_LABEL   = { invoice: "Invoice Date", quotation: "Issue Date", receipt: "Payment Date", waybill: "Dispatch Date" };
const DUE_LABEL     = { invoice: "Due Date", quotation: "Expiry Date", receipt: null, waybill: "Delivery Date" };
const SIG_LABEL     = { invoice: "Authorized Signatory", quotation: "Prepared By", receipt: "Received By", waybill: "Dispatcher" };
const SIG2_LABEL    = { quotation: "Customer Acceptance", waybill: "Receiver's Signature" };

const fmt = (n) => (n || 0).toLocaleString("en", { minimumFractionDigits: 2 });

function ExtraFields({ form, docType, T }) {
  if (docType === "receipt") {
    const hasExtra = form.payment_method || form.transaction_id || form.reference_number;
    if (!hasExtra) return null;
    return (
      <div style={{ padding: "12px 48px", borderBottom: `1px solid ${T.stripBorder}`, background: T.stripBg, display: "flex", gap: 32, flexWrap: "wrap" }}>
        {form.payment_method && <div><span style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 2 }}>Payment Method</span><span style={{ fontWeight: 700, color: "#1e293b", fontSize: 12 }}>{form.payment_method}</span></div>}
        {form.transaction_id && <div><span style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 2 }}>Transaction ID</span><span style={{ fontWeight: 700, color: "#1e293b", fontSize: 12 }}>{form.transaction_id}</span></div>}
        {form.reference_number && <div><span style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 2 }}>Reference No.</span><span style={{ fontWeight: 700, color: "#1e293b", fontSize: 12 }}>{form.reference_number}</span></div>}
      </div>
    );
  }
  if (docType === "waybill") {
    const hasExtra = form.driver_name || form.vehicle_number || form.tracking_number;
    if (!hasExtra) return null;
    return (
      <div style={{ padding: "12px 48px", borderBottom: `1px solid ${T.stripBorder}`, background: T.stripBg, display: "flex", gap: 32, flexWrap: "wrap" }}>
        {form.driver_name && <div><span style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 2 }}>Driver</span><span style={{ fontWeight: 700, color: "#1e293b", fontSize: 12 }}>{form.driver_name}</span></div>}
        {form.vehicle_number && <div><span style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 2 }}>Vehicle No.</span><span style={{ fontWeight: 700, color: "#1e293b", fontSize: 12 }}>{form.vehicle_number}</span></div>}
        {form.tracking_number && <div><span style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 2 }}>Tracking No.</span><span style={{ fontWeight: 700, color: "#1e293b", fontSize: 12 }}>{form.tracking_number}</span></div>}
      </div>
    );
  }
  return null;
}

function ItemsTable({ items, docType, T }) {
  const showPrice = docType !== "waybill";
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead>
        <tr style={{ background: T.tableHeaderBg, borderBottom: `2px solid ${T.accentColor}` }}>
          <th style={{ textAlign: "left", padding: "12px 48px 12px 48px", color: T.tableHeaderColor, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Description</th>
          <th style={{ textAlign: "right", padding: "11px 12px", color: T.tableHeaderColor, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Qty</th>
          {showPrice && <th style={{ textAlign: "right", padding: "11px 12px", color: T.tableHeaderColor, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Unit Price</th>}
          {showPrice && <th style={{ textAlign: "right", padding: "12px 48px 12px 12px", color: T.tableHeaderColor, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Amount</th>}
        </tr>
      </thead>
      <tbody>
        {items.length > 0 ? items.map((item, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 0 ? "transparent" : "#f8fafc" }}>
            <td style={{ padding: "14px 48px", color: "#1e293b", fontWeight: 500, fontSize: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {item.image_url && <img src={item.image_url} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.10)" }} />}
                <span>{item.description || <span style={{ color: "#cbd5e1" }}>Item description</span>}</span>
              </div>
            </td>
            <td style={{ padding: "13px 12px", textAlign: "right", color: "#334155", fontWeight: 600, fontSize: 14 }}>{(parseFloat(item.quantity) || 0).toFixed(2)}</td>
            {showPrice && <td style={{ padding: "13px 12px", textAlign: "right", color: "#334155", fontWeight: 500, fontSize: 14 }}>{fmt(item.unit_price)}</td>}
            {showPrice && <td style={{ padding: "14px 48px 14px 12px", textAlign: "right", fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{fmt(item.amount)}</td>}
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
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "18px 48px 28px" }}>
      <div style={{ width: 300, fontSize: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", color: "#475569", fontWeight: 500 }}><span>Subtotal</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{sym}{fmt(calcs.subtotal)}</span></div>
        {(calcs.taxAmt || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", color: "#475569", fontWeight: 500 }}><span>VAT ({form.tax_rate}%)</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{sym}{fmt(calcs.taxAmt)}</span></div>}
        {(parseFloat(form.shipping) || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", color: "#475569", fontWeight: 500 }}><span>Shipping</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{sym}{fmt(form.shipping)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 8px", borderTop: `2px solid ${T.totalBorder}`, marginTop: 10, fontWeight: 900, fontSize: 18, color: "#0f172a" }}>
          <span style={{ fontSize: 16 }}>{amountLabel}</span><span style={{ color: T.accentColor, fontSize: 20 }}>{sym}{fmt(calcs.total)}</span>
        </div>
      </div>
    </div>
  );
}

function PaymentDetailsBlock({ form, sym, T }) {
  if (!form?.payment_method) return null;
  const isBankTransfer = form.payment_method === "Bank Transfer";
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 48px 18px" }}>
      <div style={{ width: 300, border: `1px solid ${T.stripBorder}`, borderRadius: 8, overflow: "hidden", background: T.stripBg }}>
        <div style={{ padding: "8px 14px", background: T.tableHeaderBg, borderBottom: `1px solid ${T.stripBorder}` }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1 }}>Payment Details</span>
        </div>
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ color: "#94a3b8" }}>Method</span>
            <span style={{ fontWeight: 700, color: "#1e293b" }}>{form.payment_method}</span>
          </div>
          {isBankTransfer && form.bank_name && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "#94a3b8" }}>Bank</span>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{form.bank_name}</span>
            </div>
          )}
          {isBankTransfer && form.account_number && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "#94a3b8" }}>Account No.</span>
              <span style={{ fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>{form.account_number}</span>
            </div>
          )}
          {isBankTransfer && form.account_holder_name && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "#94a3b8" }}>Account Name</span>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{form.account_holder_name}</span>
            </div>
          )}
          {form.transaction_id && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "#94a3b8" }}>Transaction ID</span>
              <span style={{ fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>{form.transaction_id}</span>
            </div>
          )}
          {form.reference_number && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "#94a3b8" }}>Reference No.</span>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{form.reference_number}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Sigs({ managerSig, customerSig, form, T, docType }) {
  const showCustomer = docType === "waybill" || docType === "quotation";
  const managerLabel = SIG_LABEL[docType] || "Authorized Signatory";
  const customerLabel = SIG2_LABEL[docType] || "Customer Signature";
  return (
    <div style={{ display: "flex", gap: 40, padding: "20px 48px", borderTop: "1px solid #e2e8f0" }}>
      <div style={{ minWidth: 160 }}>
        {(managerSig || form?.manager_signature) ? <img src={managerSig || form.manager_signature} alt="" style={{ height: 72, objectFit: "contain", display: "block", marginBottom: 4 }} /> : <div style={{ height: 72 }} />}
        <div style={{ borderTop: `1px solid ${T.accentColor}`, paddingTop: 3 }}>
          <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1 }}>{managerLabel}</div>
          {form?.manager_name && <div style={{ fontSize: 11, color: "#1e293b", fontWeight: 700, marginTop: 2 }}>{form.manager_name}</div>}
          {form?.manager_title && <div style={{ fontSize: 9, color: "#64748b", marginTop: 1 }}>{form.manager_title}</div>}
          {!form?.manager_name && form?.company_name && <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{form.company_name}</div>}
        </div>
      </div>
      {showCustomer && (
        <div style={{ minWidth: 180 }}>
          {(customerSig || form?.customer_signature)
            ? <img src={customerSig || form.customer_signature} alt="" style={{ height: 72, objectFit: "contain", display: "block", marginBottom: 4 }} />
            : <div style={{ height: 72, borderBottom: "1px solid #9ca3af", marginBottom: 4 }} />
          }
          <div style={{ borderTop: `1px solid ${T.accentColor}`, paddingTop: 3 }}>
            {docType === "waybill" && (
              <>
                <div style={{ fontSize: 10, color: "#334155", fontWeight: 600, marginTop: 2 }}>{form?.receiver_name || form?.customer_name || ""}</div>
                <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>
                  {form?.receiver_date && `Date: ${form.receiver_date}`}
                  {form?.receiver_date && form?.receiver_time && "  ·  "}
                  {form?.receiver_time && `Time: ${form.receiver_time}`}
                </div>
                {!(form?.receiver_date) && (
                  <div style={{ fontSize: 9, color: "#cbd5e1", marginTop: 2 }}>Name: ____________  Date: ____________  Time: ____________</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Layout 1: Classic ───────────────────────────────────────────────────────
function ClassicDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  const isColoredHeader = T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb";

  return (
    <div style={{ background: "#fff", minHeight: 1123 }}>
      <div style={{ background: T.headerBg, borderBottom: `2px solid ${T.accentColor}`, padding: "36px 48px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {form.logo_url ? <img src={form.logo_url} alt="logo" style={{ height: 110, maxWidth: 200, objectFit: "contain", display: "block", marginBottom: 8 }} /> : <div style={{ height: 8 }} />}
          <div style={{ fontWeight: 900, fontSize: 18, color: T.headerColor }}>{form.company_name || "Your Company"}</div>
          {form.company_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.65, marginTop: 3, whiteSpace: "pre-line" }}>{form.company_address}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 3, color: T.docTitleColor }}>{label}</div>
          <div style={{ fontSize: 12, color: T.headerColor, opacity: 0.5, marginTop: 4, fontFamily: "monospace" }}>{form.number || "—"}</div>
          {docType !== "waybill" && (
            <div style={{ marginTop: 12, borderTop: `2px solid ${isColoredHeader ? "rgba(255,255,255,0.35)" : T.accentColor}`, paddingTop: 8 }}>
              <div style={{ fontSize: 9, color: isColoredHeader ? "rgba(255,255,255,0.75)" : "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: isColoredHeader ? "#ffffff" : "#111827", marginTop: 2 }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: T.stripBg, borderBottom: `1px solid ${T.stripBorder}` }}>
        <div style={{ padding: "18px 48px", borderRight: `1px solid ${T.stripBorder}` }}>
          <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>From</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.company_name || "—"}</div>
          {form.company_email && <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>{form.company_email}</div>}
        </div>
        <div style={{ padding: "18px 48px" }}>
          <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>{billToLabel}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
          {form.customer_address && <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
          {form.customer_email && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{form.customer_email}</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 28, padding: "12px 48px", borderBottom: `1px solid ${T.stripBorder}`, fontSize: 11, background: "#fff" }}>
        {form.issue_date && <div><span style={{ color: "#94a3b8" }}>{ISSUE_LABEL[docType] || "Date"}: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.issue_date}</span></div>}
        {form.due_date && DUE_LABEL[docType] && <div><span style={{ color: "#94a3b8" }}>{DUE_LABEL[docType]}: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.due_date}</span></div>}

      </div>
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <PaymentDetailsBlock form={form} sym={sym} T={T} />
      <Sigs managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} />
      <div style={{ padding: "14px 48px", background: T.stripBg, borderTop: `1px solid ${T.stripBorder}`, textAlign: "center", fontSize: 9, color: T.tableHeaderColor }}>
        {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
      </div>
    </div>
  );
}

// ─── Layout 2: Modern ────────────────────────────────────────────────────────
function ModernDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  return (
    <div style={{ background: "#fff", minHeight: 1123 }}>
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
        <div style={{ height: 6, background: T.accentColor, marginTop: 20 }} />
      </div>
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
          {form.issue_date && <div style={{ fontSize: 10, color: "#64748b" }}><span style={{ color: "#94a3b8" }}>{ISSUE_LABEL[docType] || "Date"}: </span>{form.issue_date}</div>}
          {form.due_date && DUE_LABEL[docType] && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}><span style={{ color: "#94a3b8" }}>{DUE_LABEL[docType]}: </span>{form.due_date}</div>}
          {docType !== "waybill" && (
            <div style={{ marginTop: 8, borderTop: `1px solid ${T.stripBorder}`, paddingTop: 6 }}>
              <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase" }}>{amountLabel}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.accentColor }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          )}
        </div>
      </div>
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <PaymentDetailsBlock form={form} sym={sym} T={T} />
      <Sigs managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} />
      <div style={{ height: 6, background: T.accentColor }} />
      <div style={{ padding: "8px 36px", background: T.stripBg, textAlign: "center", fontSize: 9, color: T.tableHeaderColor }}>
        {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
      </div>
    </div>
  );
}

// ─── Layout 3: Minimal ────────────────────────────────────────────────────────
function MinimalDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  return (
    <div style={{ background: "#fff", minHeight: 1123 }}>
      <div style={{ height: 4, background: T.accentColor }} />
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
          {form.issue_date && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{ISSUE_LABEL[docType] || "Date"}: {form.issue_date}</div>}
          {form.due_date && DUE_LABEL[docType] && <div style={{ fontSize: 10, color: "#9ca3af" }}>{DUE_LABEL[docType]}: {form.due_date}</div>}
        </div>
      </div>
      <div style={{ borderTop: "1px solid #f3f4f6", margin: "0 40px" }} />
      <div style={{ padding: "16px 40px", display: "flex", gap: 48 }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.accentColor, textTransform: "uppercase", marginBottom: 5 }}>{billToLabel}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{form.customer_name || "—"}</div>
          {form.customer_address && <div style={{ fontSize: 10, color: "#6b7280", whiteSpace: "pre-line", marginTop: 2 }}>{form.customer_address}</div>}
          {form.customer_email && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{form.customer_email}</div>}
        </div>
        {docType !== "waybill" && (
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.accentColor, textTransform: "uppercase", marginBottom: 5 }}>{amountLabel}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#111827" }}>{sym}{fmt(calcs?.total || 0)}</div>

          </div>
        )}
      </div>
      <div style={{ borderTop: "1px solid #f3f4f6", margin: "0 40px 0" }} />
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <PaymentDetailsBlock form={form} sym={sym} T={T} />
      <Sigs managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} />
      <div style={{ padding: "10px 40px", borderTop: "1px solid #f3f4f6", textAlign: "center", fontSize: 9, color: "#d1d5db", letterSpacing: 1 }}>
        {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
      </div>
    </div>
  );
}

// ─── Layout 4: Bold ──────────────────────────────────────────────────────────
function BoldDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  const isColoredHeader = T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb";
  const rightBg = isColoredHeader ? "#ffffff" : T.stripBg;
  const rightBorder = isColoredHeader ? T.accentColor : T.stripBorder;

  return (
    <div style={{ background: "#fff", minHeight: 1123 }}>
      <div style={{ display: "grid", gridTemplateColumns: "55% 45%" }}>
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
        <div style={{ background: rightBg, borderLeft: `4px solid ${rightBorder}`, padding: "32px 28px", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: T.accentColor, lineHeight: 1, letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8", marginTop: 6 }}>{form.number || "—"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            {form.issue_date && <div style={{ fontSize: 10, color: "#94a3b8" }}>{ISSUE_LABEL[docType] || "Date"}: <span style={{ fontWeight: 600, color: "#374151" }}>{form.issue_date}</span></div>}
            {form.due_date && DUE_LABEL[docType] && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{DUE_LABEL[docType]}: <span style={{ fontWeight: 600, color: "#374151" }}>{form.due_date}</span></div>}
            {docType !== "waybill" && (
              <div style={{ marginTop: 12, borderTop: "2px solid rgba(255,255,255,0.35)", paddingTop: 8, textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginTop: 2 }}>{sym}{fmt(calcs?.total || 0)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <PaymentDetailsBlock form={form} sym={sym} T={T} />
      <Sigs managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} />
      <div style={{ height: 4, background: T.accentColor }} />
      <div style={{ padding: "8px 32px", background: T.stripBg, textAlign: "center", fontSize: 9, color: T.tableHeaderColor }}>
        {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
      </div>
    </div>
  );
}

// ─── Layout 5: Elegant ───────────────────────────────────────────────────────
function ElegantDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  return (
    <div style={{ background: "#fff", minHeight: 1123 }}>
      <div style={{ height: 2, background: T.accentColor }} />
      <div style={{ height: 2, background: T.accentColor, margin: "3px 0 0", opacity: 0.3 }} />
      <div style={{ padding: "28px 40px 20px", textAlign: "center", borderBottom: `1px solid ${T.stripBorder}` }}>
        {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 90, maxWidth: 200, objectFit: "contain", display: "inline-block", marginBottom: 10 }} />}
        <div style={{ fontSize: 22, fontWeight: 700, color: T.headerColor, letterSpacing: 1 }}>{form.company_name || "Your Company"}</div>
        {form.company_address && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{form.company_address.replace(/\n/g, "  ·  ")}</div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "14px auto", maxWidth: 300 }}>
          <div style={{ flex: 1, height: 1, background: T.accentColor, opacity: 0.4 }} />
          <div style={{ width: 6, height: 6, background: T.accentColor, transform: "rotate(45deg)" }} />
          <div style={{ flex: 1, height: 1, background: T.accentColor, opacity: 0.4 }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 6, color: T.docTitleColor, textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", marginTop: 4 }}>{form.number || "—"}</div>
      </div>
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
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.tableHeaderColor, textTransform: "uppercase", marginBottom: 6 }}>Details</div>
          {form.issue_date && <div style={{ fontSize: 10, color: "#6b7280" }}>{ISSUE_LABEL[docType] || "Date"}: {form.issue_date}</div>}
          {form.due_date && DUE_LABEL[docType] && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{DUE_LABEL[docType]}: {form.due_date}</div>}

          {docType !== "waybill" && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.accentColor, marginTop: 2 }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          )}
        </div>
      </div>
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <PaymentDetailsBlock form={form} sym={sym} T={T} />
      <Sigs managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} />
      <div style={{ padding: "12px 40px", textAlign: "center", borderTop: `1px solid ${T.stripBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ flex: 1, height: 1, background: T.accentColor, opacity: 0.3 }} />
          <div style={{ width: 4, height: 4, background: T.accentColor, transform: "rotate(45deg)", opacity: 0.5 }} />
          <div style={{ flex: 1, height: 1, background: T.accentColor, opacity: 0.3 }} />
        </div>
        <div style={{ fontSize: 9, color: "#d1d5db", letterSpacing: 1 }}>
          {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
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
    <div style={{ width: 794, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", fontFamily: T.font }}>
      {layout === "modern"  && <ModernDoc  {...shared} />}
      {layout === "minimal" && <MinimalDoc {...shared} />}
      {layout === "bold"    && <BoldDoc    {...shared} />}
      {layout === "elegant" && <ElegantDoc {...shared} />}
      {(layout === "classic" || !["modern","minimal","bold","elegant"].includes(layout)) && <ClassicDoc {...shared} />}
    </div>
  );
}