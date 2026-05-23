import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImageIcon } from "lucide-react";

export default function Settings() {
  const logoInputRef = useRef(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    company_email: "",
    company_phone: "",
    company_address: "",
    company_website: "",
    logo_url: "",
    default_currency: "NGN",
    default_tax_rate: 7.5,
    default_terms: "",
    default_payment_instructions: "",
    document_tagline: "",
    footer_contact_line: "",
  });

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user) {
        setForm(f => ({
          ...f,
          company_name: user.company_name || "",
          company_email: user.company_email || user.email || "",
          company_phone: user.company_phone || "",
          company_address: user.company_address || "",
          company_website: user.company_website || "",
          logo_url: user.logo_url || "",
          default_currency: user.default_currency || "NGN",
          default_tax_rate: user.default_tax_rate ?? 7.5,
          default_terms: user.default_terms || "",
          default_payment_instructions: user.default_payment_instructions || "",
          document_tagline: user.document_tagline || "",
          footer_contact_line: user.footer_contact_line || "",
        }));
        if (user.logo_url) setLogoPreview(user.logo_url);
      }
    });
  }, []);

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, logo_url: file_url }));
    setUploadingLogo(false);
  };

  const save = async () => {
    setSaving(true);
    await base44.auth.updateMe(form);

    // Sync company info + logo to ALL existing documents
    const docs = await base44.entities.Document.list("-created_date", 500);
    await Promise.all(docs.map(doc =>
      base44.entities.Document.update(doc.id, {
        logo_url: form.logo_url,
        company_name: form.company_name,
        company_email: form.company_email,
        company_phone: form.company_phone,
        company_address: form.company_address,
        company_website: form.company_website,
      })
    ));

    setSaving(false);
    toast.success("Settings saved and applied to all documents");
  };

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-sm text-muted-foreground mb-8">Configure your company details and document defaults</p>

      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <h2 className="font-semibold">Company Logo</h2>
        <div className="flex items-start gap-5">
          <div
            onClick={() => logoInputRef.current?.click()}
            className="w-28 h-28 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all overflow-hidden bg-gray-50 flex-shrink-0"
          >
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-muted-foreground p-2">
                <ImageIcon className="h-7 w-7 mx-auto mb-1" />
                <p className="text-xs">Click to upload</p>
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground space-y-2 pt-1">
            <p>Upload your company logo. It will appear on all documents.</p>
            <p className="text-xs">Recommended: PNG with transparent background, min 200×200px.</p>
            {uploadingLogo && <p className="text-primary text-xs">Uploading...</p>}
            {logoPreview && (
              <button onClick={() => { setLogoPreview(null); setForm(f => ({ ...f, logo_url: "" })); }} className="text-xs text-destructive hover:underline">
                Remove logo
              </button>
            )}
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
        </div>

        <div className="border-t border-border pt-6">
          <h2 className="font-semibold mb-4">Company Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Company Name</Label><Input value={form.company_name} onChange={e => update("company_name", e.target.value)} /></div>
            <div><Label>Email</Label><Input value={form.company_email} onChange={e => update("company_email", e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={form.company_phone} onChange={e => update("company_phone", e.target.value)} /></div>
            <div><Label>Website</Label><Input value={form.company_website} onChange={e => update("company_website", e.target.value)} /></div>
          </div>
          <div className="mt-4"><Label>Address</Label><Textarea value={form.company_address} onChange={e => update("company_address", e.target.value)} rows={3} /></div>
        </div>

        <div className="border-t border-border pt-6">
          <h2 className="font-semibold mb-4">Document Defaults</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Default Currency</Label>
              <select value={form.default_currency} onChange={e => update("default_currency", e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="NGN">₦ NGN — Nigerian Naira</option>
                <option value="USD">$ USD — US Dollar</option>
                <option value="EUR">€ EUR — Euro</option>
                <option value="GBP">£ GBP — British Pound</option>
              </select>
            </div>
            <div><Label>Default VAT Rate (%)</Label><Input type="number" value={form.default_tax_rate} onChange={e => update("default_tax_rate", +e.target.value)} /></div>
          </div>
          <div className="mt-4"><Label>{"Default Terms & Conditions"}</Label><Textarea value={form.default_terms} onChange={e => update("default_terms", e.target.value)} rows={3} /></div>
          <div className="mt-4"><Label>Default Payment Instructions</Label><Textarea value={form.default_payment_instructions} onChange={e => update("default_payment_instructions", e.target.value)} rows={3} /></div>
          <div className="mt-4"><Label>Footer Contact Line</Label><p className="text-xs text-muted-foreground mb-1.5">Displayed at the bottom of every document (e.g. phone · email · website).</p><Input value={form.footer_contact_line} onChange={e => update("footer_contact_line", e.target.value)} placeholder="e.g. 07423182811  ·  admin@dynamicrenaissance.org  ·  www.dynamicrenaissance.org" /></div>
          <div className="mt-4"><Label>Document Tagline</Label><p className="text-xs text-muted-foreground mb-1.5">A short sentence displayed at the bottom of every document.</p><Input value={form.document_tagline} onChange={e => update("document_tagline", e.target.value)} placeholder="e.g. Thank you for your business — we look forward to serving you again." /></div>
        </div>

        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
      </div>
    </div>
  );
}