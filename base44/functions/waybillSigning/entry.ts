import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { action, docId, token, pdfUrl, signature, signerName, confirmed } = body;

    // ── generateToken ── admin sends waybill for signature
    if (action === 'generateToken') {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      if (!docId) return Response.json({ error: 'docId required' }, { status: 400 });

      const doc = await base44.entities.Document.get(docId);
      if (!doc) return Response.json({ error: 'Document not found' }, { status: 404 });

      const signingToken = crypto.randomUUID();
      const origin = req.headers.get('origin') || 'https://app.base44.app';
      const signingUrl = `${origin}/waybill-sign?token=${signingToken}`;

      await base44.entities.Document.update(docId, {
        signing_token: signingToken,
        status: 'pending_signature',
        locked: true,
        pdf_url: pdfUrl || '',
      });

      // Send email if customer email exists
      if (doc.customer_email) {
        const itemsSummary = (doc.items || [])
          .slice(0, 5)
          .map(it => `• ${it.description} (×${it.quantity})`)
          .join('\n');

        await base44.integrations.Core.SendEmail({
          to: doc.customer_email,
          subject: `Signature Required: Waybill ${doc.number}`,
          body: `Dear ${doc.customer_name || 'Valued Customer'},

${doc.company_name || 'A business'} has requested your signature for the following waybill:

Waybill Number: ${doc.number}
Tracking: ${doc.tracking_number || 'N/A'}
Driver: ${doc.driver_name || 'N/A'}
Vehicle: ${doc.vehicle_number || 'N/A'}

Items:
${itemsSummary || 'See waybill for details'}

Please click the secure link below to review and sign the waybill:

${signingUrl}

This link is unique to you. Please do not share it.

If you have any questions, contact us at ${doc.company_email || doc.company_phone || 'your account manager'}.

${doc.company_name || ''}`,
        });
      }

      return Response.json({ success: true, token: signingToken, signingUrl });
    }

    // ── getByToken ── public: customer fetches doc by token
    if (action === 'getByToken') {
      if (!token) return Response.json({ error: 'token required' }, { status: 400 });

      const base44 = createClientFromRequest(req);
      const docs = await base44.asServiceRole.entities.Document.filter({ signing_token: token }, '-created_date', 1);
      if (!docs || docs.length === 0) return Response.json({ error: 'Invalid or expired link' }, { status: 404 });

      const doc = docs[0];
      // Don't expose sensitive fields
      return Response.json({
        doc: {
          id: doc.id,
          number: doc.number,
          status: doc.status,
          customer_name: doc.customer_name,
          customer_email: doc.customer_email,
          customer_phone: doc.customer_phone,
          customer_address: doc.customer_address,
          company_name: doc.company_name,
          company_address: doc.company_address,
          company_phone: doc.company_phone,
          company_email: doc.company_email,
          logo_url: doc.logo_url,
          issue_date: doc.issue_date,
          due_date: doc.due_date,
          driver_name: doc.driver_name,
          vehicle_number: doc.vehicle_number,
          tracking_number: doc.tracking_number,
          items: doc.items,
          total: doc.total,
          currency: doc.currency,
          notes: doc.notes,
          pdf_url: doc.pdf_url,
          customer_signature: doc.customer_signature,
          signed_at: doc.signed_at,
          signed_by: doc.signed_by,
          manager_signature: doc.manager_signature,
          manager_name: doc.manager_name,
          manager_title: doc.manager_title,
        }
      });
    }

    // ── submitSignature ── public: customer submits signature
    if (action === 'submitSignature') {
      if (!token || !signature) return Response.json({ error: 'token and signature required' }, { status: 400 });

      const base44 = createClientFromRequest(req);
      const docs = await base44.asServiceRole.entities.Document.filter({ signing_token: token }, '-created_date', 1);
      if (!docs || docs.length === 0) return Response.json({ error: 'Invalid link' }, { status: 404 });

      const doc = docs[0];
      if (doc.status === 'signed' || doc.status === 'delivered' || doc.status === 'archived') {
        return Response.json({ error: 'Document already signed' }, { status: 400 });
      }

      const now = new Date().toISOString();

      await base44.asServiceRole.entities.Document.update(doc.id, {
        customer_signature: signature,
        signed_by: signerName || doc.customer_name || 'Customer',
        signed_at: now,
        status: 'signed',
        receiver_name: signerName || doc.customer_name || '',
        receiver_date: now.split('T')[0],
        receiver_time: now.split('T')[1].slice(0, 5),
        delivery_signed_at: now,
      });

      // Send confirmation emails
      if (doc.customer_email) {
        await base44.integrations.Core.SendEmail({
          to: doc.customer_email,
          subject: `Waybill ${doc.number} — Signature Confirmed`,
          body: `Dear ${doc.customer_name || 'Customer'},

Your signature for Waybill ${doc.number} has been successfully recorded.

Signed by: ${signerName || doc.customer_name}
Date & Time: ${new Date(now).toLocaleString('en-GB')}

Your delivery confirmation is now complete. If you have any questions, contact ${doc.company_name || 'us'} at ${doc.company_email || doc.company_phone || ''}.

Thank you,
${doc.company_name || ''}`,
        });
      }

      if (doc.company_email) {
        await base44.integrations.Core.SendEmail({
          to: doc.company_email,
          subject: `Waybill ${doc.number} has been signed`,
          body: `Waybill ${doc.number} was signed by ${signerName || doc.customer_name} on ${new Date(now).toLocaleString('en-GB')}.

Customer: ${doc.customer_name}
Tracking: ${doc.tracking_number || 'N/A'}

Log in to your dashboard to view the signed document.`,
        });
      }

      return Response.json({ success: true });
    }

    // ── Legacy: get by docId (backward compat) ──
    if (action === 'get') {
      const base44 = createClientFromRequest(req);
      const doc = await base44.asServiceRole.entities.Document.get(docId);
      if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ doc });
    }

    // ── Legacy: sign by docId ──
    if (action === 'sign') {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.Document.update(docId, {
        customer_signature: body.signature,
        status: 'signed',
        signed_at: new Date().toISOString(),
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});