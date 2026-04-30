import nodemailer from "nodemailer";

let cachedTransport = null;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function useBrevoSmtp() {
  return Boolean(process.env.BREVO_USER && process.env.BREVO_PASS);
}

function getTransport() {
  const brevo = useBrevoSmtp();
  const host = brevo ? "smtp-relay.brevo.com" : process.env.SMTP_HOST || "";
  if (!host) return null;
  if (cachedTransport) return cachedTransport;

  const port = brevo ? 587 : Number(process.env.SMTP_PORT || 587);
  const secure = brevo
    ? false
    : String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const timeoutMs = Number(process.env.SMTP_TIMEOUT_MS || 8000);

  const auth = brevo
    ? { user: process.env.BREVO_USER, pass: process.env.BREVO_PASS }
    : process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined;

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    auth
  });
  return cachedTransport;
}

/** Verified sender address (must match Brevo / SMTP verified sender). */
function resolveMailFrom() {
  return (
    process.env.MAIL_FROM ||
    process.env.BREVO_FROM ||
    process.env.BREVO_USER ||
    process.env.SMTP_USER ||
    ""
  );
}

export function isSmtpConfigured() {
  return Boolean(getTransport());
}

/**
 * Sends an automatic thank-you to the visitor.
 * Brevo: set BREVO_USER, BREVO_PASS, and MAIL_FROM (verified sender).
 * Generic SMTP: set SMTP_HOST, optional SMTP_USER/SMTP_PASS, MAIL_FROM.
 */
export async function sendVisitorThankYouEmail({ to, siteName }) {
  const transport = getTransport();
  const from = resolveMailFrom();
  if (!transport) {
    const err = new Error("SMTP not configured");
    err.code = "SMTP_NOT_CONFIGURED";
    throw err;
  }
  if (!from) {
    const err = new Error("MAIL_FROM, BREVO_FROM, or BREVO_USER required");
    err.code = "MAIL_FROM_MISSING";
    throw err;
  }

  const subject = `Thank you — ${siteName}`;
  const text = [
    `Hello,`,
    ``,
    `Thank you for contacting ${siteName}.`,
    ``,
    `We have received your message and will reply within 12 business hours.`,
    ``,
    `Best regards,`,
    `${siteName}`
  ].join("\n");

  const html = `<p>Hello,</p>
<p>Thank you for contacting <strong>${escapeHtml(siteName)}</strong>.</p>
<p>We have received your message and will reply within <strong>12 business hours</strong>.</p>
<p>Best regards,<br>${escapeHtml(siteName)}</p>`;

  await transport.sendMail({
    from,
    to,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
    subject,
    text,
    html
  });
}

export async function sendStaffLeadNotification({ notifyTo, siteName, lead }) {
  const transport = getTransport();
  const from = resolveMailFrom();
  if (!transport || !from || !notifyTo) return;

  const subject = `[Website contact] ${siteName}`;
  const lines = [
    `Site: ${siteName}`,
    `Email: ${lead.email}`,
    lead.name ? `Name: ${lead.name}` : null,
    lead.subject ? `Subject: ${lead.subject}` : null,
    lead.message ? `Message:\n${lead.message}` : null
  ].filter(Boolean);

  await transport.sendMail({
    from,
    to: notifyTo,
    replyTo: lead.email || undefined,
    subject,
    text: lines.join("\n\n")
  });
}
