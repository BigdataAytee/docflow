import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { document_id } = await req.json();
    if (!document_id) return Response.json({ error: "Missing document_id" }, { status: 400 });

    const doc = await base44.entities.Document.get(document_id);
    if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

    // Fetch default payment provider settings
    const settings = await base44.asServiceRole.entities.PaymentSettings.filter({ is_default: true, is_enabled: true });
    const providerSettings = settings[0];

    // Generate unique payment reference
    const ref = `PAY-${doc.number}-${Date.now().toString(36).toUpperCase()}`;

    // Check if payment record already exists
    const existing = await base44.entities.PaymentRecord.filter({ document_id });
    
    let paymentLink = "";
    let provider = providerSettings?.provider || "manual";

    if (providerSettings && providerSettings.is_enabled) {
      // Build provider-specific payment link
      const amount = doc.balance_due || doc.total || 0;
      const currency = doc.currency || "USD";
      const returnUrl = providerSettings.return_url || `/documents/${document_id}`;

      if (provider === "stripe") {
        // For Stripe, we build a payment link URL with metadata
        // In production this would call Stripe API to create a checkout session
        paymentLink = `https://checkout.stripe.com/pay/${providerSettings.api_key}?amount=${Math.round(amount * 100)}&currency=${currency.toLowerCase()}&reference=${ref}&document_id=${document_id}&return_url=${encodeURIComponent(returnUrl)}`;
      } else if (provider === "paystack") {
        paymentLink = `https://paystack.com/pay/${ref}?amount=${Math.round(amount * 100)}&currency=${currency}&reference=${ref}&metadata=${encodeURIComponent(JSON.stringify({ document_id, payment_reference: ref }))}`;
      } else if (provider === "flutterwave") {
        paymentLink = `https://payment.flutterwave.com/v3/hosted/pay?tx_ref=${ref}&amount=${amount}&currency=${currency}&customer_email=${doc.customer_email || ""}&customer_name=${encodeURIComponent(doc.customer_name || "")}&meta_document_id=${document_id}&redirect_url=${encodeURIComponent(returnUrl)}`;
      } else if (provider === "paypal") {
        paymentLink = `https://www.paypal.com/invoice/p/#${ref}`;
      } else {
        paymentLink = `${returnUrl}?ref=${ref}&amount=${amount}&currency=${currency}`;
      }
    } else {
      // No provider configured — generate a generic payment page link
      paymentLink = `/documents/${document_id}?pay=true&ref=${ref}`;
    }

    // Save or update payment record
    const paymentData = {
      document_id,
      document_number: doc.number,
      document_type: doc.type,
      payment_status: "unpaid",
      payment_provider: provider,
      payment_link: paymentLink,
      payment_reference: ref,
      amount_due: doc.balance_due || doc.total || 0,
      currency: doc.currency || "USD",
      customer_name: doc.customer_name,
      customer_email: doc.customer_email || "",
      is_test: providerSettings?.test_mode ?? true,
    };

    let record;
    if (existing.length > 0) {
      record = await base44.entities.PaymentRecord.update(existing[0].id, { payment_link: paymentLink, payment_reference: ref, payment_provider: provider });
    } else {
      record = await base44.entities.PaymentRecord.create(paymentData);
    }

    return Response.json({ payment_link: paymentLink, payment_reference: ref, payment_record_id: record.id, provider });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});