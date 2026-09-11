import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { ImapFlow } from 'npm:imapflow@1.0.162';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.mail_imap_host || !user.mail_smtp_user || !user.mail_smtp_pass) {
      return Response.json({ error: 'Email not connected.' }, { status: 400 });
    }

    const { folder = 'INBOX', limit = 100 } = await req.json().catch(() => ({}));

    const client = new ImapFlow({
      host: user.mail_imap_host,
      port: parseInt(user.mail_imap_port) || 993,
      secure: parseInt(user.mail_imap_port) !== 143,
      auth: {
        user: user.mail_smtp_user,
        pass: user.mail_smtp_pass,
      },
      tls: { rejectUnauthorized: false },
      logger: false,
    });

    await client.connect();

    const mailbox = await client.mailboxOpen(folder);
    const totalMessages = mailbox.exists;

    const messages = [];
    if (totalMessages > 0) {
      const fetchLimit = Math.min(limit, totalMessages);
      const from = Math.max(1, totalMessages - fetchLimit + 1);

      // Only fetch envelope + flags — no body download to avoid stream issues
      for await (const msg of client.fetch(`${from}:${totalMessages}`, {
        uid: true,
        flags: true,
        envelope: true,
      })) {
        const env = msg.envelope || {};
        const from_addr = env.from?.[0] || {};
        const to_addr = env.to?.[0] || {};

        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          subject: env.subject || '(no subject)',
          from_email: from_addr.address || '',
          from_name: from_addr.name || from_addr.address || '',
          to_email: to_addr.address || '',
          to_name: to_addr.name || '',
          date: env.date ? new Date(env.date).toISOString() : new Date().toISOString(),
          is_read: msg.flags?.has('\\Seen') ?? false,
          is_starred: msg.flags?.has('\\Flagged') ?? false,
          body: '',
          folder: folder === 'INBOX' ? 'inbox' : folder.toLowerCase(),
        });
      }
    }

    await client.logout();

    return Response.json({ messages: messages.reverse(), total: totalMessages });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});