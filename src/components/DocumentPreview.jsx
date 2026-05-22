const TYPE_CONFIG = {
  invoice:        { accent: "#4F46E5", bg: "#4F46E5", label: "INVOICE" },
  quotation:      { accent: "#0891b2", bg: "#0e7490", label: "QUOTATION" },
  receipt:        { accent: "#059669", bg: "#065f46", label: "RECEIPT" },
  purchase_order: { accent: "#d97706", bg: "#92400e", label: "PURCHASE ORDER" },
  credit_note:    { accent: "#dc2626", bg: "#991b1b", label: "CREDIT NOTE" },
  waybill:        { accent: "#1e293b", bg: "#1e293b", label: "WAYBILL" },
  delivery_note:  { accent: "#1e293b", bg: "#1e293b", label: "DELIVERY NOTE" },
  letterhead:     { accent: "#4F46E5", bg: "#4F46E5", label: "LETTER" },
};

const fmt = (n) => (n || 0).toLocaleString("en", { minimumFractionDigits: 2 });

export default function DocumentPreview({ form, items, calcs, sym, docType }) {
  const cfg = TYPE_CONFIG[docType] || TYPE_CONFIG.invoice;
  const isLetter = docType === "letterhead";
  const lineItems = items || [];

  return (
    <div style={{ width: 760, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", fontFamily: "'Helvetica Neue', Arial, sans-serif", minHeight: 1040 }}>
      {/* Header band */}
      <div style={{ background: cfg.bg, color: "#fff", padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          {form.logo_url
            ? <img src={form.logo_url} alt="logo" style={{ height: 44, objectFit: "contain", marginBottom: 6 }} />
            : <div style={{ height: 44 }} />}
          <div style={{ fontWeight: 800, fontSize: 16 }}>{form.company_name || "Your Company"}</div>
          {form.company_phone && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{form.company_phone}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 2, opacity: 0.95 }}>{cfg.label}</div>
          <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4, fontFamily: "monospace" }}>{form.number || "—"}</div>
          {!isLetter && (
            <div style={{ marginTop: 8, background: "rgba(255,255,255,0.18)", borderRadius: 6, padding: "4px 12px", display: "inline-block" }}>
              <div style={{ fontSize: 9, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1 }}>
                {docType === "receipt" ? "Amount Received" : docType === "credit_note" ? "Amount Credited" : "Amount Due"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{sym}{fmt(calcs?.total || 0)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Company + Customer strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ padding: "18px 32px", borderRight: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>From</div>
          <div style={{ fontSize: 12, color: "#475569" }}>{form.company_address || "—"}</div>
          {form.company_email && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{form.company_email}</div>}
        </div>
        <div style={{ padding: "18px 32px" }}>
          <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            {docType === "purchase_order" ? "Vendor" : isLetter ? "To" : "Bill To"}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{form.customer_name || "—"}</div>
          {form.customer_address && <div style={{ fontSize: 11, color: "#64748b", marginTop: 3, whiteSpace: "pre-line" }}>{form.customer_address}</div>}
        </div>
      </div>

      {/* Dates strip */}
      {!isLetter && (
        <div style={{ display: "flex", gap: 32, padding: "12px 32px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11 }}>
          {form.issue_date && <div><span style={{ color: "#94a3b8" }}>Date: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.issue_date}</span></div>}
          {form.due_date && <div><span style={{ color: "#94a3b8" }}>Due: </span><span style={{ fontWeight: 600, color: "#334155" }}>{form.due_date}</span></div>}
          {form.terms_label && <div><span style={{ color: "#94a3b8" }}>Terms: </span><span style={{ color: "#334155" }}>{form.terms_label}</span></div>}
        </div>
      )}

      {/* Letter body */}
      {isLetter ? (
        <div style={{ padding: "28px 32px", minHeight: 400 }}>
          {form.terms_label && form.terms_label !== "Due on Receipt" && (
            <div style={{ fontWeight: 700, fontSize: 13, textDecoration: "underline", marginBottom: 16, color: "#1e293b" }}>Re: {form.terms_label}</div>
          )}
          <div style={{ fontSize: 12, color: "#334155", lineHeight: 2, whiteSpace: "pre-wrap" }}>{form.notes || "Letter content will appear here..."}</div>
        </div>
      ) : (
        <>
          {/* Items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${cfg.accent}`, background: "#f8fafc" }}>
                <th style={{ textAlign: "left", padding: "10px 32px", color: "#64748b", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Description</th>
                <th style={{ textAlign: "right", padding: "10px 16px", color: "#64748b", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Qty</th>
                <th style={{ textAlign: "right", padding: "10px 16px", color: "#64748b", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Rate</th>
                <th style={{ textAlign: "right", padding: "10px 32px 10px 16px", color: "#64748b", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length > 0 ? lineItems.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "11px 32px", color: "#334155" }}>{item.description || <span style={{ color: "#cbd5e1" }}>Item description</span>}</td>
                  <td style={{ padding: "11px 16px", textAlign: "right", color: "#64748b" }}>{(item.quantity || 0).toFixed(2)}</td>
                  <td style={{ padding: "11px 16px", textAlign: "right", color: "#64748b" }}>{fmt(item.unit_price)}</td>
                  <td style={{ padding: "11px 32px 11px 16px", textAlign: "right", fontWeight: 600, color: "#1e293b" }}>{fmt(item.amount)}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} style={{ padding: "24px 32px", color: "#cbd5e1", textAlign: "center" }}>No items added yet</td></tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
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
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 8px", borderTop: `2px solid ${cfg.accent}`, marginTop: 6, fontWeight: 800, fontSize: 15, color: "#1e293b" }}>
                <span>Total</span><span style={{ color: cfg.accent }}>{sym}{fmt(calcs?.total)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Notes bar */}
      {form.notes && !isLetter && (
        <div style={{ padding: "12px 32px 20px", borderTop: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Notes</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{form.notes}</div>
        </div>
      )}
    </div>
  );
}