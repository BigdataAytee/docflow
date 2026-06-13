import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.text();
    let payload;
    try { payload = JSON.parse(body); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

    // Support multiple providers via a "provider" query param or payload field
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") || payload.provider || "generic";
    const secret = url.searchParams.get("secret") || "";

    // ── Extract normalized fields from different provider payloads ──
    let docId = null, txnId = null, amountPaid = 0, currency = "USD", status = "paid", paymentMethod = "card", paymentRef = "";

    if (provider === "stripe") {
      const event = payload;
      if (event.type !== "checkout.session.completed" && event.type !== "payment_intent.succeeded") {
        return Response.json({ received: true });
      }
      const obj = event.data?.object || {};
      docId = obj.metadata?.document_id || obj.client_reference_id;
      txnId = obj.payment_intent || obj.id;
      amountPaid = (obj.amount_received || obj.amount_total || 0) / 100;
      currency = (obj.currency || "usd").toUpperCase();
      paymentMethod = "card";
      paymentRef = obj.metadata?.payment_reference || obj.id;
    } else if (provider === "paystack") {
      if (payload.event !== "charge.success") return Response.json({ received: true });
      const data = payload.data || {};
      docId = data.metadata?.document_id;
      txnId = data.reference;
      amountPaid = (data.amount || 0) / 100;
      currency = (data.currency || "NGN").toUpperCase();
      paymentMethod = data.channel || "card";
      paymentRef = data.reference;
    } else if (provider === "flutterwave") {
      if (payload.event !== "charge.completed") return Response.json({ received: true });
      const data = payload.data || {};
      docId = data.meta?.document_id;
      txnId = String(data.id || "");
      amountPaid = data.amount || 0;
      currency = (data.currency || "NGN").toUpperCase();
      paymentMethod = data.payment_type || "card";
      paymentRef = data.flw_ref || txnId;
    } else if (provider === "paypal") {
      const resource = payload.resource || {};
      docId = resource.custom_id || resource.invoice_id;
      txnId = resource.id;
      amountPaid = parseFloat(resource.amount?.value || 0);
      currency = (resource.amount?.currency_code || "USD").toUpperCase();
      paymentMethod = "paypal";
      paymentRef = resource.id;
    } else {
      // Generic: expect { document_id, transaction_id, amount_paid, currency, payment_method, payment_reference, secret }
      if (payload.secret !== secret && secret) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      docId = payload.document_id;
      txnId = payload.transaction_id;
      amountPaid = parseFloat(payload.amount_paid || 0);
      currency = (payload.currency || "USD").toUpperCase();
      paymentMethod = payload.payment_method || "unknown";
      paymentRef = payload.payment_reference || txnId;
    }

    if (!docId) return Response.json({ error: "Missing document_id" }, { status: 400 });

    // ── Fetch the document (service role) ──
    const doc = await base44.asServiceRole.entities.Document.get(docId);
    if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

    // ── Duplicate prevention: check if already paid ──
    if (doc.status === "paid") {
      return Response.json({ message: "Already processed", document_id: docId });
    }

    // ── Find existing payment record ──
    const existingRecords = await base44.asServiceRole.entities.PaymentRecord.filter({ document_id: docId });
    const existingRecord = existingRecords[0];

    // Verify amount (allow 1% tolerance for FX rounding)
    const expectedAmount = doc.balance_due || doc.total || 0;
    const amountOk = expectedAmount <= 0 || Math.abs(amountPaid - expectedAmount) / expectedAmount < 0.02;

    const paymentDate = new Date().toISOString();
    const finalStatus = amountOk ? "paid" : (amountPaid > 0 ? "partially_paid" : "failed");

    // ── Update or create payment record ──
    const paymentData = {
      document_id: docId,
      document_number: doc.number,
      document_type: doc.type,
      payment_status: finalStatus,
      payment_provider: provider,
      transaction_id: txnId,
      payment_date: paymentDate,
      amount_due: expectedAmount,
      amount_paid: amountPaid,
      currency: currency,
      payment_method: paymentMethod,
      payment_reference: paymentRef,
      customer_name: doc.customer_name,
      customer_email: doc.customer_email,
      webhook_payload: JSON.stringify(payload).substring(0, 2000),
    };

    let paymentRecord;
    if (existingRecord) {
      paymentRecord = await base44.asServiceRole.entities.PaymentRecord.update(existingRecord.id, paymentData);
    } else {
      paymentRecord = await base44.asServiceRole.entities.PaymentRecord.create(paymentData);
    }

    // ── Update document status ──
    await base44.asServiceRole.entities.Document.update(docId, {
      status: finalStatus,
      paid_amount: amountPaid,
      balance_due: Math.max(0, expectedAmount - amountPaid),
      payment_method: paymentMethod,
      transaction_id: txnId,
      reference_number: paymentRef,
    });

    // ── Auto-generate receipt if paid ──
    let receipt = null;
    if (finalStatus === "paid") {
      // Check for duplicate receipt
      const existingReceipts = await base44.asServiceRole.entities.Document.filter({ type: "receipt" });
      const dupeReceipt = existingReceipts.find(r => r.notes?.includes(`REF:${docId}`));

      if (!dupeReceipt) {
        // Build receipt number
        const allReceipts = await base44.asServiceRole.entities.Document.filter({ type: "receipt" }, "-created_date", 1);
        const lastNum = allReceipts.length > 0 ? parseInt((allReceipts[0].number || "0").replace(/\D/g, "") || "0") + 1 : 1;
        const receiptNum = `REC-${String(lastNum).padStart(4, "0")}`;

        receipt = await base44.asServiceRole.entities.Document.create({
          type: "receipt",
          number: receiptNum,
          status: "paid",
          customer_id: doc.customer_id || "",
          customer_name: doc.customer_name,
          customer_company: doc.customer_company || "",
          customer_email: doc.customer_email || "",
          customer_address: doc.customer_address || "",
          company_name: doc.company_name,
          company_email: doc.company_email,
          company_phone: doc.company_phone,
          company_address: doc.company_address,
          company_website: doc.company_website,
          logo_url: doc.logo_url || "",
          currency: currency,
          items: doc.items || [],
          subtotal: doc.subtotal || 0,
          tax_rate: doc.tax_rate || 0,
          tax_amount: doc.tax_amount || 0,
          total: amountPaid,
          paid_amount: amountPaid,
          balance_due: 0,
          payment_method: paymentMethod,
          transaction_id: txnId,
          reference_number: paymentRef,
          issue_date: paymentDate,
          notes: `Payment received via ${provider}. REF:${docId}\nOriginal ${doc.type}: ${doc.number}`,
          manager_name: doc.manager_name || "",
          manager_title: doc.manager_title || "",
          manager_signature: doc.manager_signature || "",
          template: doc.template || "classic",
          template_color: doc.template_color || "slate",
        });

        // Link receipt back to payment record
        await base44.asServiceRole.entities.PaymentRecord.update(paymentRecord.id, {
          receipt_id: receipt.id,
          receipt_number: receiptNum,
        });
      }
    }

    // ── Create in-app notification for all admins ──
    const admins = await base44.asServiceRole.entities.User.list();
    for (const admin of admins) {
      if (admin.role === "admin") {
        await base44.asServiceRole.entities.Notification.create({
          type: finalStatus === "paid" ? "payment_received" : (finalStatus === "failed" ? "payment_failed" : "payment_pending"),
          title: finalStatus === "paid" ? `✅ Payment Received — ${doc.number}` : `⚠️ Payment ${finalStatus} — ${doc.number}`,
          message: `${doc.customer_name} paid ${currency} ${amountPaid.toLocaleString()} for ${doc.number} via ${provider}.`,
          document_id: docId,
          document_number: doc.number,
          payment_record_id: paymentRecord.id,
          amount: amountPaid,
          currency: currency,
          customer_name: doc.customer_name,
          target_user_id: admin.id,
          is_read: false,
        });
      }
    }

    // ── Send email notifications ──
    // Notify admin
    if (doc.company_email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: doc.company_email,
        subject: `💰 Payment ${finalStatus === "paid" ? "Received" : finalStatus} — ${doc.number}`,
        body: `Hello,\n\n${finalStatus === "paid" ? "A payment has been successfully received." : `A payment attempt ${finalStatus}.`}\n\nDocument: ${doc.number}\nCustomer: ${doc.customer_name}\nAmount: ${currency} ${amountPaid.toLocaleString()}\nTransaction ID: ${txnId}\nPayment Method: ${paymentMethod}\nDate: ${new Date(paymentDate).toLocaleString()}\n${receipt ? `\nReceipt Number: ${receipt.number}` : ""}\n\nThis is an automated notification.`,
      });
    }

    // Notify customer
    if (doc.customer_email && finalStatus === "paid") {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: doc.customer_email,
        subject: `Receipt for ${doc.number} — Payment Confirmed`,
        body: `Dear ${doc.customer_name},\n\nThank you! Your payment has been received and confirmed.\n\nDocument: ${doc.number}\nAmount Paid: ${currency} ${amountPaid.toLocaleString()}\nTransaction ID: ${txnId}\nDate: ${new Date(paymentDate).toLocaleString()}\n${receipt ? `Receipt Number: ${receipt.number}\n` : ""}\nYou can view your receipt in the customer portal.\n\nThank you for your business!\n\n${doc.company_name || ""}`,
      });
    }

    return Response.json({
      success: true,
      document_id: docId,
      status: finalStatus,
      receipt_id: receipt?.id || null,
      receipt_number: receipt?.number || null,
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});