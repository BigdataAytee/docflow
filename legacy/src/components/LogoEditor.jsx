import { useState, useRef } from "react";
import { Upload, Type, X, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function LogoEditor({ form, setForm }) {
  const [tab, setTab] = useState("upload"); // "upload" | "text"
  const [uploading, setUploading] = useState(false);
  const [textLogo, setTextLogo] = useState(form.company_name || "");
  const [textColor, setTextColor] = useState("#4f46e5");
  const [textSize, setTextSize] = useState(24);
  const fileInputRef = useRef(null);

  const logoSize = form.logo_size || 80;
  const setLogoSize = (v) => setForm((f) => ({ ...f, logo_size: v }));

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, logo_url: file_url, logo_type: "image" }));
    setUploading(false);
  };

  const handleApplyText = () => {
    if (!textLogo.trim()) return;
    // Encode text logo as a data URI-like tag so DocumentPreview can render it
    setForm((f) => ({
      ...f,
      logo_url: "",
      logo_text: textLogo,
      logo_text_color: textColor,
      logo_text_size: textSize,
      logo_type: "text",
    }));
  };

  const handleRemove = () => {
    setForm((f) => ({ ...f, logo_url: "", logo_text: "", logo_type: "" }));
  };

  const hasLogo = form.logo_url || form.logo_text;

  return (
    <div className="space-y-3">
      {/* Preview */}
      {hasLogo && (
        <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-center bg-white rounded-lg p-2" style={{ minWidth: 60, minHeight: 40 }}>
            {form.logo_type === "text" ? (
              <span style={{ color: form.logo_text_color || "#4f46e5", fontSize: (form.logo_text_size || 24) * (logoSize / 80), fontWeight: 700, lineHeight: 1.1, wordBreak: "break-all" }}>
                {form.logo_text}
              </span>
            ) : (
              <img src={form.logo_url} alt="logo" style={{ maxHeight: logoSize, maxWidth: logoSize * 2, objectFit: "contain" }} />
            )}
          </div>
          {/* Size slider */}
          <div className="w-full space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/50">Size</span>
              <span className="text-[10px] text-indigo-300 font-bold">{logoSize}px</span>
            </div>
            <div className="flex items-center gap-2">
              <ZoomOut className="h-3 w-3 text-white/40 shrink-0" />
              <input
                type="range" min={30} max={200} value={logoSize}
                onChange={(e) => setLogoSize(Number(e.target.value))}
                className="flex-1 h-1.5 accent-indigo-400 cursor-pointer" />
              <ZoomIn className="h-3 w-3 text-white/40 shrink-0" />
            </div>
          </div>
          <button onClick={handleRemove} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
            <X className="h-3 w-3" /> Remove logo
          </button>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
        <button onClick={() => setTab("upload")}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${tab === "upload" ? "bg-indigo-500 text-white" : "text-white/50 hover:text-white/80"}`}>
          <Upload className="h-3 w-3" /> Upload
        </button>
        <button onClick={() => setTab("text")}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${tab === "text" ? "bg-indigo-500 text-white" : "text-white/50 hover:text-white/80"}`}>
          <Type className="h-3 w-3" /> Text
        </button>
      </div>

      {/* Upload tab */}
      {tab === "upload" && (
        <div>
          <label className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-white/20 rounded-xl py-4 cursor-pointer hover:border-indigo-400 transition-colors ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
            {uploading
              ? <><Loader2 className="h-5 w-5 text-indigo-400 animate-spin" /><span className="text-[10px] text-white/50">Uploading…</span></>
              : <><Upload className="h-5 w-5 text-white/40" /><span className="text-[10px] text-white/60 text-center px-2">Tap to upload logo<br /><span className="text-white/30">PNG, JPG, SVG</span></span></>
            }
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])} />
          </label>
        </div>
      )}

      {/* Text tab */}
      {tab === "text" && (
        <div className="space-y-2">
          <input
            value={textLogo}
            onChange={(e) => setTextLogo(e.target.value)}
            placeholder="Your company name"
            className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400" />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-white/50 shrink-0">Colour</label>
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)}
              className="h-6 w-10 rounded cursor-pointer bg-transparent border border-white/20" />
            <label className="text-[10px] text-white/50 shrink-0">Size</label>
            <input type="range" min={12} max={48} value={textSize} onChange={(e) => setTextSize(Number(e.target.value))}
              className="flex-1 h-1.5 accent-indigo-400 cursor-pointer" />
            <span className="text-[10px] text-indigo-300 font-bold shrink-0">{textSize}px</span>
          </div>
          {/* Live preview */}
          <div className="flex items-center justify-center bg-white rounded-lg py-2 px-3 min-h-[36px]">
            <span style={{ color: textColor, fontSize: textSize, fontWeight: 700, lineHeight: 1.1 }}>
              {textLogo || <span style={{ color: "#ccc", fontSize: 12 }}>Preview here</span>}
            </span>
          </div>
          <button onClick={handleApplyText} disabled={!textLogo.trim()}
            className="w-full py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-bold disabled:opacity-40 transition-colors">
            Apply Text Logo
          </button>
        </div>
      )}
    </div>
  );
}