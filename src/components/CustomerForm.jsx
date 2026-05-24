import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function CustomerForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    full_name: initial?.full_name || "",
    company_name: initial?.company_name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    billing_address: initial?.billing_address || "",
    shipping_name: initial?.shipping_name || "",
    shipping_company: initial?.shipping_company || "",
    shipping_email: initial?.shipping_email || "",
    shipping_phone: initial?.shipping_phone || "",
    shipping_address: initial?.shipping_address || "",
    tax_number: initial?.tax_number || "",
    country: initial?.country || "",
    currency: initial?.currency || "USD",
    notes: initial?.notes || "",
  });

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Full Name *</Label><Input value={form.full_name} onChange={e => update("full_name", e.target.value)} /></div>
        <div><Label>Company</Label><Input value={form.company_name} onChange={e => update("company_name", e.target.value)} /></div>
        <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => update("email", e.target.value)} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={e => update("phone", e.target.value)} /></div>
        <div><Label>Country</Label><Input value={form.country} onChange={e => update("country", e.target.value)} /></div>
        <div><Label>Tax/VAT Number</Label><Input value={form.tax_number} onChange={e => update("tax_number", e.target.value)} /></div>
      </div>

      {/* Sold To */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sold To</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={form.full_name} onChange={e => update("full_name", e.target.value)} /></div>
          <div><Label>Company</Label><Input value={form.company_name} onChange={e => update("company_name", e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => update("email", e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => update("phone", e.target.value)} /></div>
        </div>
        <div><Label>Address</Label><Textarea value={form.billing_address} onChange={e => update("billing_address", e.target.value)} rows={2} /></div>
      </div>


      <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => update("notes", e.target.value)} rows={2} /></div>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={!form.full_name}>Save Customer</Button>
      </div>
    </div>
  );
}