/**
 * ONBOARDING STEPS CONFIG
 * ─────────────────────────────────────────────────────────────────
 * Fields:
 *   id         — unique string key
 *   icon       — emoji
 *   category   — section label above the title
 *   title      — headline
 *   body       — 1–2 sentence description
 *   bullets    — array of short feature highlights (optional)
 *   cta        — action button label (optional)
 *   ctaPath    — route for CTA (optional)
 *   tip        — pro-tip text (optional)
 *   visual     — one of the visual keys rendered by StepVisual component
 * ─────────────────────────────────────────────────────────────────
 */

const ONBOARDING_STEPS = [
  {
    id: "welcome",
    icon: "👋",
    category: "Welcome",
    title: "Welcome to MyBizPad!",
    body: "Your all-in-one business toolkit for invoices, quotations, receipts, waybills, and customer management — all in one place.",
    bullets: [
      "Create professional documents in seconds",
      "Auto-fill customer details from your contacts",
      "Download PDFs or send by email instantly",
      "Track payments, deliveries & correspondence",
    ],
    tip: "You can re-open this guide at any time from the Help Center.",
    visual: "welcome",
  },
  {
    id: "company_setup",
    icon: "🏢",
    category: "Step 1 — Profile",
    title: "Set Up Your Company Profile",
    body: "Your company details appear on every document you create. Set them once and they auto-fill everywhere.",
    bullets: [
      "Company name, address & contact info",
      "VAT / Tax number & registration number",
      "Manager name, title & digital signature",
      "All editable anytime from Settings",
    ],
    cta: "Open Settings",
    ctaPath: "/settings",
    tip: "Save your signature in Settings → Account — it will appear on invoices and waybills.",
    visual: "company",
  },
  {
    id: "logo_branding",
    icon: "🎨",
    category: "Step 2 — Branding",
    title: "Brand Your Documents",
    body: "Upload your logo or use the built-in AI Logo Studio to generate one. Then pick a document layout and colour scheme.",
    bullets: [
      "5 professional layouts: Classic, Modern, Minimal, Bold, Elegant",
      "Wide range of brand colour schemes",
      "AI Logo Studio — generate or enhance your logo",
      "Live preview before saving",
    ],
    cta: "Open Settings",
    ctaPath: "/settings",
    tip: "Each document can have its own layout — or set a single default for consistency.",
    visual: "branding",
  },
  {
    id: "customers",
    icon: "👥",
    category: "Step 3 — Customers",
    title: "Save Your Customers",
    body: "Add customers once and their details auto-fill on every future document — no retyping.",
    bullets: [
      "Searchable dropdown with name, company & address",
      "Colour-coded initials avatars to identify duplicates",
      "Recently Used section pins your last 3 picks",
      "Tag and organise your contacts",
    ],
    cta: "Add a Customer",
    ctaPath: "/customers",
    tip: "The customer selector shows billing addresses so you can easily distinguish people with the same name.",
    visual: "customers",
  },
  {
    id: "create_document",
    icon: "📄",
    category: "Step 4 — Documents",
    title: "Create Your First Document",
    body: "Tap any document type card on the Home page to get started. Add a customer, enter line items, and you're done.",
    bullets: [
      "Invoices, Quotations, Receipts & Waybills",
      "Add line items with qty, price & discount",
      "Apply tax rates, global discounts & withholding VAT",
      "Download PDF or send by email directly",
    ],
    cta: "Create a Document",
    ctaPath: "/documents/new",
    tip: "All price and quantity fields are numeric-only — no accidental text slipping into your calculations.",
    visual: "document",
  },
  {
    id: "ai_assistant",
    icon: "✨",
    category: "Step 4b — AI Power",
    title: "Create Documents with AI",
    body: "The AI Assistant extracts line items from typed text, pasted lists, or a scanned document photo — and pre-fills your invoice instantly.",
    bullets: [
      "Type or paste any text — AI extracts items & prices",
      "Scan a document with your camera for instant OCR",
      "Review and edit extracted items before saving",
      "Works with invoices, quotations, receipts & waybills",
    ],
    cta: "Try the AI Assistant",
    ctaPath: "/documents/new",
    tip: "Tap the ✨ AI Assistant button (bottom-right of any page) to launch it — then choose Type/Paste or Scan Document.",
    visual: "document",
  },
  {
    id: "waybill",
    icon: "🚚",
    category: "Step 5 — Deliveries",
    title: "Track Deliveries with Waybills",
    body: "Create a Waybill for any shipment, then share a digital signing link with your receiver.",
    bullets: [
      "Include driver, vehicle & tracking details",
      "Share a link for digital signature on any device",
      "Print paper copies for physical signing",
      "Signed PDF generated automatically",
    ],
    cta: "Create a Waybill",
    ctaPath: "/documents/new?type=waybill",
    tip: "Once signed, the waybill locks and a PDF proof-of-delivery is saved permanently.",
    visual: "waybill",
  },
  {
    id: "mail",
    icon: "✉️",
    category: "Step 6 — Communication",
    title: "Send Documents by Email",
    body: "Email any document directly to your customer from within the app. All sent mail is saved automatically.",
    bullets: [
      "Open any document → tap the email icon",
      "Pre-filled subject and professional message",
      "Sent mail saved to your Mail folder",
      "Manage all business correspondence in one place",
    ],
    cta: "Open Mail",
    ctaPath: "/mail",
    tip: "The Mail section shows your full sent history — useful for following up with customers.",
    visual: "mail",
  },
  {
    id: "help",
    icon: "🙋",
    category: "All Done!",
    title: "Help Is Always Here",
    body: "You're all set! The Help Center has searchable FAQs, tips and guides for every feature.",
    bullets: [
      "Searchable FAQ covering all features",
      "Re-open this guide any time from the Help page",
      "Setup checklist on your Home dashboard tracks progress",
      "Smart customer picker, AI scanning & branded PDFs included",
    ],
    cta: "Visit Help Center",
    ctaPath: "/help",
    tip: "The setup checklist on your dashboard tracks your progress and links to each remaining step.",
    visual: "help",
  },
];

export default ONBOARDING_STEPS;