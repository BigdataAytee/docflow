import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, Mail, Phone, Globe, FileText, Upload, CheckCircle2,
  Loader2, ArrowRight, Sparkles
} from "lucide-react";

const STEPS = ["Account", "Company", "Done"];

export default function CompanySetup() {
  const [form, setForm] = useState({
    company_name: "",
    company_address: "",
    company_email: "",
    company_phone: "",
    company_website: "",
    company_registration: "",
    default_tax_number: "",
    logo_url: "",
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: "" }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const errs = {};
    if (!form.company_name.trim()) errs.company_name = "Company name is required";
    if (!form.company_address.trim()) errs.company_address = "Company address is required";
    if (!form.company_email.trim()) errs.company_email = "Company email is required";
    if (!form.company_phone.trim()) errs.company_phone = "Company phone is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    let logo_url = form.logo_url;
    if (logoFile) {
      setUploadingLogo(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: logoFile });
      logo_url = file_url;
      setUploadingLogo(false);
    }

    await base44.auth.updateMe({
      company_name: form.company_name,
      company_address: form.company_address,
      company_email: form.company_email,
      company_phone: form.company_phone,
      company_website: form.company_website,
      company_registration: form.company_registration,
      default_tax_number: form.default_tax_number,
      logo_url,
    });

    setSaving(false);
    window.location.href = "/";
  };

  const filled = [
    form.company_name,
    form.company_address,
    form.company_email,
    form.company_phone,
  ].filter(Boolean).length;
  const progress = Math.round((filled / 4) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-500">Company Setup</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Set up your company profile</h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
            To personalise your documents and ensure all generated files include your company branding and details,
            please complete the setup below. This information will be securely saved to your account and
            automatically applied to all your documents.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Profile completion</span>
            <span className="text-xs font-bold text-indigo-600">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Fill in the required fields to complete your profile</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 space-y-5">

          {/* Logo upload */}
          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-2 block">Company Logo <span className="text-slate-400 font-normal">(optional)</span></Label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="h-6 w-6 text-slate-300" />
                )}
              </div>
              <label className="cursor-pointer flex items-center gap-2 text-sm text-indigo-600 font-medium border border-indigo-200 rounded-xl px-4 py-2 hover:bg-indigo-50 transition-colors">
                <Upload className="h-4 w-4" />
                {logoPreview ? "Change logo" : "Upload logo"}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </label>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Company Name */}
          <div className="space-y-1.5">
            <Label htmlFor="company_name" className="text-sm font-semibold text-slate-700">
              Company Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="company_name"
                value={form.company_name}
                onChange={e => set("company_name", e.target.value)}
                placeholder="Acme Ltd"
                className={`pl-10 h-11 ${errors.company_name ? "border-red-400 focus-visible:ring-red-400" : ""}`}
              />
            </div>
            {errors.company_name && <p className="text-xs text-red-500">{errors.company_name}</p>}
          </div>

          {/* Company Address */}
          <div className="space-y-1.5">
            <Label htmlFor="company_address" className="text-sm font-semibold text-slate-700">
              Company Address <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="company_address"
              value={form.company_address}
              onChange={e => set("company_address", e.target.value)}
              placeholder="123 Business St, City, Country"
              rows={2}
              className={errors.company_address ? "border-red-400 focus-visible:ring-red-400" : ""}
            />
            {errors.company_address && <p className="text-xs text-red-500">{errors.company_address}</p>}
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="company_email" className="text-sm font-semibold text-slate-700">
                Company Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="company_email"
                  type="email"
                  value={form.company_email}
                  onChange={e => set("company_email", e.target.value)}
                  placeholder="info@company.com"
                  className={`pl-10 h-11 ${errors.company_email ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                />
              </div>
              {errors.company_email && <p className="text-xs text-red-500">{errors.company_email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company_phone" className="text-sm font-semibold text-slate-700">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="company_phone"
                  value={form.company_phone}
                  onChange={e => set("company_phone", e.target.value)}
                  placeholder="+44 7700 000000"
                  className={`pl-10 h-11 ${errors.company_phone ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                />
              </div>
              {errors.company_phone && <p className="text-xs text-red-500">{errors.company_phone}</p>}
            </div>
          </div>

          {/* Optional fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="company_registration" className="text-sm font-semibold text-slate-700">
                Registration No. <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="company_registration"
                  value={form.company_registration}
                  onChange={e => set("company_registration", e.target.value)}
                  placeholder="e.g. 12345678"
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="default_tax_number" className="text-sm font-semibold text-slate-700">
                VAT / Tax Number <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="default_tax_number"
                  value={form.default_tax_number}
                  onChange={e => set("default_tax_number", e.target.value)}
                  placeholder="e.g. GB123456789"
                  className="pl-10 h-11"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company_website" className="text-sm font-semibold text-slate-700">
              Website <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="company_website"
                value={form.company_website}
                onChange={e => set("company_website", e.target.value)}
                placeholder="https://www.company.com"
                className="pl-10 h-11"
              />
            </div>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3.5">
            <CheckCircle2 className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-700 leading-relaxed">
              These details will automatically populate your invoices, quotations, receipts, and all other documents. You can update them anytime from <strong>Settings</strong>.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 h-11 text-slate-600"
              onClick={() => window.location.href = "/login"}
              disabled={saving}
            >
              ← Back to Welcome Page
            </Button>
            <Button
              className="flex-1 h-11 font-bold gap-2"
              style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6)" }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {uploadingLogo ? "Uploading logo…" : "Saving…"}</>
              ) : (
                <>Save & Continue <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Your information is stored securely and only used to personalise your documents.
        </p>
      </div>
    </div>
  );
}