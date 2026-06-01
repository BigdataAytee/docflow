/**
 * ONBOARDING STEPS CONFIG
 * ─────────────────────────────────────────────────────────────────
 * To add a new feature to the onboarding guide, simply append a new
 * object to this array. The UI will automatically pick it up.
 *
 * Fields:
 *   id        — unique string key (never change once set)
 *   icon      — emoji shown in the step card
 *   title     — short headline
 *   body      — 1–2 sentence description
 *   cta       — label for the action button (optional)
 *   ctaPath   — route to navigate to when CTA is clicked (optional)
 *   tip       — a small pro-tip shown at the bottom (optional)
 * ─────────────────────────────────────────────────────────────────
 */

const ONBOARDING_STEPS = [
  {
    id: "welcome",
    icon: "👋",
    title: "Welcome to MyBizPad!",
    body: "Your all-in-one tool for invoices, receipts, quotations, waybills, and customer management. Let's walk you through the key features in under 2 minutes.",
    tip: "You can reopen this guide anytime from the Help Center.",
  },
  {
    id: "company_setup",
    icon: "🏢",
    title: "Set Up Your Company Profile",
    body: "Add your logo, company name, address, and contact details. These will appear automatically on every document you create.",
    cta: "Go to Settings",
    ctaPath: "/settings",
    tip: "Your signature can also be saved here under the Account tab.",
  },
  {
    id: "create_document",
    icon: "📄",
    title: "Create Your First Document",
    body: "From the Home page, tap any document type — Invoice, Quotation, Receipt, or Waybill — to get started. Fill in your customer details, add line items, and you're done.",
    cta: "Create a Document",
    ctaPath: "/documents/new",
    tip: "Use the AI Assistant (✨ button) to extract items from a photo or pasted text.",
  },
  {
    id: "customers",
    icon: "👥",
    title: "Save Your Customers",
    body: "Add customers once and reuse them on any document. Their details auto-fill when you type their name, saving you time on every invoice.",
    cta: "Manage Customers",
    ctaPath: "/customers",
    tip: "You can set a default currency per customer.",
  },
  {
    id: "templates",
    icon: "🎨",
    title: "Customise Your Document Style",
    body: "Choose from 5 professional layouts and a wide range of colour schemes. Every document can have its own unique look, or you can set a default in Settings.",
    tip: "Templates apply in real-time — preview changes instantly before saving.",
  },
  {
    id: "waybill",
    icon: "🚚",
    title: "Track Deliveries with Waybills",
    body: "Create a Waybill for any shipment. Share a signature link with your receiver so they can sign digitally on their phone, or print a paper copy for a physical signature.",
    cta: "Try a Waybill",
    ctaPath: "/documents/new",
    tip: "Once signed, a PDF with the signature locked in is automatically generated.",
  },
  {
    id: "mail",
    icon: "✉️",
    title: "Send Documents by Email",
    body: "Use the Mail section to send invoices and documents directly to customers. Connect your email in Apps & Tools to send from your own address.",
    cta: "Open Mail",
    ctaPath: "/mail",
    tip: "All sent mail is saved to your Sent folder automatically.",
  },
  {
    id: "help",
    icon: "🙋",
    title: "Help Is Always Here",
    body: "Check the Help Center for answers to common questions, tips, and guides. You can also contact support directly if you're ever stuck.",
    cta: "Visit Help Center",
    ctaPath: "/help",
    tip: "New features are added regularly — keep an eye on the Help Center for updates.",
  },
];

export default ONBOARDING_STEPS;