/**
 * ONBOARDING STEPS CONFIG
 * ─────────────────────────────────────────────────────────────────
 * Each step has:
 *   id        — unique string key
 *   icon      — emoji shown in the step card
 *   title     — short headline
 *   body      — 1–2 sentence description
 *   cta       — label for the action button (optional)
 *   ctaPath   — route to navigate to when CTA is clicked (optional)
 *   tip       — a small pro-tip shown at the bottom (optional)
 *   category  — section label displayed above the step title
 * ─────────────────────────────────────────────────────────────────
 */

const ONBOARDING_STEPS = [
  {
    id: "welcome",
    icon: "👋",
    category: "Welcome",
    title: "Welcome to MyBizPad!",
    body: "Your all-in-one tool for professional invoicing, quotations, receipts, waybills, and customer management. This quick guide will have you up and running in under 2 minutes.",
    tip: "You can re-open this guide at any time from the Help Center.",
  },
  {
    id: "company_setup",
    icon: "🏢",
    category: "Step 1 — Profile",
    title: "Set Up Your Company Profile",
    body: "Add your company name, address, phone, email, and logo. This information will automatically appear on every document you create — no need to re-enter it each time.",
    cta: "Open Settings",
    ctaPath: "/settings",
    tip: "You can also save your manager signature in Settings → Account for use on documents.",
  },
  {
    id: "logo_branding",
    icon: "🎨",
    category: "Step 2 — Branding",
    title: "Brand Your Documents",
    body: "Upload your logo or use the AI Logo Studio to generate one. Then choose from 5 professional document layouts — Classic, Modern, Minimal, Bold, or Elegant — and pick a colour scheme that matches your brand.",
    cta: "Go to Settings",
    ctaPath: "/settings",
    tip: "Design changes are previewed in real-time before you save. Every document can use a different style.",
  },
  {
    id: "customers",
    icon: "👥",
    category: "Step 3 — Customers",
    title: "Add Your Customers",
    body: "Save customer names, emails, addresses and preferred currencies once. When creating a document, just start typing their name and their details will auto-fill — saving you time on every invoice.",
    cta: "Add a Customer",
    ctaPath: "/customers",
    tip: "You can set a default currency per customer so it's always pre-selected on new documents.",
  },
  {
    id: "create_document",
    icon: "📄",
    category: "Step 4 — Documents",
    title: "Create Your First Document",
    body: "From the Home page, tap any card — Invoice, Quotation, Receipt, or Waybill — to create a new document. Add your customer, enter line items with quantities and prices, and save. Download as PDF or send by email directly.",
    cta: "Create a Document",
    ctaPath: "/documents/new",
    tip: "Use the AI Assistant (✨ button) to extract line items from a photo of a receipt or pasted text.",
  },
  {
    id: "waybill",
    icon: "🚚",
    category: "Step 5 — Deliveries",
    title: "Track Deliveries with Waybills",
    body: "Create a Waybill for any shipment. Share the signature link with your receiver so they can sign digitally on their phone — or print a paper copy for a physical signature.",
    cta: "Create a Waybill",
    ctaPath: "/documents/new?type=waybill",
    tip: "Once signed, the waybill is automatically locked and a PDF is generated with the signature included.",
  },
  {
    id: "mail",
    icon: "✉️",
    category: "Step 6 — Communication",
    title: "Send Documents by Email",
    body: "Open any document and tap the email icon to send it directly to your customer. Use the Mail section to manage all your business correspondence in one place.",
    cta: "Open Mail",
    ctaPath: "/mail",
    tip: "Every email you send is automatically saved to your Sent folder for easy reference.",
  },
  {
    id: "help",
    icon: "🙋",
    category: "All Done!",
    title: "Help Is Always Available",
    body: "Check the Help Center for FAQs, tips, and guides. You can re-open this walkthrough at any time, or browse the checklist on your dashboard to track your setup progress.",
    cta: "Visit Help Center",
    ctaPath: "/help",
    tip: "New features are added regularly — the Help Center is always kept up to date.",
  },
];

export default ONBOARDING_STEPS;