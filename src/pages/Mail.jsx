import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Mail as MailIcon, Loader2, User, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function Mail() {
  const [customers, setCustomers] = useState([]);
  const [sent, setSent] = useState([]);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ customer_id: "", to_email: "", to_name: "", subject: "", body: "" });

  useEffect(() => {
    base44.entities.Customer.list("-created_date", 100).then(setCustomers);
    base44.entities.Mail.list("-created_date", 50).then(setSent);
  }, []);

  const selectCustomer = (id) => {
    const c = customers.find(x => x.id === id);
    if (c) setForm(f => ({ ...f, customer_id: id, to_email: c.email || "", to_name: c.full_name }));
  };

  const handleSend = async () => {
    if (!form.to_email || !form.subject || !form.body) return;
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: form.to_email,
        subject: form.subject,
        body: form.body,
        from_name: form.to_name ? undefined : undefined,
      });
      await base44.entities.Mail.create({ ...form, status: "sent" });
      const updated = await base44.entities.Mail.list("-created_date", 50);
      setSent(updated);
      setForm({ customer_id: "", to_email: "", to_name: "", subject: "", body: "" });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      await base44.entities.Mail.create({ ...form, status: "failed" });
    }
    setSending(false);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mail</h1>
        <p className="text-sm text-muted-foreground">Compose and send emails to your customers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Compose */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
            <MailIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Compose Email</h2>
          </div>
          <div className="p-5 space-y-4">
            {/* Customer picker */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Select Customer (optional)</Label>
              <Select value={form.customer_id} onValueChange={selectCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a customer to auto-fill..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}{c.company_name ? ` — ${c.company_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">To Name</Label>
                <Input value={form.to_name} onChange={e => setForm(f => ({ ...f, to_name: e.target.value }))} placeholder="Recipient name" />
              </div>
              <div>
                <Label className="text-xs">To Email <span className="text-destructive">*</span></Label>
                <Input type="email" value={form.to_email} onChange={e => setForm(f => ({ ...f, to_email: e.target.value }))} placeholder="email@example.com" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Subject <span className="text-destructive">*</span></Label>
              <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Email subject..." />
            </div>

            <div>
              <Label className="text-xs">Message <span className="text-destructive">*</span></Label>
              <Textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                rows={10}
                placeholder="Write your message here..."
                className="resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              {success && <p className="text-sm text-emerald-600 font-medium">✓ Email sent successfully!</p>}
              {!success && <span />}
              <Button
                onClick={handleSend}
                disabled={sending || !form.to_email || !form.subject || !form.body}
              >
                {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-2" />Send Email</>}
              </Button>
            </div>
          </div>
        </div>

        {/* Sent History */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              Sent ({sent.length})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {sent.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <MailIcon className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No emails sent yet</p>
              </div>
            )}
            {sent.map(m => (
              <div key={m.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{m.to_name || m.to_email}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    m.status === "sent" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  }`}>{m.status}</span>
                </div>
                <p className="text-xs font-medium text-foreground truncate mb-0.5">{m.subject}</p>
                <p className="text-xs text-muted-foreground truncate">{m.body?.replace(/<[^>]+>/g, "").slice(0, 80)}...</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {m.created_date ? format(new Date(m.created_date), "dd MMM yyyy, h:mm a") : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}