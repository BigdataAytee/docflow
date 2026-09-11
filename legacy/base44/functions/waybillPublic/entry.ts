import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, docId, signature } = body;

    if (!docId) {
      return Response.json({ error: 'Missing docId' }, { status: 400 });
    }

    if (action === 'get') {
      const doc = await base44.asServiceRole.entities.Document.get(docId);
      if (!doc || doc.type !== 'waybill') {
        return Response.json({ error: 'Document not found or not a waybill' }, { status: 404 });
      }
      return Response.json({ doc });
    }

    if (action === 'sign') {
      if (!signature) {
        return Response.json({ error: 'Missing signature' }, { status: 400 });
      }
      const doc = await base44.asServiceRole.entities.Document.get(docId);
      if (!doc || doc.type !== 'waybill') {
        return Response.json({ error: 'Document not found or not a waybill' }, { status: 404 });
      }
      await base44.asServiceRole.entities.Document.update(docId, { customer_signature: signature });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});