import { buildTheme } from "./TemplateSelector";

const TYPE_LABELS = {
  invoice: "INVOICE", quotation: "QUOTATION", receipt: "RECEIPT", waybill: "WAYBILL"
};
const BILL_TO_LABEL = { invoice: "BILL TO", quotation: "PREPARED FOR", receipt: "RECEIVED FROM", waybill: "DELIVER TO" };
const AMOUNT_LABEL = { invoice: "BALANCE DUE", receipt: "AMOUNT RECEIVED", quotation: "ESTIMATED TOTAL", waybill: null };
const ISSUE_LABEL = { invoice: "Invoice Date", quotation: "Issue Date", receipt: "Payment Date", waybill: "Dispatch Date" };
const DUE_LABEL = { invoice: "Due Date", quotation: "Expiry Date", receipt: null, waybill: "Delivery Date" };
const SIG_LABEL = { invoice: "Authorized Signatory", quotation: "Prepared By", receipt: "Received By", waybill: "Dispatcher" };
const SIG2_LABEL = { quotation: "Customer Acceptance", waybill: "Receiver's Signature" };

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
      </div>);

  }
  if (docType === "waybill") {
    const hasExtra = form.driver_name || form.vehicle_number || form.tracking_number;
    if (!hasExtra) return null;
    return (
      <div style={{ padding: "12px 48px", borderBottom: `1px solid ${T.stripBorder}`, background: T.stripBg, display: "flex", gap: 32, flexWrap: "wrap" }}>
        {form.driver_name && <div><span style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 2 }}>Driver</span><span style={{ fontWeight: 700, color: "#1e293b", fontSize: 12 }}>{form.driver_name}</span></div>}
        {form.vehicle_number && <div><span style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 2 }}>Vehicle No.</span><span style={{ fontWeight: 700, color: "#1e293b", fontSize: 12 }}>{form.vehicle_number}</span></div>}
        {form.tracking_number && <div><span style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 2 }}>Tracking No.</span><span style={{ fontWeight: 700, color: "#1e293b", fontSize: 12 }}>{form.tracking_number}</span></div>}
      </div>);

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
        {items.length > 0 ? items.map((item, i) =>
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
        ) :
        <tr><td colSpan={4} style={{ padding: "24px 28px", color: "#cbd5e1", textAlign: "center", fontSize: 11 }}>No items added yet</td></tr>
        }
      </tbody>
    </table>);

}

function TotalsBlock({ calcs, form, sym, T, amountLabel }) {
  if (!calcs) return null;
  const withholdingVatAmt = calcs.withholdingVatAmt || 0;
  const netPayable = calcs.netPayable ?? calcs.total;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "18px 48px 28px" }}>
      <div style={{ width: 300, fontSize: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", color: "#475569", fontWeight: 500 }}><span>Subtotal</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{sym}{fmt(calcs.subtotal)}</span></div>
        {(calcs.taxAmt || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", color: "#475569", fontWeight: 500 }}><span>VAT ({form.tax_rate}%)</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{sym}{fmt(calcs.taxAmt)}</span></div>}
        {(parseFloat(form.shipping) || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", color: "#475569", fontWeight: 500 }}><span>Shipping</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{sym}{fmt(form.shipping)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 8px", borderTop: `2px solid ${T.totalBorder}`, marginTop: 10, fontWeight: 900, fontSize: 18, color: "#0f172a" }}>
          <span style={{ fontSize: 16 }}>{amountLabel}</span><span style={{ color: T.accentColor, fontSize: 20 }}>{sym}{fmt(calcs.total)}</span>
        </div>
        {withholdingVatAmt > 0 &&
        <>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", color: "#dc2626", fontWeight: 500, fontSize: 13 }}>
              <span>Withholding VAT ({form.withholding_vat_rate}%)</span>
              <span style={{ fontWeight: 600 }}>-{sym}{fmt(withholdingVatAmt)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 8px", borderTop: "2px dashed #16a34a", marginTop: 4, fontWeight: 900, fontSize: 16, color: "#15803d" }}>
              <span>Net Payable</span><span style={{ fontSize: 20 }}>{sym}{fmt(netPayable)}</span>
            </div>
          </>
        }
      </div>
    </div>);

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
          {isBankTransfer && form.bank_name &&
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "#94a3b8" }}>Bank</span>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{form.bank_name}</span>
            </div>
          }
          {isBankTransfer && form.account_number &&
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "#94a3b8" }}>Account No.</span>
              <span style={{ fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>{form.account_number}</span>
            </div>
          }
          {isBankTransfer && form.account_holder_name &&
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "#94a3b8" }}>Account Name</span>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{form.account_holder_name}</span>
            </div>
          }
          {form.transaction_id &&
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "#94a3b8" }}>Transaction ID</span>
              <span style={{ fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>{form.transaction_id}</span>
            </div>
          }

        </div>
      </div>
    </div>);

}

function Sigs({ managerSig, customerSig, form, T, docType }) {
  const showCustomer = docType === "waybill" || docType === "quotation";
  const managerLabel = SIG_LABEL[docType] || "Authorized Signatory";
  const customerLabel = SIG2_LABEL[docType] || "Customer Signature";
  return (
    <div style={{ display: "flex", gap: 40, padding: "20px 48px", borderTop: "1px solid #e2e8f0", alignItems: "flex-start" }}>
      <div style={{ minWidth: 160 }}>
        {managerSig || form?.manager_signature ? <img src={managerSig || form.manager_signature} alt="" style={{ height: 72, objectFit: "contain", display: "block", marginBottom: 4 }} /> : <div style={{ height: 72 }} />}
        <div style={{ borderTop: `1px solid ${T.accentColor}`, paddingTop: 3 }}>
          <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1 }}>{managerLabel}</div>
          {form?.manager_name && <div style={{ fontSize: 11, color: "#1e293b", fontWeight: 700, marginTop: 2 }}>{form.manager_name}</div>}
          {form?.manager_title && <div style={{ fontSize: 9, color: "#64748b", marginTop: 1 }}>{form.manager_title}</div>}
          {!form?.manager_name && form?.company_name && <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{form.company_name}</div>}
        </div>
      </div>
      {showCustomer && (docType === "waybill" || customerSig || form?.customer_signature) &&
      <div style={{ minWidth: 180 }}>
          {customerSig || form?.customer_signature ?
        <img src={customerSig || form.customer_signature} alt="" style={{ height: 72, objectFit: "contain", display: "block", marginBottom: 4 }} /> :
        <div style={{ height: 72 }} />
        }
          {docType === "waybill" &&
        <div style={{ borderTop: `1px solid ${T.accentColor}`, paddingTop: 3 }}>
              <div style={{ fontSize: 10, color: "#334155", fontWeight: 600, marginTop: 2 }}>{form?.receiver_name || form?.customer_name || ""}</div>
              <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>
                {form?.receiver_date && `Date: ${form.receiver_date}`}
                {form?.receiver_date && form?.receiver_time && "  ·  "}
                {form?.receiver_time && `Time: ${form.receiver_time}`}
              </div>
              {!form?.receiver_date &&
          <div style={{ fontSize: 9, color: "#cbd5e1", marginTop: 2 }}>Name: ____________  Date: ____________  Time: ____________</div>
          }
            </div>
        }
        </div>
      }
    </div>);

}

function NotesBlock({ form, T }) {
  if (!form?.notes) return null;
  return (
    <div style={{ padding: "12px 48px 16px", borderTop: `1px solid ${T.stripBorder}` }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Note to Customer</div>
      <div style={{ fontSize: 11, color: "#475569", whiteSpace: "pre-line", lineHeight: 1.6 }}>{form.notes}</div>
    </div>);

}

function SigsAndPayment({ managerSig, customerSig, form, T, docType, sym }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 48px", borderTop: "1px solid #e2e8f0", gap: 24 }}>
      <div style={{ flex: 1 }}>
        <Sigs managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} wrapperStyle={{ padding: 0, border: "none" }} />
      </div>
      {form?.payment_method && (docType === "invoice" || docType === "quotation") &&
      <div style={{ flexShrink: 0, width: 220, border: `1px solid ${T.stripBorder}`, borderRadius: 8, overflow: "hidden", background: T.stripBg, alignSelf: "flex-end" }}>
          <div style={{ padding: "7px 12px", background: T.tableHeaderBg, borderBottom: `1px solid ${T.stripBorder}` }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1 }}>Payment Details</span>
          </div>
          <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span style={{ color: "#94a3b8" }}>Method</span>
              <span style={{ fontWeight: 700, color: "#1e293b" }}>{form.payment_method}</span>
            </div>
            {/* Bank Transfer */}
            {form.payment_method === "Bank Transfer" && form.bank_name && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Bank</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.bank_name}</span></div>}
            {form.payment_method === "Bank Transfer" && form.account_number && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Account No.</span><span style={{ fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>{form.account_number}</span></div>}
            {form.payment_method === "Bank Transfer" && form.account_holder_name && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Acct. Name</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.account_holder_name}</span></div>}
            {/* POS */}
            {form.payment_method === "POS" && form.transaction_id && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Transaction ID</span><span style={{ fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>{form.transaction_id}</span></div>}
            {form.payment_method === "POS" && form.reference_number && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Terminal ID</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.reference_number}</span></div>}
            {/* Credit Card */}
            {form.payment_method === "Credit Card" && form.transaction_id && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Transaction ID</span><span style={{ fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>{form.transaction_id}</span></div>}
            {form.payment_method === "Credit Card" && form.reference_number && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Card (last 4)</span><span style={{ fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>•••• {form.reference_number}</span></div>}
            {/* Mobile Money */}
            {form.payment_method === "Mobile Money" && form.account_number && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Phone</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.account_number}</span></div>}
            {form.payment_method === "Mobile Money" && form.transaction_id && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Transaction ID</span><span style={{ fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>{form.transaction_id}</span></div>}
            {form.payment_method === "Mobile Money" && form.account_holder_name && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Acct. Name</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.account_holder_name}</span></div>}
            {/* Cheque */}
            {form.payment_method === "Cheque" && form.reference_number && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Cheque No.</span><span style={{ fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>{form.reference_number}</span></div>}
            {form.payment_method === "Cheque" && form.bank_name && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Bank</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.bank_name}</span></div>}
            {form.payment_method === "Cheque" && form.account_holder_name && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "#94a3b8" }}>Drawer</span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.account_holder_name}</span></div>}
          </div>
        </div>
      }
    </div>);

}

// ─── Layout 1: Classic ───────────────────────────────────────────────────────
function ClassicDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  const isColoredHeader = T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb";

  return (
    <div style={{ background: "#fff", minHeight: 1123, display: "flex", flexDirection: "column" }}>
      <div style={{ background: T.headerBg, borderBottom: `2px solid ${T.accentColor}`, padding: "36px 48px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {form.logo_url ? <img src={form.logo_url} alt="logo" style={{ height: 110, maxWidth: 200, objectFit: "contain", display: "block", marginBottom: 8 }} /> : <div style={{ height: 8 }} />}
          <div style={{ fontWeight: 900, fontSize: 18, color: T.headerColor }}>{form.company_name || "Your Company"}</div>
          {form.company_description && <div style={{ fontSize: 10, marginTop: 4, fontWeight: 800, letterSpacing: 0.8, textAlign: "center", background: "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block", textTransform: "uppercase" }}>{form.company_description}</div>}
          {form.company_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.65, marginTop: 3, whiteSpace: "pre-line" }}>{form.company_address}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 3, color: T.docTitleColor }}>{label}</div>
          <div style={{ fontSize: 12, color: T.headerColor, opacity: 0.5, marginTop: 4, fontFamily: "monospace" }}>{form.number || "—"}</div>
          {docType !== "waybill" &&
          <div style={{ marginTop: 12, borderTop: `2px solid ${isColoredHeader ? "rgba(255,255,255,0.35)" : T.accentColor}`, paddingTop: 8 }}>
              <div style={{ fontSize: 9, color: isColoredHeader ? "rgba(255,255,255,0.75)" : "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: isColoredHeader ? "#ffffff" : "#111827", marginTop: 2 }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          }
        </div>
      </div>
      <div style={{ background: T.stripBg, borderBottom: `1px solid ${T.stripBorder}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 48px" }}>
        <div>
          <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>{billToLabel}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
          {form.customer_company && <div style={{ fontSize: 10, color: "#334155", fontWeight: 600, marginTop: 2 }}>{form.customer_company}</div>}
          {form.customer_address && <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
          {form.customer_email && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{form.customer_email}</div>}
        </div>
        <div style={{ textAlign: "right", fontSize: 11 }}>
          {form.lpo_number && <div style={{ marginBottom: 3 }}><span style={{ color: "#94a3b8" }}>LPO: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.lpo_number}</span></div>}
          {form.issue_date && <div><span style={{ color: "#94a3b8" }}>{ISSUE_LABEL[docType] || "Date"}: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.issue_date}</span></div>}
          {form.due_date && DUE_LABEL[docType] && <div style={{ marginTop: 3 }}><span style={{ color: "#94a3b8" }}>{DUE_LABEL[docType]}: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.due_date}</span></div>}
          {form.tax_number && <div style={{ marginTop: 3 }}><span style={{ color: "#94a3b8" }}>TIN: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.tax_number}</span></div>}
        </div>
      </div>
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <NotesBlock form={form} T={T} />
      <SigsAndPayment managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} sym={sym} />
      <div style={{ padding: "14px 48px", background: T.stripBg, borderTop: `1px solid ${T.stripBorder}`, textAlign: "center", fontSize: 9, color: T.tableHeaderColor, marginTop: "auto" }}>
        {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
      </div>
    </div>);

}

// ─── Layout 2: Modern ────────────────────────────────────────────────────────
function ModernDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  return (
    <div style={{ background: "#fff", minHeight: 1123, display: "flex", flexDirection: "column" }}>
      <div style={{ background: T.headerBg, padding: "0" }}>
        <div style={{ padding: "28px 36px 0", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ flex: 1 }}>
            {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 100, maxWidth: 180, objectFit: "contain", display: "block", marginBottom: 10, filter: T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb" ? "brightness(0) invert(1)" : "none", opacity: 0.9 }} />}
            <div style={{ fontSize: 22, fontWeight: 900, color: T.headerColor, letterSpacing: -0.5 }}>{form.company_name || "Your Company"}</div>
            {form.company_description && <div style={{ fontSize: 10, marginTop: 4, fontWeight: 800, letterSpacing: 0.8, textAlign: "center", background: "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block", textTransform: "uppercase" }}>{form.company_description}</div>}
            {form.company_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.6, marginTop: 4, whiteSpace: "pre-line" }}>{form.company_address}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: T.docTitleColor, lineHeight: 1, letterSpacing: 2 }}>{label}</div>
            <div style={{ fontSize: 13, color: T.headerColor, opacity: 0.5, fontFamily: "monospace", marginTop: 6 }}>{form.number || "—"}</div>
          </div>
        </div>
        <div style={{ height: 6, background: T.accentColor, marginTop: 20 }} />
      </div>
      <div style={{ borderBottom: `1px solid ${T.stripBorder}`, background: T.stripBg, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 20px" }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>{billToLabel}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
          {form.customer_company && <div style={{ fontSize: 10, color: "#334155", fontWeight: 600, marginTop: 2 }}>{form.customer_company}</div>}
          {form.customer_address && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          {form.lpo_number && <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}><span style={{ color: "#94a3b8" }}>LPO: </span>{form.lpo_number}</div>}
          {form.issue_date && <div style={{ fontSize: 10, color: "#64748b" }}><span style={{ color: "#94a3b8" }}>{ISSUE_LABEL[docType] || "Date"}: </span>{form.issue_date}</div>}
          {form.due_date && DUE_LABEL[docType] && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}><span style={{ color: "#94a3b8" }}>{DUE_LABEL[docType]}: </span>{form.due_date}</div>}
          {form.tax_number && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}><span style={{ color: "#94a3b8" }}>TIN: </span>{form.tax_number}</div>}
          {docType !== "waybill" &&
          <div style={{ marginTop: 8, borderTop: `1px solid ${T.stripBorder}`, paddingTop: 6 }}>
              <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase" }}>{amountLabel}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.accentColor }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          }
        </div>
      </div>
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <NotesBlock form={form} T={T} />
      <SigsAndPayment managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} sym={sym} />
      <div style={{ height: 6, background: T.accentColor, marginTop: "auto" }} />
      <div style={{ padding: "8px 36px", background: T.stripBg, textAlign: "center", fontSize: 9, color: T.tableHeaderColor }}>
        {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
      </div>
    </div>);

}

// ─── Layout 3: Minimal ────────────────────────────────────────────────────────
function MinimalDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  return (
    <div style={{ background: "#fff", minHeight: 1123, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 4, background: T.accentColor }} />
      <div style={{ padding: "28px 40px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {form.logo_url ? <img src={form.logo_url} alt="logo" style={{ height: 80, maxWidth: 160, objectFit: "contain", display: "block", marginBottom: 6 }} /> : null}
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{form.company_name || "Your Company"}</div>
          {form.company_description && <div style={{ fontSize: 9, marginTop: 3, fontWeight: 800, letterSpacing: 0.8, background: "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block", textTransform: "uppercase" }}>{form.company_description}</div>}
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
      <div style={{ padding: "16px 40px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.accentColor, textTransform: "uppercase", marginBottom: 5 }}>{billToLabel}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{form.customer_name || "—"}</div>
          {form.customer_company && <div style={{ fontSize: 10, color: "#374151", fontWeight: 600, marginTop: 2 }}>{form.customer_company}</div>}
          {form.customer_address && <div style={{ fontSize: 10, color: "#6b7280", whiteSpace: "pre-line", marginTop: 2 }}>{form.customer_address}</div>}
          {form.customer_email && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{form.customer_email}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          {form.lpo_number && <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>LPO: <span style={{ fontWeight: 600, color: "#374151" }}>{form.lpo_number}</span></div>}
          {form.issue_date && <div style={{ fontSize: 10, color: "#9ca3af" }}>{ISSUE_LABEL[docType] || "Date"}: <span style={{ fontWeight: 600, color: "#374151" }}>{form.issue_date}</span></div>}
          {form.due_date && DUE_LABEL[docType] && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{DUE_LABEL[docType]}: <span style={{ fontWeight: 600, color: "#374151" }}>{form.due_date}</span></div>}
          {form.tax_number && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>TIN: <span style={{ fontWeight: 600, color: "#374151" }}>{form.tax_number}</span></div>}
          {docType !== "waybill" &&
          <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.accentColor, textTransform: "uppercase", marginBottom: 3 }}>{amountLabel}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#111827" }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          }
        </div>
      </div>
      <div style={{ borderTop: "1px solid #f3f4f6", margin: "0 40px 0" }} />
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <NotesBlock form={form} T={T} />
      <SigsAndPayment managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} sym={sym} />
      <div style={{ padding: "10px 40px", borderTop: "1px solid #f3f4f6", textAlign: "center", fontSize: 9, color: "#d1d5db", letterSpacing: 1, marginTop: "auto" }}>
        {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
      </div>
    </div>);

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
    <div style={{ background: "#fff", minHeight: 1123, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "grid", gridTemplateColumns: "55% 45%" }}>
        <div style={{ background: T.headerBg, padding: "32px 32px", minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 90, maxWidth: 160, objectFit: "contain", display: "block", marginBottom: 10, filter: isColoredHeader ? "brightness(0) invert(1)" : "none", opacity: 0.9 }} />}
            <div style={{ fontSize: 20, fontWeight: 900, color: T.headerColor }}>{form.company_name || "Your Company"}</div>
            {form.company_description && <div style={{ fontSize: 9, marginTop: 3, fontWeight: 800, letterSpacing: 0.8, background: "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block", textTransform: "uppercase" }}>{form.company_description}</div>}
            {form.company_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.6, marginTop: 4, whiteSpace: "pre-line" }}>{form.company_address}</div>}
            {form.company_email && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.5, marginTop: 2 }}>{form.company_email}</div>}
          </div>
          <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 8, fontWeight: 700, color: T.headerColor, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{billToLabel}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.headerColor }}>{form.customer_name || "—"}</div>
              {form.customer_company && <div style={{ fontSize: 10, color: T.headerColor, fontWeight: 600, opacity: 0.85, marginTop: 2 }}>{form.customer_company}</div>}
              {form.customer_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.65, whiteSpace: "pre-line", marginTop: 2 }}>{form.customer_address}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              {form.lpo_number && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.65, marginBottom: 2 }}>LPO: <span style={{ fontWeight: 600 }}>{form.lpo_number}</span></div>}
              {form.issue_date && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.65 }}>{ISSUE_LABEL[docType] || "Date"}: <span style={{ fontWeight: 600 }}>{form.issue_date}</span></div>}
              {form.due_date && DUE_LABEL[docType] && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.65, marginTop: 2 }}>{DUE_LABEL[docType]}: <span style={{ fontWeight: 600 }}>{form.due_date}</span></div>}
              {form.tax_number && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.65, marginTop: 2 }}>TIN: <span style={{ fontWeight: 600 }}>{form.tax_number}</span></div>}
            </div>
          </div>
        </div>
        <div style={{ background: rightBg, borderLeft: `4px solid ${rightBorder}`, padding: "32px 28px", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: T.accentColor, lineHeight: 1, letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8", marginTop: 6 }}>{form.number || "—"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            {docType !== "waybill" &&
            <div style={{ marginTop: 12, borderTop: "2px solid rgba(255,255,255,0.35)", paddingTop: 8, textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginTop: 2 }}>{sym}{fmt(calcs?.total || 0)}</div>
              </div>
            }
          </div>
        </div>
      </div>
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <NotesBlock form={form} T={T} />
      <SigsAndPayment managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} sym={sym} />
      <div style={{ height: 4, background: T.accentColor, marginTop: "auto" }} />
      <div style={{ padding: "8px 32px", background: T.stripBg, textAlign: "center", fontSize: 9, color: T.tableHeaderColor }}>
        {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
      </div>
    </div>);

}

// ─── Layout 5: Elegant ───────────────────────────────────────────────────────
function ElegantDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  return (
    <div style={{ background: "#fff", minHeight: 1123, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 2, background: T.accentColor }} />
      <div style={{ height: 2, background: T.accentColor, margin: "3px 0 0", opacity: 0.3 }} />
      <div style={{ padding: "28px 40px 20px", textAlign: "center", borderBottom: `1px solid ${T.stripBorder}` }}>
        {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 90, maxWidth: 200, objectFit: "contain", display: "inline-block", marginBottom: 10 }} />}
        <div style={{ fontSize: 22, fontWeight: 700, color: T.headerColor, letterSpacing: 1 }}>{form.company_name || "Your Company"}</div>
        {form.company_description && <div style={{ fontSize: 9, marginTop: 3, fontWeight: 800, letterSpacing: 0.8, background: "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block", textTransform: "uppercase" }}>{form.company_description}</div>}
        {form.company_address && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{form.company_address.replace(/\n/g, "  ·  ")}</div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "14px auto", maxWidth: 300 }}>
          <div style={{ flex: 1, height: 1, background: T.accentColor, opacity: 0.4 }} />
          <div style={{ width: 6, height: 6, background: T.accentColor, transform: "rotate(45deg)" }} />
          <div style={{ flex: 1, height: 1, background: T.accentColor, opacity: 0.4 }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 6, color: T.docTitleColor, textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", marginTop: 4 }}>{form.number || "—"}</div>
      </div>
      <div style={{ background: T.stripBg, borderBottom: `1px solid ${T.stripBorder}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 24px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.tableHeaderColor, textTransform: "uppercase", marginBottom: 6 }}>{billToLabel}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
          {form.customer_company && <div style={{ fontSize: 10, color: "#334155", fontWeight: 600, marginTop: 2 }}>{form.customer_company}</div>}
          {form.customer_address && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 3, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          {form.lpo_number && <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>LPO: <span style={{ fontWeight: 600 }}>{form.lpo_number}</span></div>}
          {form.issue_date && <div style={{ fontSize: 10, color: "#6b7280" }}>{ISSUE_LABEL[docType] || "Date"}: <span style={{ fontWeight: 600 }}>{form.issue_date}</span></div>}
          {form.due_date && DUE_LABEL[docType] && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{DUE_LABEL[docType]}: <span style={{ fontWeight: 600 }}>{form.due_date}</span></div>}
          {form.tax_number && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>TIN: <span style={{ fontWeight: 600 }}>{form.tax_number}</span></div>}
          {docType !== "waybill" &&
          <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.accentColor, marginTop: 2 }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          }
        </div>
      </div>
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <NotesBlock form={form} T={T} />
      <SigsAndPayment managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} sym={sym} />
      <div style={{ padding: "12px 40px", textAlign: "center", borderTop: `1px solid ${T.stripBorder}`, marginTop: "auto" }}>
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
    </div>);

}

// ─── Layout 6: Sidebar ───────────────────────────────────────────────────────
function SidebarDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  const isColoredHeader = T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb";
  return (
    <div style={{ background: "#fff", minHeight: 1123, display: "flex", flexDirection: "row" }}>
      {/* Left accent sidebar */}
      <div style={{ width: 220, background: T.headerBg, display: "flex", flexDirection: "column", padding: "36px 24px", flexShrink: 0 }}>
        {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 80, maxWidth: 170, objectFit: "contain", display: "block", marginBottom: 16, filter: isColoredHeader ? "brightness(0) invert(1)" : "none" }} />}
        <div style={{ fontSize: 15, fontWeight: 900, color: T.headerColor, lineHeight: 1.2 }}>{form.company_name || "Your Company"}</div>
        {form.company_description && <div style={{ fontSize: 9, marginTop: 3, fontWeight: 800, letterSpacing: 0.8, background: "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block", textTransform: "uppercase" }}>{form.company_description}</div>}
        {form.company_address && <div style={{ fontSize: 9, color: T.headerColor, opacity: 0.55, marginTop: 6, whiteSpace: "pre-line", lineHeight: 1.5 }}>{form.company_address}</div>}
        {form.company_phone && <div style={{ fontSize: 9, color: T.headerColor, opacity: 0.55, marginTop: 4 }}>☎ {form.company_phone}</div>}
        {form.company_email && <div style={{ fontSize: 9, color: T.headerColor, opacity: 0.55, marginTop: 2 }}>✉ {form.company_email}</div>}
        {form.company_website && <div style={{ fontSize: 9, color: T.headerColor, opacity: 0.55, marginTop: 2 }}>🌐 {form.company_website}</div>}
        <div style={{ height: 1, background: isColoredHeader ? "rgba(255,255,255,0.2)" : T.accentColor, margin: "18px 0", opacity: 0.5 }} />
        <div style={{ fontSize: 8, fontWeight: 700, color: T.headerColor, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{billToLabel}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.headerColor }}>{form.customer_name || "—"}</div>
        {form.customer_company && <div style={{ fontSize: 9, color: T.headerColor, fontWeight: 600, opacity: 0.8, marginTop: 3 }}>{form.customer_company}</div>}
        {form.customer_address && <div style={{ fontSize: 9, color: T.headerColor, opacity: 0.55, marginTop: 4, whiteSpace: "pre-line", lineHeight: 1.5 }}>{form.customer_address}</div>}
        {form.customer_email && <div style={{ fontSize: 9, color: T.headerColor, opacity: 0.5, marginTop: 4 }}>{form.customer_email}</div>}
        <div style={{ height: 1, background: isColoredHeader ? "rgba(255,255,255,0.2)" : T.accentColor, margin: "18px 0", opacity: 0.5 }} />
        <div style={{ fontSize: 9, color: T.headerColor, opacity: 0.6, lineHeight: 1.7 }}>
          {form.issue_date && <div><span style={{ opacity: 0.7 }}>{ISSUE_LABEL[docType] || "Date"}:</span><br /><strong>{form.issue_date}</strong></div>}
          {form.due_date && DUE_LABEL[docType] && <div style={{ marginTop: 6 }}><span style={{ opacity: 0.7 }}>{DUE_LABEL[docType]}:</span><br /><strong>{form.due_date}</strong></div>}
          {form.lpo_number && <div style={{ marginTop: 6 }}><span style={{ opacity: 0.7 }}>LPO:</span><br /><strong>{form.lpo_number}</strong></div>}
          {form.tax_number && <div style={{ marginTop: 6 }}><span style={{ opacity: 0.7 }}>TIN:</span><br /><strong>{form.tax_number}</strong></div>}
        </div>
        {docType !== "waybill" && (
          <div style={{ marginTop: "auto", background: isColoredHeader ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 8, color: T.headerColor, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: isColoredHeader ? "#fff" : T.accentColor, marginTop: 4 }}>{sym}{fmt(calcs?.total || 0)}</div>
          </div>
        )}
      </div>
      {/* Right content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "36px 36px 20px", borderBottom: `3px solid ${T.accentColor}` }}>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 4, color: T.accentColor }}>{label}</div>
          <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8", marginTop: 4 }}>{form.number || "—"}</div>
        </div>
        <ItemsTable items={items} docType={docType} T={T} />
        <ExtraFields form={form} docType={docType} T={T} />
        {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
        <NotesBlock form={form} T={T} />
        <SigsAndPayment managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} sym={sym} />
        <div style={{ marginTop: "auto", padding: "10px 36px", borderTop: `1px solid ${T.stripBorder}`, background: T.stripBg, fontSize: 9, color: T.tableHeaderColor, textAlign: "center" }}>
          {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
        </div>
      </div>
    </div>
  );
}

// ─── Layout 7: Executive ─────────────────────────────────────────────────────
function ExecutiveDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  const isColoredHeader = T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb";
  return (
    <div style={{ background: "#fff", minHeight: 1123, display: "flex", flexDirection: "column" }}>
      {/* Top banner with diagonal accent */}
      <div style={{ background: T.headerBg, padding: "32px 48px 28px", position: "relative", overflow: "hidden" }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", right: -40, top: -40, width: 180, height: 180, borderRadius: "50%", background: T.accentColor, opacity: 0.12 }} />
        <div style={{ position: "absolute", right: 60, bottom: -60, width: 130, height: 130, borderRadius: "50%", background: T.accentColor, opacity: 0.08 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
          <div>
            {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 80, maxWidth: 160, objectFit: "contain", display: "block", marginBottom: 10, filter: isColoredHeader ? "brightness(0) invert(1)" : "none" }} />}
            <div style={{ fontSize: 20, fontWeight: 900, color: T.headerColor }}>{form.company_name || "Your Company"}</div>
            {form.company_description && <div style={{ fontSize: 9, marginTop: 3, fontWeight: 800, letterSpacing: 0.8, background: "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block", textTransform: "uppercase" }}>{form.company_description}</div>}
            {form.company_address && <div style={{ fontSize: 9, color: T.headerColor, opacity: 0.6, marginTop: 4, whiteSpace: "pre-line" }}>{form.company_address}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ background: T.accentColor, color: "#fff", fontSize: 20, fontWeight: 900, letterSpacing: 4, padding: "10px 20px", borderRadius: 6, display: "inline-block" }}>{label}</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: T.headerColor, opacity: 0.5, marginTop: 8 }}>{form.number || "—"}</div>
            {docType !== "waybill" && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 8, color: T.headerColor, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: isColoredHeader ? "#fff" : T.accentColor, marginTop: 2 }}>{sym}{fmt(calcs?.total || 0)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ height: 4, background: T.accentColor }} />
      {/* Client + dates bar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, borderBottom: `1px solid ${T.stripBorder}`, background: T.stripBg }}>
        <div style={{ padding: "16px 24px", borderRight: `1px solid ${T.stripBorder}` }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>{billToLabel}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
          {form.customer_company && <div style={{ fontSize: 10, color: "#334155", fontWeight: 600, marginTop: 2 }}>{form.customer_company}</div>}
          {form.customer_address && <div style={{ fontSize: 9, color: "#64748b", marginTop: 3, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
        </div>
        <div style={{ padding: "16px 24px", borderRight: `1px solid ${T.stripBorder}` }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Document Info</div>
          {form.issue_date && <div style={{ fontSize: 10, color: "#64748b" }}><span style={{ color: "#94a3b8" }}>{ISSUE_LABEL[docType] || "Date"}: </span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.issue_date}</span></div>}
          {form.due_date && DUE_LABEL[docType] && <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}><span style={{ color: "#94a3b8" }}>{DUE_LABEL[docType]}: </span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.due_date}</span></div>}
          {form.lpo_number && <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}><span style={{ color: "#94a3b8" }}>LPO: </span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.lpo_number}</span></div>}
        </div>
        <div style={{ padding: "16px 24px" }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>From</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#1e293b" }}>{form.company_name || "Your Company"}</div>
          {form.company_email && <div style={{ fontSize: 9, color: "#64748b", marginTop: 3 }}>{form.company_email}</div>}
          {form.company_phone && <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{form.company_phone}</div>}
          {form.tax_number && <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>TIN: {form.tax_number}</div>}
        </div>
      </div>
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <NotesBlock form={form} T={T} />
      <SigsAndPayment managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} sym={sym} />
      <div style={{ padding: "14px 48px", background: T.stripBg, borderTop: `1px solid ${T.stripBorder}`, textAlign: "center", fontSize: 9, color: T.tableHeaderColor, marginTop: "auto" }}>
        {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
      </div>
    </div>
  );
}

// ─── Layout 8: Wave ──────────────────────────────────────────────────────────
function WaveDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  const isColoredHeader = T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb";
  return (
    <div style={{ background: "#fff", minHeight: 1123, display: "flex", flexDirection: "column" }}>
      {/* Wave header */}
      <div style={{ position: "relative", background: T.headerBg, paddingBottom: 40 }}>
        <div style={{ padding: "30px 48px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 75, maxWidth: 160, objectFit: "contain", display: "block", marginBottom: 8, filter: isColoredHeader ? "brightness(0) invert(1)" : "none" }} />}
            <div style={{ fontSize: 18, fontWeight: 900, color: T.headerColor }}>{form.company_name || "Your Company"}</div>
            {form.company_description && <div style={{ fontSize: 9, marginTop: 3, fontWeight: 800, letterSpacing: 0.8, background: "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block", textTransform: "uppercase" }}>{form.company_description}</div>}
            {form.company_address && <div style={{ fontSize: 9, color: T.headerColor, opacity: 0.55, marginTop: 3, whiteSpace: "pre-line" }}>{form.company_address}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: T.docTitleColor, letterSpacing: 2, lineHeight: 1 }}>{label}</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: T.headerColor, opacity: 0.4, marginTop: 6 }}>{form.number || "—"}</div>
            {docType !== "waybill" && <div style={{ marginTop: 8 }}><div style={{ fontSize: 8, color: T.headerColor, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div><div style={{ fontSize: 20, fontWeight: 900, color: isColoredHeader ? "#fff" : T.accentColor, marginTop: 2 }}>{sym}{fmt(calcs?.total || 0)}</div></div>}
          </div>
        </div>
        {/* SVG wave */}
        <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", display: "block" }} viewBox="0 0 794 48" preserveAspectRatio="none" height="48">
          <path d="M0,24 C120,48 240,0 397,24 C554,48 674,8 794,24 L794,48 L0,48 Z" fill="#ffffff" />
        </svg>
      </div>
      {/* Client info bar */}
      <div style={{ padding: "12px 48px 16px", background: "#fff", borderBottom: `1px solid ${T.stripBorder}`, display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.accentColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>{billToLabel}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
          {form.customer_company && <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>{form.customer_company}</div>}
          {form.customer_address && <div style={{ fontSize: 9, color: "#64748b", marginTop: 3, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
        </div>
        <div style={{ textAlign: "right", fontSize: 10 }}>
          {form.issue_date && <div><span style={{ color: "#94a3b8" }}>{ISSUE_LABEL[docType] || "Date"}: </span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.issue_date}</span></div>}
          {form.due_date && DUE_LABEL[docType] && <div style={{ marginTop: 3 }}><span style={{ color: "#94a3b8" }}>{DUE_LABEL[docType]}: </span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.due_date}</span></div>}
          {form.lpo_number && <div style={{ marginTop: 3 }}><span style={{ color: "#94a3b8" }}>LPO: </span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.lpo_number}</span></div>}
          {form.tax_number && <div style={{ marginTop: 3 }}><span style={{ color: "#94a3b8" }}>TIN: </span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.tax_number}</span></div>}
        </div>
      </div>
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <NotesBlock form={form} T={T} />
      <SigsAndPayment managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} sym={sym} />
      {/* Wave footer */}
      <div style={{ marginTop: "auto", position: "relative" }}>
        <svg style={{ display: "block", width: "100%" }} viewBox="0 0 794 32" preserveAspectRatio="none" height="32">
          <path d="M0,16 C120,0 240,32 397,16 C554,0 674,24 794,16 L794,32 L0,32 Z" fill={T.accentColor} />
        </svg>
        <div style={{ background: T.accentColor, padding: "6px 48px 12px", textAlign: "center", fontSize: 9, color: isColoredHeader ? "rgba(255,255,255,0.7)" : "#fff" }}>
          {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
        </div>
      </div>
    </div>
  );
}

// ─── Layout 9: Compact ───────────────────────────────────────────────────────
function CompactDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const label = TYPE_LABELS[docType] || "INVOICE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  return (
    <div style={{ background: "#fff", minHeight: 1123, display: "flex", flexDirection: "column" }}>
      {/* Compact header: logo left, title+number+amount right, sharp border bottom */}
      <div style={{ padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `3px solid ${T.accentColor}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 60, maxWidth: 120, objectFit: "contain" }} />}
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{form.company_name || "Your Company"}</div>
            {form.company_description && <div style={{ fontSize: 8, marginTop: 2, fontWeight: 800, letterSpacing: 0.8, background: "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block", textTransform: "uppercase" }}>{form.company_description}</div>}
            {form.company_address && <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 2, whiteSpace: "pre-line" }}>{form.company_address}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 3, color: T.accentColor }}>{label}</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8", marginTop: 2 }}>{form.number || "—"}</div>
          {docType !== "waybill" && <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{sym}{fmt(calcs?.total || 0)}</div>}
        </div>
      </div>
      {/* Three-column info bar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: T.stripBg, borderBottom: `1px solid ${T.stripBorder}` }}>
        <div style={{ padding: "12px 20px", borderRight: `1px solid ${T.stripBorder}` }}>
          <div style={{ fontSize: 7, fontWeight: 800, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>{billToLabel}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
          {form.customer_company && <div style={{ fontSize: 9, color: "#334155", marginTop: 2 }}>{form.customer_company}</div>}
          {form.customer_address && <div style={{ fontSize: 9, color: "#64748b", marginTop: 2, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
        </div>
        <div style={{ padding: "12px 20px", borderRight: `1px solid ${T.stripBorder}` }}>
          <div style={{ fontSize: 7, fontWeight: 800, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>Dates</div>
          {form.issue_date && <div style={{ fontSize: 9, color: "#64748b" }}><span style={{ color: "#94a3b8" }}>{ISSUE_LABEL[docType] || "Date"}: </span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.issue_date}</span></div>}
          {form.due_date && DUE_LABEL[docType] && <div style={{ fontSize: 9, color: "#64748b", marginTop: 3 }}><span style={{ color: "#94a3b8" }}>{DUE_LABEL[docType]}: </span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.due_date}</span></div>}
        </div>
        <div style={{ padding: "12px 20px" }}>
          <div style={{ fontSize: 7, fontWeight: 800, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>References</div>
          {form.lpo_number && <div style={{ fontSize: 9, color: "#64748b" }}><span style={{ color: "#94a3b8" }}>LPO: </span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.lpo_number}</span></div>}
          {form.tax_number && <div style={{ fontSize: 9, color: "#64748b", marginTop: 3 }}><span style={{ color: "#94a3b8" }}>TIN: </span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.tax_number}</span></div>}
          {form.company_phone && <div style={{ fontSize: 9, color: "#64748b", marginTop: 3 }}><span style={{ color: "#94a3b8" }}>Tel: </span><span style={{ fontWeight: 600, color: "#1e293b" }}>{form.company_phone}</span></div>}
        </div>
      </div>
      <ItemsTable items={items} docType={docType} T={T} />
      <ExtraFields form={form} docType={docType} T={T} />
      {docType !== "waybill" && <TotalsBlock calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />}
      <NotesBlock form={form} T={T} />
      <SigsAndPayment managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} sym={sym} />
      <div style={{ padding: "10px 40px", background: T.stripBg, borderTop: `1px solid ${T.stripBorder}`, textAlign: "center", fontSize: 9, color: T.tableHeaderColor, marginTop: "auto" }}>
        {[form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ")}
      </div>
    </div>
  );
}

const CORNER_RADIUS_MAP = { none: 0, sm: 4, lg: 8, full: 16 };
const SHADOW_MAP = {
  none: "none",
  sm: "0 1px 4px rgba(0,0,0,0.08)",
  md: "0 4px 16px rgba(0,0,0,0.14)",
  lg: "0 8px 32px rgba(0,0,0,0.22)"
};

// ─── Layout 10: Sikky ────────────────────────────────────────────────────────
function SikkyDoc({ form, items, calcs, sym, docType, managerSig, customerSig, T }) {
  const accent = T.accentColor || "#d97706";
  const sidebarBg = "#fde8d0";

  const fmtDateShort = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  // Superscript ordinal date: "19TH June 2026."
  const fmtDateLong = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    const day = dt.getDate();
    const suffix = [,"st","nd","rd"][day % 10 > 3 || Math.floor(day / 10) === 1 ? 0 : day % 10] || "th";
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return { day, suffix, month: months[dt.getMonth()], year: dt.getFullYear() };
  };

  // Number to words (simplified, good up to millions)
  const numToWords = (n) => {
    const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
    const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
    const toWords = (num) => {
      if (num === 0) return "";
      if (num < 20) return ones[num];
      if (num < 100) return tens[Math.floor(num/10)] + (num % 10 ? " " + ones[num % 10] : "");
      if (num < 1000) return ones[Math.floor(num/100)] + " Hundred" + (num % 100 ? " " + toWords(num % 100) : "");
      if (num < 1000000) return toWords(Math.floor(num/1000)) + " Thousand" + (num % 1000 ? " " + toWords(num % 1000) : "");
      return toWords(Math.floor(num/1000000)) + " Million" + (num % 1000000 ? " " + toWords(num % 1000000) : "");
    };
    const int = Math.floor(Math.abs(n));
    const dec = Math.round((Math.abs(n) - int) * 100);
    let result = toWords(int) || "Zero";
    if (dec > 0) result += " and " + toWords(dec) + " Kobo";
    return result + " Only";
  };

  // ── Shared header (same for all doc types) ──
  const Header = () => (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "12px 32px 12px 24px" }}>
        <div style={{ flex: 1 }}>
          {form.logo_url
            ? <img src={form.logo_url} alt="logo" style={{ maxHeight: 160, maxWidth: 560, width: "100%", objectFit: "contain", objectPosition: "top left", display: "block" }} />
            : <div style={{ fontSize: 32, fontWeight: 900, color: accent, fontFamily: "serif" }}>{form.company_name || "Company"}</div>
          }
        </div>
        <div style={{ textAlign: "left", maxWidth: 280, flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, borderLeft: `2px solid ${accent}`, paddingLeft: 6 }}>OFFICE:</div>
          {form.company_address && <div style={{ fontSize: 10, color: "#1a1a1a", lineHeight: 1.4 }}>{form.company_address.trim().replace(/\n+/g, ", ")}</div>}
          {form.company_phone && <div style={{ fontSize: 10, color: "#1a1a1a", marginTop: 2 }}>Tel: {form.company_phone}</div>}
          {form.company_email && <div style={{ fontSize: 10, color: "#2563eb", marginTop: 2 }}>Email: <span style={{ textDecoration: "underline" }}>{form.company_email}</span></div>}
          {form.company_website && <div style={{ fontSize: 10, color: "#2563eb", marginTop: 2 }}>{form.company_website}</div>}
        </div>
      </div>
      {/* Company description bar */}
      {form.company_description && (
        <div style={{ padding: "5px 40px 5px 24px", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, display: "inline-block", textTransform: "uppercase", background: "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{form.company_description}</div>
        </div>
      )}
      {/* Tagline bar */}
      {form.document_tagline && (
        <div style={{ padding: "5px 40px 5px 24px", borderTop: form.company_description ? "none" : "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 10, color: accent, fontWeight: 600, textAlign: "center", fontStyle: "italic" }}>{form.document_tagline}</div>
        </div>
      )}
    </>
  );

  // ── Shared signature footer ──
  const SigRow = () => {
    const showCustomer = docType === "waybill" || docType === "quotation" || docType === "invoice";
    return (
      <div style={{ padding: "28px 40px 32px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 180 }}>
          {(managerSig || form?.manager_signature)
            ? <img src={managerSig || form.manager_signature} alt="" style={{ height: 55, objectFit: "contain", display: "block", marginBottom: 6 }} />
            : <div style={{ height: 40 }} />
          }
          <div style={{ borderBottom: "1px dotted #555", width: 200, marginBottom: 5 }} />
          <div style={{ fontSize: 12, color: "#111" }}>{SIG_LABEL[docType] || "Manager's Signature"}</div>
          {form?.manager_name && <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{form.manager_name}</div>}
        </div>
        {showCustomer && (
          <div style={{ minWidth: 180 }}>
            {(customerSig || form?.customer_signature)
              ? <img src={customerSig || form.customer_signature} alt="" style={{ height: 55, objectFit: "contain", display: "block", marginBottom: 6 }} />
              : <div style={{ height: 40 }} />
            }
            <div style={{ borderBottom: "1px dotted #555", width: 200, marginBottom: 5 }} />
            <div style={{ fontSize: 12, color: "#111" }}>{SIG2_LABEL[docType] || "Customer's Signature"}</div>
            {docType === "waybill" && form?.receiver_name && <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{form.receiver_name}</div>}
            {docType === "waybill" && !form?.receiver_date && <div style={{ fontSize: 9, color: "#bbb", marginTop: 2 }}>Name: ____________  Date: ____________</div>}
            {docType === "waybill" && form?.receiver_date && <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>Date: {form.receiver_date}{form.receiver_time ? `  ·  ${form.receiver_time}` : ""}</div>}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════
  // WAYBILL — S/N, QTY, DESCRIPTION only, no prices
  // ══════════════════════════════════════════════
  if (docType === "waybill") {
    return (
      <div style={{ background: "#fff", minHeight: 1123, display: "flex", flexDirection: "row", fontFamily: "'Times New Roman', Times, serif", fontSize: 13 }}>
        <div style={{ width: 100, background: sidebarBg, flexShrink: 0, alignSelf: "stretch" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Header />
          <div style={{ padding: "20px 40px 16px 24px" }}>
            {/* To: + meta */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 20 }}>
              <div style={{ fontSize: 13, color: "#111", lineHeight: 1.8 }}>
                {form.customer_name && <div>To:&nbsp;&nbsp;{form.customer_name}</div>}
                {form.customer_company && <div style={{ paddingLeft: 32 }}>{form.customer_company}</div>}
                {form.customer_address && form.customer_address.split("\n").map((l, i) => <div key={i} style={{ paddingLeft: 32 }}>{l}</div>)}
              </div>
              <div style={{ fontSize: 13, color: "#111", lineHeight: 1.8, minWidth: 190, flexShrink: 0 }}>
                {form.number && <div style={{ fontWeight: 700 }}>{form.number}</div>}
                {form.lpo_number && <div>L.P.O:{form.lpo_number}</div>}
                {form.issue_date && <div>Date:&nbsp;&nbsp;{fmtDateShort(form.issue_date)}</div>}
                {form.tax_number && <div>TIN NO: {form.tax_number}</div>}
              </div>
            </div>
            {/* Title */}
            <div style={{ textAlign: "center", fontWeight: 700, fontSize: 15, marginBottom: 16, letterSpacing: 2 }}>WAYBILL</div>
            {/* Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700 }}>S/N</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700 }}>QTY</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700 }}>DESCRIPTION</th>
                </tr>
                <tr><td colSpan={3} style={{ borderBottom: "1px solid #111", padding: 0 }} /></tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: "8px 8px 4px", verticalAlign: "top" }}>{i + 1}.</td>
                    <td style={{ padding: "8px 8px 4px", verticalAlign: "top" }}>{String(parseFloat(item.quantity) || 0).padStart(2,"0")}</td>
                    <td style={{ padding: "8px 8px 4px", verticalAlign: "top" }}>{item.description || "—"}</td>
                  </tr>
                )) : <tr><td colSpan={3} style={{ padding: "20px 8px", textAlign: "center", color: "#9ca3af" }}>No items</td></tr>}
              </tbody>
            </table>
            {/* Logistics info */}
            {(form.driver_name || form.vehicle_number || form.tracking_number) && (
              <div style={{ marginTop: 16, fontSize: 12, color: "#111", lineHeight: 2 }}>
                {form.driver_name && <div><strong>Driver:</strong> {form.driver_name}</div>}
                {form.vehicle_number && <div><strong>Vehicle No:</strong> {form.vehicle_number}</div>}
                {form.tracking_number && <div><strong>Tracking No:</strong> {form.tracking_number}</div>}
              </div>
            )}
            {/* Notes */}
            {form.notes && <div style={{ marginTop: 12, fontSize: 12, color: "#444", lineHeight: 1.8 }}><strong>Note:</strong> {form.notes}</div>}
          </div>
          <div style={{ flex: 1 }} />
          <SigRow />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // QUOTATION — letter style with date, Dear Sir, subject line, prices, terms
  // ══════════════════════════════════════════════
  if (docType === "quotation") {
    const dateObj = fmtDateLong(form.issue_date);
    return (
      <div style={{ background: "#fff", minHeight: 1123, display: "flex", flexDirection: "row", fontFamily: "'Times New Roman', Times, serif", fontSize: 13 }}>
        <div style={{ width: 100, background: sidebarBg, flexShrink: 0, alignSelf: "stretch" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Header />
          <div style={{ padding: "20px 40px 16px 24px" }}>
            {/* Date superscript */}
            {dateObj && (
              <div style={{ fontSize: 13, color: "#111", marginBottom: 14 }}>
                {dateObj.day}<sup style={{ fontSize: 9 }}>{dateObj.suffix}</sup> {dateObj.month} {dateObj.year}.
              </div>
            )}
            {/* Addressee */}
            <div style={{ fontSize: 13, color: "#111", lineHeight: 1.8, marginBottom: 18 }}>
              {form.customer_name && <div>{form.customer_name}</div>}
              {form.customer_company && <div>{form.customer_company}</div>}
              {form.customer_address && form.customer_address.split("\n").map((l, i) => <div key={i}>{l}</div>)}
            </div>
            {/* Dear Sir */}
            <div style={{ fontSize: 13, marginBottom: 14 }}>Dear Sir,</div>
            {/* Subject */}
            <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13, textDecoration: "underline", marginBottom: 16, textTransform: "uppercase" }}>
              QUOTATION{form.lpo_number ? ` FOR ${form.lpo_number}` : ""}
            </div>
            {/* Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700 }}>S/N</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700 }}>QTY</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700 }}>DESCRIPTION</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 700 }}>UNIT PRICE</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 700 }}>AMOUNT</th>
                </tr>
                <tr><td colSpan={5} style={{ borderBottom: "1px solid #111", padding: 0 }} /></tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: "8px 8px 4px", verticalAlign: "top" }}>{i + 1}.</td>
                    <td style={{ padding: "8px 8px 4px", verticalAlign: "top" }}>{String(parseFloat(item.quantity) || 0).padStart(2,"0")}</td>
                    <td style={{ padding: "8px 8px 4px", verticalAlign: "top" }}>{item.description || "—"}</td>
                    <td style={{ padding: "8px 8px 4px", verticalAlign: "top", textAlign: "right" }}>{sym}{fmt(item.unit_price)}</td>
                    <td style={{ padding: "8px 8px 4px", verticalAlign: "top", textAlign: "right", fontWeight: 700 }}>{sym}{fmt(item.amount)}</td>
                  </tr>
                )) : <tr><td colSpan={5} style={{ padding: "20px 8px", textAlign: "center", color: "#9ca3af" }}>No items</td></tr>}
              </tbody>
            </table>
            {/* Quotation totals */}
            {calcs && (
              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: 300, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: "1px solid #ddd" }}><span>Subtotal</span><span>{sym}{fmt(calcs.subtotal)}</span></div>
                  {(calcs.globalDiscAmt || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Discount</span><span>-{sym}{fmt(calcs.globalDiscAmt)}</span></div>}
                  {(calcs.taxAmt || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>VAT ({form.tax_rate}%)</span><span>{sym}{fmt(calcs.taxAmt)}</span></div>}
                  {(parseFloat(form.shipping) || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Shipping</span><span>{sym}{fmt(form.shipping)}</span></div>}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", borderTop: "1px solid #111", fontWeight: 700, fontSize: 14 }}>
                    <span>ESTIMATED TOTAL</span><span>{sym}{fmt(calcs.total)}</span>
                  </div>
                </div>
              </div>
            )}
            {/* Terms block */}
            {form.terms && (
              <div style={{ marginTop: 20, fontSize: 13, color: "#111", lineHeight: 2 }}>
                <div>DELIVERY TIME: {form.terms}</div>
                {form.payment_method && form.payment_instructions && <div style={{ whiteSpace: "pre-line" }}>{form.payment_instructions}</div>}
              </div>
            )}
            {/* Notes */}
            {form.notes && (
              <div style={{ marginTop: 12, fontSize: 12, color: "#444", lineHeight: 1.8 }}>
                <strong>Note:</strong> {form.notes}
              </div>
            )}
            {/* Payment details */}
            {form.payment_method === "Bank Transfer" && form.bank_name && (
              <div style={{ marginTop: 16, fontSize: 12, color: "#111", lineHeight: 1.9 }}>
                <strong>PAYMENT DETAILS:</strong><br />
                <div>Bank: {form.bank_name}</div>
                {form.account_number && <div>Account No: {form.account_number}</div>}
                {form.account_holder_name && <div>Account Name: {form.account_holder_name}</div>}
              </div>
            )}
            {form.payment_method && form.payment_method !== "Bank Transfer" && form.payment_instructions && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#333", whiteSpace: "pre-line", lineHeight: 1.9 }}>
                {form.payment_instructions}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <SigRow />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // INVOICE & RECEIPT — bordered table, TOTAL/VAT/WHT/GRAND TOTAL rows, amount in words
  // ══════════════════════════════════════════════
  const withholdingAmt = calcs?.withholdingVatAmt || 0;
  const grandTotal = calcs?.netPayable ?? calcs?.total ?? 0;
  const totalAmt = calcs?.total ?? 0;
  const taxAmt = calcs?.taxAmt ?? 0;
  const isReceipt = docType === "receipt";

  return (
    <div style={{ background: "#fff", minHeight: 1123, display: "flex", flexDirection: "row", fontFamily: "'Times New Roman', Times, serif", fontSize: 13 }}>
      <div style={{ width: 100, background: sidebarBg, flexShrink: 0, alignSelf: "stretch" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Header />
        <div style={{ padding: "16px 40px 16px 24px" }}>
          {/* Tagline centered if no notes (notes shown in Header) */}
          {/* Title */}
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 15, marginBottom: 14, letterSpacing: 2 }}>
            {isReceipt ? "RECEIPT" : "INVOICE"}
          </div>
          {/* To: + meta two-column */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 20 }}>
            <div style={{ fontSize: 13, color: "#111", lineHeight: 1.8 }}>
              {form.customer_name && <div>TO:&nbsp;&nbsp;&nbsp;{form.customer_name},</div>}
              {form.customer_company && <div style={{ paddingLeft: 42 }}>{form.customer_company}</div>}
              {form.customer_address && form.customer_address.split("\n").map((l, i) => <div key={i} style={{ paddingLeft: 42 }}>{l}</div>)}
            </div>
            <div style={{ fontSize: 13, color: "#111", lineHeight: 1.8, minWidth: 190, flexShrink: 0 }}>
              {form.number && <div style={{ fontWeight: 700 }}>{form.number}</div>}
              {form.lpo_number && <div>L.P.O: {form.lpo_number}</div>}
              {form.issue_date && <div>DATE:&nbsp;&nbsp; {fmtDateShort(form.issue_date)}</div>}
              {form.tax_number && <div>TIN NO: {form.tax_number}</div>}
              {form.due_date && <div>Due: {fmtDateShort(form.due_date)}</div>}
            </div>
          </div>
          {/* Bordered items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #111" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #111" }}>
                <th style={{ textAlign: "left", padding: "7px 10px", fontWeight: 700, borderRight: "1px solid #111", width: "8%" }}>QTY</th>
                <th style={{ textAlign: "left", padding: "7px 10px", fontWeight: 700, borderRight: "1px solid #111" }}>DESCRIPTION</th>
                <th style={{ textAlign: "right", padding: "7px 10px", fontWeight: 700, borderRight: "1px solid #111", width: "20%" }}>UNIT PRICE</th>
                <th style={{ textAlign: "right", padding: "7px 10px", fontWeight: 700, width: "20%" }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? items.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "8px 10px", verticalAlign: "top", borderRight: "1px solid #ddd" }}>{String(parseFloat(item.quantity) || 0).padStart(2,"0")}</td>
                  <td style={{ padding: "8px 10px", verticalAlign: "top", borderRight: "1px solid #ddd" }}>{item.description || "—"}</td>
                  <td style={{ padding: "8px 10px", verticalAlign: "top", textAlign: "right", borderRight: "1px solid #ddd" }}>{sym}{fmt(item.unit_price)}</td>
                  <td style={{ padding: "8px 10px", verticalAlign: "top", textAlign: "right" }}>{sym}{fmt(item.amount)}</td>
                </tr>
              )) : null}
              {/* Empty filler rows */}
              {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, i) => (
                <tr key={`empty-${i}`} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "8px 10px", borderRight: "1px solid #ddd" }}>&nbsp;</td>
                  <td style={{ padding: "8px 10px", borderRight: "1px solid #ddd" }}>&nbsp;</td>
                  <td style={{ padding: "8px 10px", borderRight: "1px solid #ddd" }}>&nbsp;</td>
                  <td style={{ padding: "8px 10px" }}>&nbsp;</td>
                </tr>
              ))}
              {/* Totals rows */}
              {(calcs?.globalDiscAmt || 0) > 0 && (
                <tr style={{ borderTop: "1px solid #ddd" }}>
                  <td colSpan={2} style={{ padding: "6px 10px", borderRight: "1px solid #ddd" }} />
                  <td style={{ padding: "6px 10px", fontWeight: 700, borderRight: "1px solid #ddd", borderLeft: "1px solid #ddd" }}>DISCOUNT</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>-{sym}{fmt(calcs.globalDiscAmt)}</td>
                </tr>
              )}
              {(parseFloat(form.shipping) || 0) > 0 && (
                <tr style={{ borderTop: "1px solid #ddd" }}>
                  <td colSpan={2} style={{ padding: "6px 10px", borderRight: "1px solid #ddd" }} />
                  <td style={{ padding: "6px 10px", fontWeight: 700, borderRight: "1px solid #ddd", borderLeft: "1px solid #ddd" }}>SHIPPING</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{sym}{fmt(form.shipping)}</td>
                </tr>
              )}
              <tr style={{ borderTop: "1px solid #111" }}>
                <td colSpan={2} style={{ padding: "6px 10px", borderRight: "1px solid #ddd" }} />
                <td style={{ padding: "6px 10px", fontWeight: 700, borderRight: "1px solid #ddd", borderLeft: "1px solid #ddd" }}>TOTAL</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{sym}{fmt(totalAmt)}</td>
              </tr>
              {taxAmt > 0 && (
                <tr style={{ borderTop: "1px solid #ddd" }}>
                  <td colSpan={2} style={{ padding: "6px 10px", borderRight: "1px solid #ddd" }} />
                  <td style={{ padding: "6px 10px", fontWeight: 700, borderRight: "1px solid #ddd", borderLeft: "1px solid #ddd" }}>VAT</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{sym}{fmt(taxAmt)}</td>
                </tr>
              )}
              {withholdingAmt > 0 && (
                <tr style={{ borderTop: "1px solid #ddd" }}>
                  <td colSpan={2} style={{ padding: "6px 10px", borderRight: "1px solid #ddd" }} />
                  <td style={{ padding: "6px 10px", fontWeight: 700, borderRight: "1px solid #ddd", borderLeft: "1px solid #ddd" }}>WHT</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>-{sym}{fmt(withholdingAmt)}</td>
                </tr>
              )}
              <tr style={{ borderTop: "1px solid #111" }}>
                <td colSpan={2} style={{ padding: "8px 10px", borderRight: "1px solid #ddd" }} />
                <td style={{ padding: "8px 10px", fontWeight: 900, borderRight: "1px solid #ddd", borderLeft: "1px solid #ddd" }}>GRAND{"\n"}TOTAL</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 900 }}>{sym}{fmt(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
          {/* Amount in words */}
          {grandTotal > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#111", lineHeight: 1.8 }}>
              <strong>AMOUNT IN WORDS:</strong> {numToWords(grandTotal)}.
            </div>
          )}
          {/* Notes */}
          {form.notes && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#444", lineHeight: 1.8 }}>
              <strong>Note:</strong> {form.notes}
            </div>
          )}
          {/* Terms */}
          {form.terms && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#333", lineHeight: 1.8 }}>
              <strong>Terms:</strong> {form.terms}
            </div>
          )}
          {/* Payment details — bank transfer shows structured fields; other methods show payment_instructions */}
          {form.payment_method === "Bank Transfer" && form.bank_name && (
            <div style={{ marginTop: 14, fontSize: 12, color: "#111", lineHeight: 1.9 }}>
              <strong>PAYMENT DETAILS:</strong><br />
              <div>Bank: {form.bank_name}</div>
              {form.account_number && <div>Account No: {form.account_number}</div>}
              {form.account_holder_name && <div>Account Name: {form.account_holder_name}</div>}
            </div>
          )}
          {form.payment_method && form.payment_method !== "Bank Transfer" && form.payment_instructions && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#333", whiteSpace: "pre-line", lineHeight: 1.9 }}>
              {form.payment_instructions}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <SigRow />
      </div>
    </div>
  );
}

// ─── Ordered body sections renderer ─────────────────────────────────────────
// Renders the reorderable sections (items, totals, bank, notes, signatures, footer)
// in the order specified by fieldLayout. "header" and "client" are always rendered
// by the individual layout components because they differ per template.
function OrderedSections({ form, items, calcs, sym, docType, managerSig, customerSig, T, fieldLayout, amountLabel, footerContent }) {
  const DEFAULT_ORDER = ["items", "totals", "bank", "notes", "signatures", "footer"];

  // Build ordered list from fieldLayout (only include visible ones)
  const order = fieldLayout && fieldLayout.length > 0 ?
  fieldLayout.filter((s) => s.visible !== false).map((s) => s.id) :
  DEFAULT_ORDER;

  // Ensure all sections appear (append any missing ones at the end)
  const seen = new Set(order);
  DEFAULT_ORDER.forEach((id) => {if (!seen.has(id)) order.push(id);});

  return (
    <>
      {order.map((id) => {
        if (id === "items") return (
          <div key="items">
            <ItemsTable items={items} docType={docType} T={T} />
            <ExtraFields form={form} docType={docType} T={T} />
          </div>);

        if (id === "totals" && docType !== "waybill") return (
          <TotalsBlock key="totals" calcs={calcs} form={form} sym={sym} T={T} amountLabel={amountLabel} />);

        if (id === "bank") return null; // bank is shown inside SigsAndPayment via payment_method
        if (id === "notes") return <NotesBlock key="notes" form={form} T={T} />;
        if (id === "signatures") return (
          <SigsAndPayment key="signatures" managerSig={managerSig} customerSig={customerSig} form={form} T={T} docType={docType} sym={sym} />);

        if (id === "footer") return footerContent ?
        <div key="footer" style={{ marginTop: "auto" }}>{footerContent}</div> :
        null;
        return null;
      })}
    </>);

}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function DocumentPreview({ form, items, calcs, sym, docType, managerSig, customerSig, template, templateColor, templateFont, customColor, cornerRadius, shadowEffect, fieldLayout }) {
  const T = buildTheme(template || form?.template || "classic", templateColor || form?.template_color || "slate", templateFont || form?.template_font, customColor || form?.custom_color);
  const lineItems = items || [];
  const layout = template || form?.template || "classic";
  const radius = CORNER_RADIUS_MAP[cornerRadius] ?? 8;
  const shadow = SHADOW_MAP[shadowEffect] ?? SHADOW_MAP.sm;
  const amountLabel = AMOUNT_LABEL[docType] || "BALANCE DUE";
  const billToLabel = BILL_TO_LABEL[docType] || "BILL TO";
  const label = TYPE_LABELS[docType] || "INVOICE";

  // Shared props for ordered sections
  const orderedProps = { form, items: lineItems, calcs, sym, docType, managerSig, customerSig, T, fieldLayout, amountLabel };

  // If no fieldLayout is provided, fall back to original layout components
  if (!fieldLayout || fieldLayout.length === 0) {
    const shared = { form, items: lineItems, calcs, sym, docType, managerSig, customerSig, T };
    return (
      <div style={{ width: 794, border: "1px solid #e2e8f0", borderRadius: radius, overflow: "hidden", fontFamily: T.font, boxShadow: shadow }}>
        {layout === "modern"    && <ModernDoc    {...shared} />}
        {layout === "minimal"   && <MinimalDoc   {...shared} />}
        {layout === "bold"      && <BoldDoc      {...shared} />}
        {layout === "elegant"   && <ElegantDoc   {...shared} />}
        {layout === "sidebar"   && <SidebarDoc   {...shared} />}
        {layout === "executive" && <ExecutiveDoc {...shared} />}
        {layout === "wave"      && <WaveDoc      {...shared} />}
        {layout === "compact"   && <CompactDoc   {...shared} />}
        {layout === "sikky"    && <SikkyDoc     {...shared} />}
        {(layout === "classic" || !["modern","minimal","bold","elegant","sidebar","executive","wave","compact","sikky"].includes(layout)) && <ClassicDoc {...shared} />}
      </div>);

  }

  // With fieldLayout: render header+client per template, then ordered body
  const isColoredHeader = T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb";

  const renderHeader = () => {
    if (layout === "bold") return (
      <div style={{ display: "grid", gridTemplateColumns: "55% 45%" }}>
        <div style={{ background: T.headerBg, padding: "32px 32px", minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 90, maxWidth: 160, objectFit: "contain", display: "block", marginBottom: 10, filter: isColoredHeader ? "brightness(0) invert(1)" : "none", opacity: 0.9 }} />}
            <div style={{ fontSize: 20, fontWeight: 900, color: T.headerColor }}>{form.company_name || "Your Company"}</div>
            {form.company_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.6, marginTop: 4, whiteSpace: "pre-line" }}>{form.company_address}</div>}
          </div>
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: T.headerColor, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{billToLabel}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.headerColor }}>{form.customer_name || "—"}</div>
            {form.customer_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.65, whiteSpace: "pre-line", marginTop: 2 }}>{form.customer_address}</div>}
          </div>
        </div>
        <div style={{ background: isColoredHeader ? "#ffffff" : T.stripBg, borderLeft: `4px solid ${T.accentColor}`, padding: "32px 28px", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: T.accentColor, lineHeight: 1 }}>{label}</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8", marginTop: 6 }}>{form.number || "—"}</div>
          </div>
          {docType !== "waybill" &&
          <div style={{ textAlign: "right", borderTop: `1px solid ${T.stripBorder}`, paddingTop: 8 }}>
              <div style={{ fontSize: 9, color: T.tableHeaderColor, textTransform: "uppercase" }}>{amountLabel}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: T.accentColor }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          }
        </div>
      </div>);


    if (layout === "elegant") return (
      <>
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
        <div style={{ background: T.stripBg, borderBottom: `1px solid ${T.stripBorder}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 24px" }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.tableHeaderColor, textTransform: "uppercase", marginBottom: 6 }}>{billToLabel}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
            {form.customer_address && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 3, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            {form.issue_date && <div style={{ fontSize: 10, color: "#6b7280" }}>{ISSUE_LABEL[docType] || "Date"}: <span style={{ fontWeight: 600 }}>{form.issue_date}</span></div>}
            {docType !== "waybill" && <div style={{ marginTop: 8 }}><div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase" }}>{amountLabel}</div><div style={{ fontSize: 18, fontWeight: 900, color: T.accentColor }}>{sym}{fmt(calcs?.total || 0)}</div></div>}
          </div>
        </div>
      </>);


    if (layout === "minimal") return (
      <>
        <div style={{ height: 4, background: T.accentColor }} />
        <div style={{ padding: "28px 40px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 80, maxWidth: 160, objectFit: "contain", display: "block", marginBottom: 6 }} />}
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{form.company_name || "Your Company"}</div>
            {form.company_address && <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 3, whiteSpace: "pre-line" }}>{form.company_address}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 4, color: T.accentColor, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af", marginTop: 4 }}>{form.number || "—"}</div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #f3f4f6", margin: "0 40px" }} />
        <div style={{ padding: "16px 40px", display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.accentColor, textTransform: "uppercase", marginBottom: 5 }}>{billToLabel}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{form.customer_name || "—"}</div>
            {form.customer_address && <div style={{ fontSize: 10, color: "#6b7280", whiteSpace: "pre-line", marginTop: 2 }}>{form.customer_address}</div>}
          </div>
          {docType !== "waybill" && <div style={{ textAlign: "right" }}><div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.accentColor, textTransform: "uppercase", marginBottom: 3 }}>{amountLabel}</div><div style={{ fontSize: 28, fontWeight: 900, color: "#111827" }}>{sym}{fmt(calcs?.total || 0)}</div></div>}
        </div>
        <div style={{ borderTop: "1px solid #f3f4f6", margin: "0 40px" }} />
      </>);


    if (layout === "modern") return (
      <>
        <div style={{ background: T.headerBg, padding: "0" }}>
          <div style={{ padding: "28px 36px 0", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 100, maxWidth: 180, objectFit: "contain", display: "block", marginBottom: 10, filter: isColoredHeader ? "brightness(0) invert(1)" : "none", opacity: 0.9 }} />}
              <div style={{ fontSize: 22, fontWeight: 900, color: T.headerColor }}>{form.company_name || "Your Company"}</div>
              {form.company_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.6, marginTop: 4, whiteSpace: "pre-line" }}>{form.company_address}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: T.docTitleColor, lineHeight: 1 }}>{label}</div>
              <div style={{ fontSize: 13, color: T.headerColor, opacity: 0.5, fontFamily: "monospace", marginTop: 6 }}>{form.number || "—"}</div>
            </div>
          </div>
          <div style={{ height: 6, background: T.accentColor, marginTop: 20 }} />
        </div>
        <div style={{ borderBottom: `1px solid ${T.stripBorder}`, background: T.stripBg, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 20px" }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>{billToLabel}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
            {form.customer_address && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            {form.issue_date && <div style={{ fontSize: 10, color: "#64748b" }}>{ISSUE_LABEL[docType] || "Date"}: {form.issue_date}</div>}
            {docType !== "waybill" && <div style={{ marginTop: 8, borderTop: `1px solid ${T.stripBorder}`, paddingTop: 6 }}><div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase" }}>{amountLabel}</div><div style={{ fontSize: 18, fontWeight: 900, color: T.accentColor }}>{sym}{fmt(calcs?.total || 0)}</div></div>}
          </div>
        </div>
      </>);


    // classic (default)
    return (
      <>
        <div style={{ background: T.headerBg, borderBottom: `2px solid ${T.accentColor}`, padding: "36px 48px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {form.logo_url ? <img src={form.logo_url} alt="logo" style={{ height: 110, maxWidth: 200, objectFit: "contain", display: "block", marginBottom: 8 }} /> : <div style={{ height: 8 }} />}
            <div style={{ fontWeight: 900, fontSize: 18, color: T.headerColor }}>{form.company_name || "Your Company"}</div>
            {form.company_address && <div style={{ fontSize: 10, color: T.headerColor, opacity: 0.65, marginTop: 3, whiteSpace: "pre-line" }}>{form.company_address}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 3, color: T.docTitleColor }}>{label}</div>
            <div style={{ fontSize: 12, color: T.headerColor, opacity: 0.5, marginTop: 4, fontFamily: "monospace" }}>{form.number || "—"}</div>
            {docType !== "waybill" && <div style={{ marginTop: 12, borderTop: `2px solid ${isColoredHeader ? "rgba(255,255,255,0.35)" : T.accentColor}`, paddingTop: 8 }}><div style={{ fontSize: 9, color: isColoredHeader ? "rgba(255,255,255,0.75)" : "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>{amountLabel}</div><div style={{ fontSize: 22, fontWeight: 900, color: isColoredHeader ? "#ffffff" : "#111827", marginTop: 2 }}>{sym}{fmt(calcs?.total || 0)}</div></div>}
          </div>
        </div>
        <div style={{ background: T.stripBg, borderBottom: `1px solid ${T.stripBorder}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 48px" }}>
          <div>
            <div style={{ fontSize: 8, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>{billToLabel}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
            {form.customer_address && <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
          </div>
          <div style={{ textAlign: "right", fontSize: 11 }}>
            {form.issue_date && <div><span style={{ color: "#94a3b8" }}>{ISSUE_LABEL[docType] || "Date"}: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.issue_date}</span></div>}
            {form.due_date && DUE_LABEL[docType] && <div style={{ marginTop: 3 }}><span style={{ color: "#94a3b8" }}>{DUE_LABEL[docType]}: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.due_date}</span></div>}
          </div>
        </div>
      </>);

  };

  const renderFooterBar = () => {
    const content = [form.company_phone && `☎ ${form.company_phone}`, form.company_email && `✉ ${form.company_email}`, form.company_website && `🌐 ${form.company_website}`].filter(Boolean).join("  ·  ");
    if (layout === "elegant") return (
      <>
        <div style={{ padding: "12px 40px", textAlign: "center", borderTop: `1px solid ${T.stripBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ flex: 1, height: 1, background: T.accentColor, opacity: 0.3 }} />
            <div style={{ width: 4, height: 4, background: T.accentColor, transform: "rotate(45deg)", opacity: 0.5 }} />
            <div style={{ flex: 1, height: 1, background: T.accentColor, opacity: 0.3 }} />
          </div>
          <div style={{ fontSize: 9, color: "#d1d5db", letterSpacing: 1 }}>{content}</div>
        </div>
        <div style={{ height: 2, background: T.accentColor, opacity: 0.3 }} />
        <div style={{ height: 2, background: T.accentColor, margin: "3px 0 0" }} />
      </>);

    if (layout === "modern") return (
      <>
        <div style={{ height: 6, background: T.accentColor }} />
        <div style={{ padding: "8px 36px", background: T.stripBg, textAlign: "center", fontSize: 9, color: T.tableHeaderColor }}>{content}</div>
      </>);

    if (layout === "bold") return (
      <>
        <div style={{ height: 4, background: T.accentColor }} />
        <div style={{ padding: "8px 32px", background: T.stripBg, textAlign: "center", fontSize: 9, color: T.tableHeaderColor }}>{content}</div>
      </>);

    if (layout === "minimal") return (
      <div style={{ padding: "10px 40px", borderTop: "1px solid #f3f4f6", textAlign: "center", fontSize: 9, color: "#d1d5db", letterSpacing: 1 }}>{content}</div>);

    // classic
    return (
      <div style={{ padding: "14px 48px", background: T.stripBg, borderTop: `1px solid ${T.stripBorder}`, textAlign: "center", fontSize: 9, color: T.tableHeaderColor }}>{content}</div>);

  };

  return (
    <div style={{ width: 794, border: "1px solid #e2e8f0", borderRadius: radius, overflow: "hidden", fontFamily: T.font, boxShadow: shadow, background: "#fff", minHeight: 1123, display: "flex", flexDirection: "column" }}>
      {renderHeader()}
      <OrderedSections {...orderedProps} footerContent={renderFooterBar()} />
    </div>);

}