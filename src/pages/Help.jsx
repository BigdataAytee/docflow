import { useState } from "react";
import { ChevronDown, ChevronUp, Mail, BookOpen, MessageCircle, FileText, Users, Settings, PlayCircle } from "lucide-react";
import OnboardingGuide from "../components/OnboardingGuide";

const FAQS = [
  {
    category: "Getting Started",
    icon: BookOpen,
    items: [
      {
        q: "How do I create my first invoice?",
        a: "Go to the Home page and click the Invoice card, or navigate to Documents and click 'New Document'. Fill in your customer details, add line items, and save. You can then download as PDF or share directly.",
      },
      {
        q: "How do I add my company logo and details?",
        a: "Go to Settings → Company tab. Upload your logo, fill in your company name, address, email, and phone. These will automatically appear on all new documents.",
      },
      {
        q: "Can I customise the look of my documents?",
        a: "Yes! When creating or editing a document, use the Template & Color selector to choose from 5 layouts (Classic, Modern, Minimal, Bold, Elegant) and multiple colour schemes.",
      },
    ],
  },
  {
    category: "Documents",
    icon: FileText,
    items: [
      {
        q: "What is the difference between an Invoice and a Quotation?",
        a: "A Quotation is a price estimate sent before work begins. An Invoice is a payment request after goods or services are delivered. You can convert a Quotation to an Invoice with one click.",
      },
      {
        q: "How do I record a payment on an invoice?",
        a: "Open the invoice, click Edit, and enter the amount paid in the 'Amount Paid' field. The balance due will update automatically. You can also change the status to 'Paid'.",
      },
      {
        q: "How do Waybills work?",
        a: "A Waybill tracks delivery. Create one, then share the signature link with your receiver so they can sign digitally on their phone — or print a Paper Signage copy for a physical signature.",
      },
    ],
  },
  {
    category: "Customers",
    icon: Users,
    items: [
      {
        q: "How do I save a customer for future use?",
        a: "Go to Customers and click 'Add Customer'. Fill in their details and save. Next time you create a document, start typing their name and select them from the auto-complete list.",
      },
      {
        q: "Can I set a default currency per customer?",
        a: "Yes. Open a customer record, edit it, and set their preferred currency. When you create a document for them, it will default to that currency.",
      },
    ],
  },
  {
    category: "Settings & Account",
    icon: Settings,
    items: [
      {
        q: "How do I set up automatic document numbering?",
        a: "Go to Settings → Numbering. You can set a prefix (e.g. INV-), a starting number, and choose whether to auto-increment. The next document number is shown as a preview.",
      },
      {
        q: "How do I connect Google Drive to auto-save PDFs?",
        a: "Go to Settings → Integrations. Enable the Google Drive toggle, load your folders, pick a destination, and save. Every invoice and receipt you open will be auto-saved as a PDF to that folder.",
      },
    ],
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left hover:text-primary transition-colors"
      >
        <span className="text-sm font-medium">{q}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <p className="text-sm text-muted-foreground pb-4 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export default function Help() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black">Help Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Find answers to common questions and learn how to get the most from the app.</p>
        <button
          onClick={() => setShowOnboarding(true)}
          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 rounded-xl px-4 py-2 hover:bg-indigo-100 transition-colors"
        >
          <PlayCircle className="h-4 w-4" /> Reopen Getting Started Guide
        </button>
      </div>

      {/* FAQ sections */}
      <div className="space-y-6">
        {FAQS.map(section => (
          <div key={section.category} className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/30">
              <section.icon className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-sm">{section.category}</h2>
            </div>
            <div className="px-6">
              {section.items.map(item => (
                <FAQItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {showOnboarding && <OnboardingGuide forceOpen onClose={() => setShowOnboarding(false)} />}

      {/* Contact card */}
      <div className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
          <MessageCircle className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-indigo-900">Still need help?</p>
          <p className="text-xs text-indigo-700 mt-0.5">Can't find what you're looking for? Reach out and we'll get back to you.</p>
        </div>
        <a
          href="mailto:support@mybizpad.com"
          className="flex items-center gap-2 text-sm font-semibold text-indigo-700 border border-indigo-300 bg-white rounded-xl px-4 py-2 hover:bg-indigo-50 transition-colors shrink-0"
        >
          <Mail className="h-4 w-4" /> Contact Support
        </a>
      </div>
    </div>
  );
}