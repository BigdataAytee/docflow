import { buildTheme } from "./TemplateSelector";

const TYPE_CONFIG = {
  invoice:        { label: "INVOICE" },
  quotation:      { label: "QUOTATION" },
  receipt:        { label: "RECEIPT" },
  purchase_order: { label: "PURCHASE ORDER" },
  credit_note:    { label: "CREDIT NOTE" },
  waybill:        { label: "WAYBILL" },
  delivery_note:  { label: "DELIVERY NOTE" },
  letterhead:     { label: "LETTER" },
};

const fmt = (n) => (n || 0).toLocaleString("en", { minimumFractionDigits: 2 });

export default function DocumentPreview({ form, items, calcs, sym, docType, managerSig, customerSig, template, templateColor }) {
  const cfg = TYPE_CONFIG[docType] || TYPE_CONFIG.invoice;
  const isLetter = docType === "letterhead";
  const lineItems = items || [];
  const T = buildTheme(template || form?.template || "classic", templateColor || form?.template_color || "slate");

  const isColoredHeader = T.headerBg !== "#ffffff" && T.headerBg !== "#fffbeb";

  return (
    <div style={{ width: 760, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", fontFamily: T.font, minHeight: 1040 }}>
      
      {/* Header band */}
      <div style={{ background: T.headerBg, borderBottom: `2px solid ${T.accentColor}`, padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          {form.logo_url
            ? <img src={form.logo_url} alt="logo" style={{ height: 120, maxWidth: 220, objectFit: "contain", marginBottom: 10, display: "block" }} />
            : <div style={{ height: 120 }} />}
          <div style={{ fontWeight: 900, fontSize: 20, color: T.headerColor }}>{form.company_name || "Your Company"}</div>
          {form.company_address && <div style={{ fontSize: 11, color: T.headerColor, opacity: 0.7, marginTop: 3, whiteSpace: "pre-line" }}>{form.company_address}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 2, color: T.docTitleColor }}>{cfg.label}</div>
          <div style={{ fontSize: 14, color: T.headerColor, opacity: 0.6, marginTop: 4, fontFamily: "monospace" }}>{form.number || "—"}</div>
          {!isLetter && docType !== "waybill" && (
            <div style={{ marginTop: 8, background: isColoredHeader ? "rgba(255,255,255,0.15)" : "#f8fafc", border: `1px solid ${isColoredHeader ? "rgba(255,255,255,0.25)" : "#e2e8f0"}`, borderRadius: 6, padding: "4px 12px", display: "inline-block" }}>
              <div style={{ fontSize: 9, color: isColoredHeader ? "rgba(255,255,255,0.7)" : "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>
                {docType === "receipt" ? "Amount Received" : docType === "credit_note" ? "Amount Credited" : "Amount Due"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: isColoredHeader ? "#ffffff" : "#1e293b" }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Bill From / Bill To strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: T.stripBg, borderBottom: `1px solid ${T.stripBorder}` }}>
        <div style={{ padding: "18px 32px", borderRight: `1px solid ${T.stripBorder}` }}>
          <div style={{ fontSize: 9, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>Bill From</div>
          {form.company_name && <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{form.company_name}</div>}
          {form.company_address && <div style={{ fontSize: 11, color: "#475569", marginBottom: 2, whiteSpace: "pre-line" }}>{form.company_address}</div>}
          {form.company_phone && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{form.company_phone}</div>}
          {form.company_email && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{form.company_email}</div>}
        </div>
        <div style={{ padding: "18px 32px" }}>
          <div style={{ fontSize: 9, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>
            {docType === "purchase_order" ? "Vendor" : isLetter ? "To" : "Bill To"}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
          {form.customer_address && <div style={{ fontSize: 11, color: "#64748b", marginTop: 3, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
          {form.customer_email && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{form.customer_email}</div>}
        </div>
      </div>

      {/* Dates strip */}
      {!isLetter && (
        <div style={{ display: "flex", gap: 32, padding: "12px 32px", background: T.stripBg, borderBottom: `1px solid ${T.stripBorder}`, fontSize: 11 }}>
          {form.issue_date && <div><span style={{ color: "#94a3b8" }}>Date: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.issue_date}</span></div>}
          {form.due_date && <div><span style={{ color: "#94a3b8" }}>Due: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.due_date}</span></div>}
          {form.terms_label && <div><span style={{ color: "#94a3b8" }}>Terms: </span><span style={{ color: "#334155" }}>{form.terms_label}</span></div>}
        </div>
      )}

      {/* Letter body */}
      {isLetter ? (
        <div style={{ padding: "28px 32px", minHeight: 400 }}>
          {form.terms_label && form.terms_label !== "Due on Receipt" && (
            <div style={{ fontWeight: 700, fontSize: 13, textDecoration: "underline", marginBottom: 16, color: T.accentColor }}>Re: {form.terms_label}</div>
          )}
          <div style={{ fontSize: 12, color: "#334155", lineHeight: 2, whiteSpace: "pre-wrap" }}>{form.notes || "Letter content will appear here..."}</div>
        </div>
      ) : (
        <>
          {/* Items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.tableHeaderBg }}>
                <th style={{ textAlign: "left", padding: "10px 32px", color: T.tableHeaderColor, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `2px solid ${T.accentColor}` }}>Description</th>
                <th style={{ textAlign: "right", padding: "10px 16px", color: T.tableHeaderColor, fontWeight: 700, fontSize: 10, textTransform: "uppercase", borderBottom: `2px solid ${T.accentColor}` }}>Qty</th>
                {docType !== "waybill" && <th style={{ textAlign: "right", padding: "10px 16px", color: T.tableHeaderColor, fontWeight: 700, fontSize: 10, textTransform: "uppercase", borderBottom: `2px solid ${T.accentColor}` }}>Rate</th>}
                {docType !== "waybill" && <th style={{ textAlign: "right", padding: "10px 32px 10px 16px", color: T.tableHeaderColor, fontWeight: 700, fontSize: 10, textTransform: "uppercase", borderBottom: `2px solid ${T.accentColor}` }}>Amount</th>}
              </tr>
            </thead>
            <tbody>
              {lineItems.length > 0 ? lineItems.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "11px 32px", color: "#334155" }}>{item.description || <span style={{ color: "#cbd5e1" }}>Item description</span>}</td>
                  <td style={{ padding: "11px 16px", textAlign: "right", color: "#64748b" }}>{(item.quantity || 0).toFixed(2)}</td>
                  {docType !== "waybill" && <td style={{ padding: "11px 16px", textAlign: "right", color: "#64748b" }}>{fmt(item.unit_price)}</td>}
                  {docType !== "waybill" && <td style={{ padding: "11px 32px 11px 16px", textAlign: "right", fontWeight: 600, color: "#1e293b" }}>{fmt(item.amount)}</td>}
                </tr>
              )) : (
                <tr><td colSpan={4} style={{ padding: "24px 32px", color: "#cbd5e1", textAlign: "center" }}>No items added yet</td></tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
          {docType !== "waybill" && (
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 32px 24px" }}>
            <div style={{ width: 260, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", color: "#64748b" }}>
                <span>Subtotal</span><span>{fmt(calcs?.subtotal)}</span>
              </div>
              {(calcs?.taxAmt || 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", color: "#64748b" }}>
                  <span>VAT ({form.tax_rate}%)</span><span>{fmt(calcs?.taxAmt)}</span>
                </div>
              )}
              {(form.shipping || 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", color: "#64748b" }}>
                  <span>Shipping</span><span>{fmt(form.shipping)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 8px", borderTop: `2px solid ${T.totalBorder}`, marginTop: 6, fontWeight: 800, fontSize: 15, color: "#1e293b" }}>
                <span>Total</span><span style={{ color: T.accentColor }}>{sym}{fmt(calcs?.total)}</span>
              </div>
            </div>
          </div>
          )}
        </>
      )}

      {/* Signatures */}
      {!isLetter && (
        <div style={{ display: "flex", gap: 48, padding: "20px 32px", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ minWidth: 180 }}>
            {(managerSig || form.manager_signature) && (
              <img src={managerSig || form.manager_signature} alt="Manager Signature" style={{ height: 56, objectFit: "contain", display: "block", marginBottom: 6 }} />
            )}
            {!(managerSig || form.manager_signature) && <div style={{ height: 56 }} />}
            <div style={{ borderTop: `1px solid ${T.accentColor}`, paddingTop: 4 }}>
              <div style={{ fontSize: 9, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1 }}>Manager's Signature</div>
              {form.company_name && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{form.company_name}</div>}
            </div>
          </div>
          <div style={{ minWidth: 180 }}>
            {(customerSig || form.customer_signature) && (
              <img src={customerSig || form.customer_signature} alt="Customer Signature" style={{ height: 56, objectFit: "contain", display: "block", marginBottom: 6 }} />
            )}
            {!(customerSig || form.customer_signature) && <div style={{ height: 56 }} />}
            <div style={{ borderTop: `1px solid ${T.accentColor}`, paddingTop: 4 }}>
              <div style={{ fontSize: 9, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1 }}>Customer's Signature</div>
            </div>
          </div>
        </div>
      )}

      {/* Notes bar */}
      {form.notes && !isLetter && (
        <div style={{ padding: "12px 32px 20px", borderTop: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 10, color: T.tableHeaderColor, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Notes</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{form.notes}</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ background: T.stripBg, borderTop: `1px solid ${T.stripBorder}`, padding: "10px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 10, color: T.tableHeaderColor }}>
          {[form.company_name, form.company_phone, form.company_email, form.company_website].filter(Boolean).join("  ·  ")}
        </div>
      </div>
    </div>
  );
}