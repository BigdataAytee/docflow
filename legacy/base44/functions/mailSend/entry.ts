import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nodemailer from 'npm:nodemailer@6.9.13';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { to_email, to_name, subject, body, reply_to_message_id } = await req.json();

    if (!user.mail_smtp_host || !user.mail_smtp_user || !user.mail_smtp_pass) {
      return Response.json({ error: 'Email not connected. Please set up your email account first.' }, { status: 400 });
    }

    const smtpPort = parseInt(user.mail_smtp_port) || 587;
    const transporter = nodemailer.createTransport({
      host: user.mail_smtp_host,
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: smtpPort === 587,
      auth: {
        user: user.mail_smtp_user,
        pass: user.mail_smtp_pass,
      },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    const mailOptions = {
      from: `${user.company_name || user.full_name || user.mail_smtp_user} <${user.mail_smtp_user}>`,
      to: to_name ? `${to_name} <${to_email}>` : to_email,
      subject,
      html: body.replace(/\n/g, '<br>'),
      text: body,
    };

    if (reply_to_message_id) {
      mailOptions.inReplyTo = reply_to_message_id;
      mailOptions.references = reply_to_message_id;
    }

    const info = await transporter.sendMail(mailOptions);

    // Log to entity
    await base44.asServiceRole.entities.Mail.create({
      to_email,
      to_name: to_name || '',
      from_email: user.mail_smtp_user,
      from_name: user.company_name || user.full_name || '',
      subject,
      body,
      status: 'sent',
      folder: 'sent',
      is_read: true,
    });

    return Response.json({ success: true, messageId: info.messageId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});