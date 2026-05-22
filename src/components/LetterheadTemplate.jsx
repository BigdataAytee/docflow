import { useState } from "react";
import { format } from "date-fns";
import SignaturePad from "./SignaturePad";
import ReactQuill from "react-quill";
import { Button } from "@/components/ui/button";
import { PencilLine, Check, X } from "lucide-react";

const QUILL_MODULES = {
  toolbar: [
    [{ font: ["", "serif", "monospace"] }],
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    ["blockquote"],
    ["link"],
    ["clean"],
  ],
};

export default function LetterheadTemplate({ doc, onSaveManagerSig, onSaveCustomerSig, onSaveNotes }) {
  const [editing, setEditing] = useState(false);
  const [draftNotes, setDraftNotes] = useState(doc.notes || "");

  const today = doc.issue_date
    ? format(new Date(doc.issue_date), "do MMMM, yyyy")
    : format(new Date(), "do MMMM, yyyy");

  const handleSaveNotes = () => {
    onSaveNotes && onSaveNotes(draftNotes);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setDraftNotes(doc.notes || "");
    setEditing(false);
  };

  return (
    <div
      className="bg-white border border-gray-300 shadow-sm rounded-lg overflow-hidden print:shadow-none print:border-0"
      style={{ fontFamily: "'Times New Roman', Georgia, serif", minHeight: "29.7cm" }}
    >
      {/* ===== TOP HEADER BAR ===== */}
      <div style={{ background: "#1e293b" }}>
        <div style={{ display: "flex", alignItems: "stretch", minHeight: 100 }}>
          {/* Logo box */}
          <div style={{
            background: "#fff",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 160,
            borderRight: "4px solid #f59e0b",
          }}>
            {doc.logo_url
              ? <img src={doc.logo_url} alt="Logo" style={{ height: 64, maxWidth: 140, objectFit: "contain" }} />
              : <div style={{ width: 120, height: 60, background: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: 11 }}>LOGO</div>
            }
          </div>

          {/* Company name */}
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

          {/* Contact */}
          <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", gap: 4 }}>
            {doc.company_phone && (
              <div style={{ color: "#f59e0b", fontSize: 13, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>✆ {doc.company_phone}</div>
            )}
            {doc.company_email && (
              <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "Arial, sans-serif" }}>✉ {doc.company_email}</div>
            )}
            {doc.company_website && (
              <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "Arial, sans-serif" }}>🌐 {doc.company_website}</div>
            )}
          </div>
        </div>
        {/* Accent strip */}
        <div style={{ background: "#f59e0b", height: 6 }} />
      </div>

      {/* ===== TITLE BAND ===== */}
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

        {/* ===== LETTER BODY — EDITABLE ===== */}
        <div className="relative group">
          {!editing ? (
            <div>
              {/* Static display */}
              <div
                className="prose prose-sm max-w-none"
                style={{ fontSize: 14, lineHeight: 2, color: "#1e293b", fontFamily: "'Times New Roman', serif", minHeight: 200 }}
                dangerouslySetInnerHTML={{ __html: doc.notes || "<p><em>Click the edit button to start writing...</em></p>" }}
              />
              {/* Edit button (hidden on print) */}
              <button
                className="print:hidden absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-md"
                onClick={() => { setDraftNotes(doc.notes || ""); setEditing(true); }}
              >
                <PencilLine className="h-3 w-3" /> Edit Letter
              </button>
            </div>
          ) : (
            <div className="print:hidden">
              {/* Rich Text Editor */}
              <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                {/* Editor toolbar label */}
                <div className="bg-slate-800 text-white text-xs px-4 py-2 flex items-center justify-between">
                  <span className="font-semibold tracking-wide">✏️ Letter Body Editor</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="h-6 text-white hover:text-white hover:bg-white/20 text-xs px-2" onClick={handleCancelEdit}>
                      <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" className="h-6 bg-amber-500 hover:bg-amber-400 text-white text-xs px-3" onClick={handleSaveNotes}>
                      <Check className="h-3 w-3 mr-1" /> Save
                    </Button>
                  </div>
                </div>
                <ReactQuill
                  value={draftNotes}
                  onChange={setDraftNotes}
                  theme="snow"
                  modules={QUILL_MODULES}
                  style={{ minHeight: 320, fontFamily: "'Times New Roman', serif", fontSize: 14 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Complimentary close */}
        <div style={{ marginTop: 36, fontFamily: "'Times New Roman', serif", fontSize: 14, color: "#1e293b" }}>
          Yours faithfully,
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontFamily: "Arial, sans-serif", marginBottom: 8 }}>
          {doc.company_name}
        </div>

        {/* Signature blocks */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginTop: 24, paddingTop: 24, borderTop: "1px solid #e2e8f0" }}>
          {/* Manager signature */}
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