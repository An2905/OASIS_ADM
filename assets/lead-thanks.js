// Sends automatic thank-you email via Oasis CMS after newsletter or contact submit.
(() => {
  const MSG_OK_MAIL =
    "Thank you. A confirmation email has been queued — please check your inbox (and spam folder). We will reply within 12 business hours.";
  const MSG_NO_SMTP =
    "Thank you for your message. We will reply within 12 business hours. Automatic confirmation email is not enabled on the server yet — please contact us directly if you need an immediate reply.";
  const MSG_PARTIAL =
    "Thank you for your message. We will reply within 12 business hours. If email confirmation is unavailable right now, please contact us directly.";
  const MSG_ERR =
    "Sorry, something went wrong while sending email. Please try again later or contact us directly.";

  function messageForLeadResponse(data, resOk) {
    if (!resOk) return MSG_PARTIAL;
    if (data.mailConfigured === false) return MSG_NO_SMTP;
    if (data.mailConfigured === true) return MSG_OK_MAIL;
    return MSG_PARTIAL;
  }

  async function postThankYou(payload) {
    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), 12000);
    const res = await fetch("/api/public/lead-thank-you", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      signal: ac.signal
    }).finally(() => window.clearTimeout(t));
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { res, data };
  }

  document.addEventListener(
    "submit",
    async (ev) => {
      const form = ev.target;
      if (!(form instanceof HTMLFormElement)) return;

      // Mailchimp for WordPress newsletter blocks (email-only subscribe).
      if (form.matches(".mc4wp-form")) {
        const honeypot = form.querySelector('input[name="_mc4wp_honeypot"]');
        if (honeypot && honeypot.value) return;

        // Let browser handle required email + checkbox messages.
        if (!form.reportValidity()) return;

        const emailEl = form.querySelector('input[name="EMAIL"], input[type="email"]');
        if (!emailEl) return;

        ev.preventDefault();
        ev.stopPropagation();

        const email = String(emailEl.value || "").trim();
        const box = form.querySelector(".mc4wp-response");
        const btn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (btn) btn.disabled = true;
        if (box) box.textContent = "Sending…";
        try {
          const { res, data } = await postThankYou({ email });
          const ok = res.ok && (data.sent || data.queued);
          if (box) box.textContent = messageForLeadResponse(data, ok);
          if (ok) form.reset();
        } catch {
          if (box) box.textContent = MSG_ERR;
        } finally {
          if (btn) btn.disabled = false;
        }
        return;
      }

      // Contact Form 7 (static export — WP mail endpoint missing).
      if (form.matches(".wpcf7-form")) {
        if (!form.reportValidity()) return;

        const emailEl = form.querySelector('[name="your-email"], input[type="email"]');
        if (!emailEl) return;

        ev.preventDefault();
        ev.stopPropagation();

        const fd = new FormData(form);
        const payload = {
          email: String(fd.get("your-email") || "").trim(),
          name: String(fd.get("your-name") || "").trim() || undefined,
          subject: String(fd.get("your-subject") || "").trim() || undefined,
          message: String(fd.get("your-message") || "").trim() || undefined
        };

        const out = form.querySelector(".wpcf7-response-output");
        const btn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (btn) btn.disabled = true;
        try {
          const { res, data } = await postThankYou(payload);
          if (out) {
            out.removeAttribute("aria-hidden");
            out.classList.remove("wpcf7-validation-errors", "wpcf7-spam-blocked");
            out.classList.add("wpcf7-mail-sent-ok");
            const ok = res.ok && (data.sent || data.queued);
            out.textContent = messageForLeadResponse(data, ok);
          }
          const ok = res.ok && (data.sent || data.queued);
          if (ok) form.reset();
        } catch {
          if (out) {
            out.removeAttribute("aria-hidden");
            out.classList.add("wpcf7-validation-errors");
            out.textContent = MSG_ERR;
          }
        } finally {
          if (btn) btn.disabled = false;
        }
      }
    },
    true
  );
})();
