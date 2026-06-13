// QR code block rendered inside PDFs — uses a public QR API so it works in html2canvas
export default function PaymentQRBlock({ paymentLink, paymentReference, sym, amount, currency, accentColor }) {
  if (!paymentLink) return null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(paymentLink)}&bgcolor=ffffff&color=000000&format=png`;

  return (
    <div style={{ margin: "0 48px 18px", border: `2px solid ${accentColor || "#6366f1"}`, borderRadius: 12, overflow: "hidden", background: "#f8f9ff" }}>
      <div style={{ background: accentColor || "#6366f1", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#ffffff", letterSpacing: 0.5 }}>💳 PAY ONLINE</span>
        {paymentReference && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", fontFamily: "monospace", marginLeft: "auto" }}>Ref: {paymentReference}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "14px 16px" }}>
        <div style={{ flexShrink: 0 }}>
          <img
            src={qrUrl}
            alt="Scan to pay"
            style={{ width: 90, height: 90, borderRadius: 8, border: "1px solid #e2e8f0", display: "block" }}
            crossOrigin="anonymous"
          />
          <p style={{ fontSize: 8, color: "#94a3b8", textAlign: "center", marginTop: 4 }}>Scan to pay</p>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, color: "#475569", marginBottom: 6, fontWeight: 600 }}>Pay securely online:</p>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", marginBottom: 8, wordBreak: "break-all" }}>
            <a href={paymentLink} style={{ fontSize: 10, color: accentColor || "#6366f1", fontFamily: "monospace", textDecoration: "none", display: "block", lineHeight: 1.4 }}>{paymentLink}</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {amount > 0 && (
              <span style={{ fontSize: 10, background: "#f1f5f9", color: "#1e293b", fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>
                {sym || currency}{(amount || 0).toLocaleString("en", { minimumFractionDigits: 2 })} Due
              </span>
            )}
            <span style={{ fontSize: 9, color: "#94a3b8" }}>Click the link or scan the QR code to pay</span>
          </div>
        </div>
      </div>
    </div>
  );
}