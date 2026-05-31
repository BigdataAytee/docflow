import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Mail, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [
  {
    id: "gmail",
    label: "Gmail",
    icon: "🔴",
    smtp_host: "smtp.gmail.com",
    smtp_port: "587",
    imap_host: "imap.gmail.com",
    imap_port: "993",
    hint: "Gmail requires an App Password (not your regular password). Go to myaccount.google.com/apppasswords to generate one — you need 2-Step Verification enabled.",
  },
  {
    id: "outlook",
    label: "Outlook / Hotmail",
    icon: "🔵",
    smtp_host: "smtp-mail.outlook.com",
    smtp_port: "587",
    imap_host: "outlook.office365.com",
    imap_port: "993",
    hint: "Use your Microsoft account email and password.",
  },
  {
    id: "workmailtech",
    label: "workmailtech",
    icon: "🟣",
    smtp_host: "mail.workmailtech.com",
    smtp_port: "587",
    imap_host: "mail.workmailtech.com",
    imap_port: "993",
    hint: "Enter your workmailtech email and password.",
  },
  {
    id: "custom",
    label: "Custom / Other",
    icon: "⚙️",
    smtp_host: "",
    smtp_port: "587",
    imap_host: "",
    imap_port: "993",
    hint: "Enter your email provider's SMTP and IMAP server details.",
  },
];

export default function MailConnectModal({ onClose, onConnected }) {
  const [preset, setPreset] = useState(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    smtp_host: "",
    smtp_port: "587",
    imap_host: "",
    imap_port: "993",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectPreset = (p) => {
    setPreset(p);
    setForm(f => ({
      ...f,
      smtp_host: p.smtp_host,
      smtp_port: p.smtp_port,
      imap_host: p.imap_host,
      imap_port: p.imap_port,
    }));
  };

  const handleConnect = async () => {
    if (!form.email || !form.password) {
      toast.error("Email and password are required.");
      return;
    }
    setSaving(true);
    try {
      await base44.auth.updateMe({
        mail_smtp_host: form.smtp_host,
        mail_smtp_port: form.smtp_port,
        mail_smtp_user: form.email,
        mail_smtp_pass: form.password,
        mail_imap_host: form.imap_host,
        mail_imap_port: form.imap_port,
      });
      toast.success("Email account connected!");
      onConnected();
    } catch {
      toast.error("Failed to save credentials. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base">Connect Your Email</h2>
                <p className="text-xs text-white/70">Send and receive from your real mailbox</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Security note */}
          <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl p-3">
            <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <p className="text-xs text-green-800">
              Your credentials are stored securely and only used server-side to fetch and send emails. They are never exposed to the browser.
            </p>
          </div>

          {/* Provider picker */}
          {!preset && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Choose your email provider</p>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectPreset(p)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-sm font-medium text-slate-700"
                  >
                    <span className="text-xl">{p.icon}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {preset && (
            <>
              {/* Back + selected provider */}
              <div className="flex items-center gap-2">
                <button onClick={() => setPreset(null)} className="text-xs text-indigo-600 hover:underline">Back</button>
                <span className="text-slate-300">|</span>
                <span className="text-sm font-semibold text-slate-700">{preset.icon} {preset.label}</span>
              </div>

              {/* Hint */}
              {preset.hint && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  {preset.hint}
                </div>
              )}

              {/* Credentials */}
              <div className="space-y-3">
                <div>
                  <Label>Email Address</Label>
                  <Input
                    className="mt-1"
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@gmail.com"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <Label>{preset.id === "gmail" ? "App Password" : "Password"}</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder={preset.id === "gmail" ? "xxxx xxxx xxxx xxxx" : "Your password"}
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced SMTP/IMAP settings */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  {showAdvanced ? "Hide" : "Show"} advanced server settings
                </button>
                {showAdvanced && (
                  <div className="mt-3 grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4">
                    <div>
                      <Label className="text-xs">SMTP Host</Label>
                      <Input className="mt-1 text-xs" value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">SMTP Port</Label>
                      <Input className="mt-1 text-xs" value={form.smtp_port} onChange={e => setForm(f => ({ ...f, smtp_port: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">IMAP Host</Label>
                      <Input className="mt-1 text-xs" value={form.imap_host} onChange={e => setForm(f => ({ ...f, imap_host: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">IMAP Port</Label>
                      <Input className="mt-1 text-xs" value={form.imap_port} onChange={e => setForm(f => ({ ...f, imap_port: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>

              <Button
                className="w-full font-bold"
                onClick={handleConnect}
                disabled={saving || !form.email || !form.password}
                style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
              >
                {saving ? "Connecting…" : "Connect Email Account"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}