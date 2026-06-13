import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CreditCard, Zap, Globe, Check, Plus, Trash2, Eye, EyeOff, AlertTriangle } from "lucide-react";

const PROVIDERS = [
  { id: "stripe",      name: "Stripe",       logo: "💳", desc: "Cards, Apple Pay, Google Pay — global",       supported: ["card","apple_pay","google_pay","bank_debit"] },
  { id: "paystack",    name: "Paystack",      logo: "🟢", desc: "Cards, bank transfer — Africa focused",       supported: ["card","bank_transfer","ussd","mobile_money"] },
  { id: "flutterwave", name: "Flutterwave",   logo: "🦋", desc: "Cards, mobile money, USSD — Africa & global", supported: ["card","mobile_money","bank_transfer","ussd"] },
  { id: "paypal",      name: "PayPal",        logo: "🅿️", desc: "PayPal balance, cards — global",             supported: ["paypal","card"] },
  { id: "wise",        name: "Wise",          logo: "💚", desc: "International bank transfers",                supported: ["bank_transfer"] },
  { id: "square",      name: "Square",        logo: "⬛", desc: "Cards, in-person & online — US/UK focused",   supported: ["card","cash_app"] },
  { id: "custom",      name: "Custom / Other", logo: "🔧", desc: "Any other provider via generic webhook",     supported: ["custom"] },
];

function MaskedInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} className="pr-10" />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ProviderCard({ provider, config, onSave, onDelete }) {
  const [form, setForm] = useState(config || {
    provider: provider.id,
    display_name: provider.name,
    is_enabled: false,
    is_default: false,
    test_mode: true,
    api_key: "",
    secret_key: "",
    webhook_secret: "",
    return_url: "",
    payment_methods: ["card"],
  });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(!!config);
  const [showWebhookInfo, setShowWebhookInfo] = useState(false);

  const webhookUrl = `${window.location.origin}/api/functions/paymentWebhook?provider=${provider.id}`;

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    toast.success(`${provider.name} settings saved`);
  };

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${form.is_enabled ? "border-primary/40 shadow-sm" : "border-border"}`}>
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpanded(e => !e)}>
        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-2xl shrink-0">{provider.logo}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">{provider.name}</p>
            {form.is_default && <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">DEFAULT</span>}
            {form.test_mode && form.is_enabled && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">TEST MODE</span>}
          </div>
          <p className="text-xs text-muted-foreground">{provider.desc}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div
            onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, is_enabled: !f.is_enabled })); }}
            className={`w-10 h-6 rounded-full transition-all cursor-pointer relative ${form.is_enabled ? "bg-primary" : "bg-muted"}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${form.is_enabled ? "left-5" : "left-1"}`} />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-5 space-y-4 bg-muted/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Display Name</Label>
              <Input className="mt-1 h-9" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Mode</Label>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setForm(f => ({ ...f, test_mode: true }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${form.test_mode ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-muted text-muted-foreground border border-transparent"}`}>
                  🧪 Test
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, test_mode: false }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${!form.test_mode ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-muted text-muted-foreground border border-transparent"}`}>
                  🔴 Live
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs">API Key / Public Key</Label>
              <MaskedInput value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} placeholder={`${form.test_mode ? "pk_test_" : "pk_live_"}...`} />
            </div>
            <div>
              <Label className="text-xs">Secret Key</Label>
              <MaskedInput value={form.secret_key} onChange={e => setForm(f => ({ ...f, secret_key: e.target.value }))} placeholder={`${form.test_mode ? "sk_test_" : "sk_live_"}...`} />
            </div>
            <div>
              <Label className="text-xs">Webhook Secret</Label>
              <MaskedInput value={form.webhook_secret} onChange={e => setForm(f => ({ ...f, webhook_secret: e.target.value }))} placeholder="whsec_..." />
            </div>
            <div>
              <Label className="text-xs">Return URL (after payment)</Label>
              <Input className="mt-1 h-9" value={form.return_url} onChange={e => setForm(f => ({ ...f, return_url: e.target.value }))} placeholder="https://yourapp.com/thank-you" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Webhook URL <span className="text-muted-foreground font-normal">(paste this into your {provider.name} dashboard)</span></Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={webhookUrl} readOnly className="h-9 bg-muted/50 font-mono text-xs cursor-default" />
                <button type="button" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copied!"); }}
                  className="shrink-0 text-xs border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors">
                  Copy
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="rounded" />
              <span className="font-medium">Set as default payment provider</span>
            </label>
          </div>

          {!form.test_mode && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">You are in <strong>Live Mode</strong>. Real money will be charged. Make sure your API keys are for production.</p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Settings"}
            </Button>
            {form.is_default && config && (
              <Button size="sm" variant="destructive" onClick={() => onDelete(config.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentSettingsPanel() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.PaymentSettings.list().then(data => {
      setConfigs(data || []);
      setLoading(false);
    });
  }, []);

  const handleSave = async (form) => {
    const existing = configs.find(c => c.provider === form.provider);
    // If marking as default, un-default others
    if (form.is_default) {
      for (const c of configs) {
        if (c.is_default && c.provider !== form.provider) {
          await base44.entities.PaymentSettings.update(c.id, { is_default: false });
        }
      }
    }
    let updated;
    if (existing) {
      updated = await base44.entities.PaymentSettings.update(existing.id, form);
      setConfigs(prev => prev.map(c => c.id === existing.id ? updated : (form.is_default ? { ...c, is_default: false } : c)));
    } else {
      updated = await base44.entities.PaymentSettings.create(form);
      setConfigs(prev => [...prev.map(c => form.is_default ? { ...c, is_default: false } : c), updated]);
    }
  };

  const handleDelete = async (id) => {
    await base44.entities.PaymentSettings.delete(id);
    setConfigs(prev => prev.filter(c => c.id !== id));
    toast.success("Payment provider removed");
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading payment settings…</div>;

  return (
    <div className="space-y-5">
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <CreditCard className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-indigo-900 text-sm">Global Payment System</p>
            <p className="text-xs text-indigo-600 mt-1">Enable payment providers to automatically generate Pay Now links and QR codes on your invoices and quotations. Customers can pay online and the system updates automatically.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map(provider => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            config={configs.find(c => c.provider === provider.id) || null}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <div className="bg-muted/30 border border-border rounded-2xl p-4">
        <p className="text-xs font-semibold text-foreground mb-2">📋 How it works</p>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Enable a payment provider and add your API credentials above</li>
          <li>Each invoice/quotation gets a unique Pay Now link and QR code in the PDF</li>
          <li>Customer clicks the link → completes payment on your provider's page</li>
          <li>Provider sends a webhook to your webhook URL (listed above)</li>
          <li>System auto-marks the invoice as Paid, generates a receipt, and notifies you</li>
        </ol>
      </div>
    </div>
  );
}