import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function Settings() {
  const [form, setForm] = useState({
    company_name: "",
    company_email: "",
    company_phone: "",
    company_address: "",
    default_currency: "USD",
    default_tax_rate: 0,
    default_terms: "",
    default_payment_instructions: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user) setForm(f => ({
        ...f,
        company_name: user.company_name || "",
        company_email: user.company_email || user.email || "",
        company_phone: user.company_phone || "",
        company_address: user.company_address || "",
        default_currency: user.default_currency || "USD",
        default_tax_rate: user.default_tax_rate || 0,
        default_terms: user.default_terms || "",
        default_payment_instructions: user.default_payment_instructions || "",
      }));
    });
  }, []);

  const save = async () => {
    setSaving(true);
    await base44.auth.updateMe(form);
    setSaving(false);
    toast.success("Settings saved");
  };

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-sm text-muted-foreground mb-8">Configure your company details and defaults</p>

      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <h2 className="font-semibold">Company Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Company Name</Label><Input value={form.company_name} onChange={e => update("company_name", e.target.value)} /></div>
          <div><Label>Email</Label><Input value={form.company_email} onChange={e => update("company_email", e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={form.company_phone} onChange={e => update("company_phone", e.target.value)} /></div>
          <div><Label>Default Currency</Label><Input value={form.default_currency} onChange={e => update("default_currency", e.target.value)} /></div>
        </div>
        <div><Label>Address</Label><Textarea value={form.company_address} onChange={e => update("company_address", e.target.value)} rows={2} /></div>

        <h2 className="font-semibold pt-4">Document Defaults</h2>
        <div><Label>Default Tax Rate (%)</Label><Input type="number" value={form.default_tax_rate} onChange={e => update("default_tax_rate", +e.target.value)} className="max-w-[120px]" /></div>
        <div><Label>{"Default Terms & Conditions"}</Label><Textarea value={form.default_terms} onChange={e => update("default_terms", e.target.value)} rows={3} /></div>
        <div><Label>Default Payment Instructions</Label><Textarea value={form.default_payment_instructions} onChange={e => update("default_payment_instructions", e.target.value)} rows={3} /></div>

        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
      </div>
    </div>
  );
}