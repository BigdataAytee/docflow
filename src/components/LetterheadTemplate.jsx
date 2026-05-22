import { format } from "date-fns";
import SignaturePad from "./SignaturePad";

export default function LetterheadTemplate({ doc, onSaveManagerSig, onSaveCustomerSig }) {
  const today = doc.issue_date ? format(new Date(doc.issue_date), "do MMMM, yyyy") : format(new Date(), "do MMMM, yyyy");

  return (
    <div
      className="bg-white border border-gray-300 shadow-sm rounded-lg overflow-hidden print:shadow-none print:border-0"
      style={{ fontFamily: "'Times New Roman', Georgia, serif", minHeight: "29.7cm" }}
    >
      {/* ===== TOP HEADER BAR ===== */}
      <div style={{ background: "#1e293b", padding: "0" }}>
        <div style={{ display: "flex", alignItems: "stretch", minHeight: 100 }}>
          {/* Logo box */}
          <div style={{
            background: "#fff",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 160,
            borderRight: "4px solid #f59e0b"
          }}>
            {doc.logo_url
              ? <img src={doc.logo_url} alt="Logo" style={{ height: 64, maxWidth: 140, objectFit: "contain" }} />
              : <div style={{ width: 120, height: 60, background: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: 11 }}>LOGO</div>
            }
          </div>

          {/* Company name + tagline */}
          <div style={{ flex: 1, padding: "20px 32px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: "#fff", fontSize: 26, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Arial, sans-serif" }}>
              {doc.company_name || "Your Company Name"}
            </div>
            {doc.company_address && (
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4, fontFamily: "Arial, sans-serif" }}>
                {doc.company_address.split("\n")[0]}
              </div>
            )}
          </div>

          {/* RC / Registration box (right) */}
          <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", gap: 4 }}>
            {doc.company_phone && (
              <div style={{ color: "#f59e0b", fontSize: 13, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>
                ✆ {doc.company_phone}
              </div>
            )}
            {doc.company_email && (
              <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "Arial, sans-serif" }}>
                ✉ {doc.company_email}
              </div>
            )}
            {doc.company_website && (
              <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "Arial, sans-serif" }}>
                🌐 {doc.company_website}
              </div>
            )}
          </div>
        </div>

        {/* Accent strip */}
        <div style={{ background: "#f59e0b", height: 6 }} />
      </div>

      {/* ===== DOCUMENT TITLE BAND ===== */}
      <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "10px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: "#1e293b" }}>
          {doc.terms_label && doc.terms_label !== "Due on Receipt" ? doc.terms_label : "Official Correspondence"}
        </div>
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "#64748b" }}>
          Date: <strong style={{ color: "#1e293b" }}>{today}</strong>
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div style={{ padding: "32px 48px 24px" }}>
        {/* Addressee */}
        {doc.customer_name && (
          <div style={{ marginBottom: 28, fontFamily: "Arial, sans-serif" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{doc.customer_name}</div>
            {doc.customer_address && (
              <div style={{ fontSize: 12, color: "#475569", marginTop: 2, whiteSpace: "pre-line", lineHeight: 1.6 }}>{doc.customer_address}</div>
            )}
            {doc.customer_email && (
              <div style={{ fontSize: 12, color: "#475569" }}>{doc.customer_email}</div>
            )}
          </div>
        )}

        {/* Salutation */}
        <div style={{ marginBottom: 16, fontFamily: "'Times New Roman', serif", fontSize: 14, color: "#1e293b" }}>
          Dear {doc.customer_name ? doc.customer_name.split(" ")[0] : "Sir/Madam"},
        </div>

        {/* Letter body — rich text from QuillEditor */}
        <div
          className="prose prose-sm max-w-none"
          style={{ fontSize: 14, lineHeight: 2, color: "#1e293b", fontFamily: "'Times New Roman', serif", minHeight: 300 }}
          dangerouslySetInnerHTML={{ __html: doc.notes || "<p><em>No content written.</em></p>" }}
        />

        {/* Complimentary close */}
        <div style={{ marginTop: 28, fontFamily: "'Times New Roman', serif", fontSize: 14, color: "#1e293b" }}>
          Yours faithfully,
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontFamily: "Arial, sans-serif", marginBottom: 8 }}>
          {doc.company_name}
        </div>

        {/* Signature blocks */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginTop: 24, paddingTop: 24, borderTop: "1px solid #e2e8f0" }}>

          {/* Manager/Company signature */}
          <div>
            <div style={{ fontSize: 10, fontFamily: "Arial, sans-serif", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontWeight: 700 }}>
              Authorized Signatory
            </div>
            {doc.manager_signature ? (
              <div>
                <img src={doc.manager_signature} alt="Signature" style={{ height: 56, objectFit: "contain", display: "block", marginBottom: 6 }} />
                <div style={{ borderTop: "1.5px solid #94a3b8", paddingTop: 4 }}>
                  <div style={{ fontSize: 12, fontFamily: "Arial, sans-serif", color: "#475569" }}>{doc.company_name}</div>
                </div>
                <button className="print:hidden" style={{ fontSize: 11, color: "#3b82f6", marginTop: 4, cursor: "pointer", background: "none", border: "none" }} onClick={() => onSaveManagerSig("")}>Re-sign</button>
              </div>
            ) : (
              <div className="print:hidden">
                <SignaturePad label="" onSave={onSaveManagerSig} />
              </div>
            )}
          </div>

          {/* Customer / Recipient signature */}
          <div>
            <div style={{ fontSize: 10, fontFamily: "Arial, sans-serif", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontWeight: 700 }}>
              Acknowledgement
            </div>
            {doc.customer_signature ? (
              <div>
                <img src={doc.customer_signature} alt="Signature" style={{ height: 56, objectFit: "contain", display: "block", marginBottom: 6 }} />
                <div style={{ borderTop: "1.5px solid #94a3b8", paddingTop: 4 }}>
                  <div style={{ fontSize: 12, fontFamily: "Arial, sans-serif", color: "#475569" }}>{doc.customer_name}</div>
                </div>
                <button className="print:hidden" style={{ fontSize: 11, color: "#3b82f6", marginTop: 4, cursor: "pointer", background: "none", border: "none" }} onClick={() => onSaveCustomerSig("")}>Re-sign</button>
              </div>
            ) : (
              <div className="print:hidden">
                <SignaturePad label="" onSave={onSaveCustomerSig} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <div style={{ background: "#1e293b", marginTop: "auto" }}>
        <div style={{ background: "#f59e0b", height: 4 }} />
        <div style={{ padding: "12px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {[
            doc.company_address && `📍 ${doc.company_address.split("\n")[0]}`,
            doc.company_phone && `✆ ${doc.company_phone}`,
            doc.company_email && `✉ ${doc.company_email}`,
            doc.company_website && `🌐 ${doc.company_website}`,
          ].filter(Boolean).map((item, i) => (
            <span key={i} style={{ color: "#cbd5e1", fontSize: 11, fontFamily: "Arial, sans-serif" }}>{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}