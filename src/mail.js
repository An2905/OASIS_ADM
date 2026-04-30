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

function useBrevoApi() {
  return Boolean(process.env.BREVO_API_KEY);
}

function getTransport() {
  const brevo = useBrevoSmtp();
  const host = brevo ? "smtp-relay.brevo.com" : process.env.SMTP_HOST || "";
  if (!host) return null;
  if (cachedTransport) return cachedTransport;

  const port = brevo
    ? Number(process.env.BREVO_PORT || 587)
    : Number(process.env.SMTP_PORT || 587);
  const secure = brevo
    ? String(process.env.BREVO_SECURE || "").toLowerCase() === "true"
    : String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const timeoutMs = Number(process.env.SMTP_TIMEOUT_MS || 20000);

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

/** True only if thank-you mail can be attempted (host + From address). */
export function canSendVisitorMail() {
  return Boolean((useBrevoApi() || getTransport()) && resolveMailFrom());
}

function applyTemplateVars(s, { siteName }) {
  return String(s || "").replace(/\{siteName\}/g, String(siteName || ""));
}

function buildVisitorThankYouContent({ siteName, template }) {
  const subjectTpl = template?.subject || `Thank you — {siteName}`;
  const headerTpl = template?.header || "";
  const bodyTpl =
    template?.body ||
    "Hello,\n\nThank you for contacting {siteName}.\n\nWe have received your message and will reply within 12 business hours.\n\nBest regards,\n{siteName}";
  const footerTpl = template?.footer || "";

  const subject = applyTemplateVars(subjectTpl, { siteName }).trim() || `Thank you — ${siteName}`;
  const headerText = applyTemplateVars(headerTpl, { siteName }).trim();
  const bodyText = applyTemplateVars(bodyTpl, { siteName }).trim();
  const footerText = applyTemplateVars(footerTpl, { siteName }).trim();

  const textParts = [headerText, bodyText, footerText].filter(Boolean);
  const text = textParts.join("\n\n");

  const htmlParts = [
    headerText ? `<p>${escapeHtml(headerText).replace(/\n+/g, "<br>")}</p>` : "",
    bodyText ? `<p>${escapeHtml(bodyText).replace(/\n+/g, "<br>")}</p>` : "",
    footerText ? `<p>${escapeHtml(footerText).replace(/\n+/g, "<br>")}</p>` : ""
  ].filter(Boolean);
  const html = htmlParts.join("\n");

  return { subject, text, html };
}

async function sendViaBrevoApi({ fromEmail, fromName, toEmail, subject, text, html, replyTo }) {
  const apiKey = process.env.BREVO_API_KEY || "";
  if (!apiKey) {
    const err = new Error("BREVO_API_KEY missing");
    err.code = "BREVO_API_KEY_MISSING";
    throw err;
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.BREVO_API_TIMEOUT_MS || 15000);
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName || undefined },
        to: [{ email: toEmail }],
        subject,
        textContent: text,
        htmlContent: html,
        replyTo: replyTo ? { email: replyTo } : undefined
      }),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.message || `Brevo API error (${res.status})`);
      err.code = "BREVO_API_ERROR";
      err.status = res.status;
      err.details = data;
      throw err;
    }
    return data; // usually { messageId: "..." }
  } finally {
    clearTimeout(t);
  }
}

/**
 * Sends an automatic thank-you to the visitor.
 * Brevo: set BREVO_USER, BREVO_PASS, and MAIL_FROM (verified sender).
 * Generic SMTP: set SMTP_HOST, optional SMTP_USER/SMTP_PASS, MAIL_FROM.
 */
export async function sendVisitorThankYouEmail({ to, siteName, template }) {
  const from = resolveMailFrom();
  if (!from) {
    const err = new Error("MAIL_FROM, BREVO_FROM, or BREVO_USER required");
    err.code = "MAIL_FROM_MISSING";
    throw err;
  }

  const { subject, text, html } = buildVisitorThankYouContent({ siteName, template });

  const replyTo = process.env.MAIL_REPLY_TO || undefined;
  if (useBrevoApi()) {
    const data = await sendViaBrevoApi({
      fromEmail: from,
      fromName: siteName,
      toEmail: to,
      subject,
      text,
      html,
      replyTo
    });
    // eslint-disable-next-line no-console
    console.log("[lead-mail] visitor thank-you sent", {
      via: "brevo-api",
      toDomain: String(to).split("@")[1] || "?",
      messageId: data?.messageId || null
    });
    return;
  }

  const transport = getTransport();
  if (!transport) {
    const err = new Error("SMTP not configured");
    err.code = "SMTP_NOT_CONFIGURED";
    throw err;
  }

  const info = await transport.sendMail({ from, to, replyTo, subject, text, html });
  // eslint-disable-next-line no-console
  console.log("[lead-mail] visitor thank-you sent", {
    via: useBrevoSmtp() ? "brevo-smtp" : "smtp",
    toDomain: String(to).split("@")[1] || "?",
    messageId: info?.messageId || null,
    response: info?.response || null
  });
}

export async function sendStaffLeadNotification({ notifyTo, siteName, lead }) {
  const from = resolveMailFrom();
  if (!from || !notifyTo) return;

  const subject = `[Website contact] ${siteName}`;
  const lines = [
    `Site: ${siteName}`,
    `Email: ${lead.email}`,
    lead.name ? `Name: ${lead.name}` : null,
    lead.subject ? `Subject: ${lead.subject}` : null,
    lead.message ? `Message:\n${lead.message}` : null
  ].filter(Boolean);

  const replyTo = lead.email || undefined;
  if (useBrevoApi()) {
    const data = await sendViaBrevoApi({
      fromEmail: from,
      fromName: siteName,
      toEmail: notifyTo,
      subject,
      text: lines.join("\n\n"),
      html: `<pre style="white-space:pre-wrap">${escapeHtml(lines.join("\n\n"))}</pre>`,
      replyTo
    });
    // eslint-disable-next-line no-console
    console.log("[lead-mail] staff notification sent", {
      via: "brevo-api",
      messageId: data?.messageId || null
    });
    return;
  }

  const transport = getTransport();
  if (!transport) return;
  const info = await transport.sendMail({
    from,
    to: notifyTo,
    replyTo,
    subject,
    text: lines.join("\n\n")
  });
  // eslint-disable-next-line no-console
  console.log("[lead-mail] staff notification sent", {
    via: useBrevoSmtp() ? "brevo-smtp" : "smtp",
    messageId: info?.messageId || null,
    response: info?.response || null
  });
}
