import { useState } from "react";
import { ChevronDown, ChevronUp, Mail, BookOpen, MessageCircle, FileText, Users, Settings, PlayCircle, Palette, Truck, Search } from "lucide-react";
import OnboardingGuide from "../components/OnboardingGuide";

const FAQS = [
  {
    category: "Getting Started",
    icon: BookOpen,
    items: [
      {
        q: "How do I create my first invoice?",
        a: "Go to the Home page and click the Invoices card, then click '+ New'. Fill in your customer details, add line items with quantities and unit prices, and tap Save. You can then download as a PDF or send it directly by email.",
      },
      {
        q: "How do I set up my company profile?",
        a: "Go to Settings → Company tab. Enter your company name, address, email, phone, website and any tax/registration numbers. These details automatically appear on all your documents.",
      },
      {
        q: "How do I add my logo?",
        a: "Go to Settings → Company tab and scroll to the logo section. Upload an existing image file, or click 'AI Logo Studio' to generate a professional logo using AI. Once saved, your logo appears on every document.",
      },
      {
        q: "Can I come back to the Getting Started guide?",
        a: "Yes! Scroll down on this page and click 'Reopen Getting Started Guide'. The full step-by-step walkthrough will open. You can also track your setup progress using the checklist on the Home dashboard.",
      },
    ],
  },
  {
    category: "Documents",
    icon: FileText,
    items: [
      {
        q: "What is the difference between an Invoice and a Quotation?",
        a: "A Quotation is a price estimate sent before work begins — the customer can accept or reject it. An Invoice is a formal payment request issued after goods or services are delivered. You can convert a Quotation to an Invoice with one click from the document view.",
      },
      {
        q: "How do I record a payment on an invoice?",
        a: "Open the invoice and click Edit. Enter the amount paid in the 'Amount Paid' field — the balance due will update automatically. You can also change the status to 'Paid' or 'Partially Paid' directly from the status dropdown.",
      },
      {
        q: "How do I download a document as a PDF?",
        a: "Open any document and click the download icon in the toolbar. A high-quality PDF will be generated and downloaded to your device.",
      },
      {
        q: "How do I send a document by email?",
        a: "Open any document and click the email icon. A compose window will open pre-filled with your customer's email and a professional message. You can edit the subject and body before sending.",
      },
      {
        q: "Can I add taxes and discounts to a document?",
        a: "Yes. When editing a document, you can set a tax rate (e.g. VAT at 20%), a global discount percentage, and per-line discounts. The totals, tax amount, and balance due are all calculated automatically.",
      },
    ],
  },
  {
    category: "Waybills & Deliveries",
    icon: Truck,
    items: [
      {
        q: "How do Waybills work?",
        a: "A Waybill is a delivery tracking document. Create one with your shipment details, then share the unique signature link with your receiver. They can open it on any phone or computer and sign digitally. The signed waybill is then locked and a PDF is generated automatically.",
      },
      {
        q: "What happens after a waybill is signed?",
        a: "Once the receiver signs, the waybill status changes to 'Delivered' and the signature is permanently embedded. You can download the signed PDF at any time as a proof of delivery.",
      },
    ],
  },
  {
    category: "Customers",
    icon: Users,
    items: [
      {
        q: "How do I save a customer for future use?",
        a: "Go to Customers and click 'Add Customer'. Fill in their name, email, address and other details. Next time you create a document, start typing their name and select them from the autocomplete — all their details will auto-fill.",
      },
      {
        q: "Can I set a default currency per customer?",
        a: "Yes. Open a customer record and edit it. Set their preferred currency and it will be pre-selected whenever you create a new document for that customer.",
      },
      {
        q: "Can I store shipping details separately from billing?",
        a: "Yes. Each customer has both a Billing Address and a separate Shipping Address. These can be set independently when editing the customer record.",
      },
    ],
  },
  {
    category: "Document Design & Templates",
    icon: Palette,
    items: [
      {
        q: "How do I customise the look of my documents?",
        a: "When creating or editing a document, open the Template panel. Choose from 5 layouts: Classic, Modern, Minimal, Bold, or Elegant. Then pick a colour scheme and font. Changes preview in real-time.",
      },
      {
        q: "Can I set a default template for all my documents?",
        a: "Yes. Go to Settings → Document Design and set your preferred default template, colour and font. All new documents will use these defaults, but you can always override on individual documents.",
      },
      {
        q: "How does the AI Logo Studio work?",
        a: "Go to Settings → Company tab and click 'AI Logo Studio'. Enter your company name, choose an industry, style and colour, and the AI will generate a professional logo in seconds. You can also upload your existing logo and use the Enhance tab to polish, recolour or modernise it.",
      },
    ],
  },
  {
    category: "Settings & Account",
    icon: Settings,
    items: [
      {
        q: "How do I set up automatic document numbering?",
        a: "Go to Settings → Numbering. Set a prefix (e.g. INV-), a starting number, and the auto-increment option. The next document number is shown as a live preview as you type.",
      },
      {
        q: "How do I save my signature?",
        a: "Go to Settings → Account. Scroll to the signature section and use the signature pad to draw your signature, then save. It will be available to add to invoices and waybills.",
      },
      {
        q: "How do I change my account details?",
        a: "Go to Settings → Account to update your display name and personal details. Company-related information is managed separately under Settings → Company.",
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
        <span className="text-sm font-semibold text-slate-800">{q}</span>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <p className="text-sm text-muted-foreground pb-4 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export default function Help() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [search, setSearch] = useState("");

  const filteredFaqs = search.trim().length > 1
    ? FAQS.map(section => ({
        ...section,
        items: section.items.filter(
          item =>
            item.q.toLowerCase().includes(search.toLowerCase()) ||
            item.a.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(section => section.items.length > 0)
    : FAQS;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black">Help Center</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Find answers to common questions and learn how to get the most from the app.
        </p>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search help articles…"
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
            />
          </div>

          {/* Reopen guide */}
          <button
            onClick={() => setShowOnboarding(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 rounded-xl px-4 py-2 hover:bg-indigo-100 transition-colors whitespace-nowrap"
          >
            <PlayCircle className="h-4 w-4" /> Reopen Getting Started Guide
          </button>
        </div>
      </div>

      {/* FAQ sections */}
      <div className="space-y-5">
        {filteredFaqs.length === 0 ? (
          <div className="bg-white border border-border rounded-2xl px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">No results found for <strong>"{search}"</strong></p>
          </div>
        ) : (
          filteredFaqs.map(section => (
            <div key={section.category} className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/30">
                <section.icon className="h-4 w-4 text-primary" />
                <h2 className="font-bold text-sm">{section.category}</h2>
                <span className="ml-auto text-xs text-muted-foreground">{section.items.length} articles</span>
              </div>
              <div className="px-6">
                {section.items.map(item => (
                  <FAQItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showOnboarding && <OnboardingGuide forceOpen onClose={() => setShowOnboarding(false)} />}

      {/* Contact card */}
      <div className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
          <MessageCircle className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-indigo-900">Still need help?</p>
          <p className="text-xs text-indigo-700 mt-0.5">
            Can't find what you're looking for? Reach out and we'll get back to you as soon as possible.
          </p>
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