import nodemailer from 'nodemailer';
import { config } from '../config';

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!config.smtp.host || !config.smtp.user) return null;
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:   config.smtp.host,
    port:   config.smtp.port,
    secure: config.smtp.secure,
    auth:   { user: config.smtp.user, pass: config.smtp.pass },
  });
  return _transporter;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ messageId: string }> {
  const transporter = getTransporter();
  if (!transporter) throw new Error('SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS in .env)');

  const from = config.smtp.fromEmail
    ? `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`
    : config.smtp.user;

  const info = await transporter.sendMail({
    from,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
  });
  return { messageId: info.messageId };
}

export function isSmtpConfigured(): boolean {
  return !!(config.smtp.host && config.smtp.user && config.smtp.pass);
}
