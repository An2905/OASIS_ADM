// Sends automatic thank-you email via Oasis CMS after newsletter or contact submit.
(() => {
  const MSG_OK =
    "Thank you. We have sent a confirmation email — please check your inbox (and spam folder). We will reply within 12 business hours.";
  const MSG_PARTIAL =
    "Thank you for your message. We will reply within 12 business hours. If email confirmation is unavailable right now, please contact us directly.";
  const MSG_ERR =
    "Sorry, something went wrong while sending email. Please try again later or contact us directly.";

  async function postThankYou(payload) {
    const res = await fetch("/api/public/lead-thank-you", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin"
    });
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

        const agree = form.querySelector('input[name="AGREE_TO_TERMS"]');
        if (agree && agree.required && !agree.checked) return;

        const emailEl = form.querySelector('input[name="EMAIL"], input[type="email"]');
        if (!emailEl) return;
        if (!emailEl.checkValidity()) {
          emailEl.reportValidity();
          return;
        }

        ev.preventDefault();
        ev.stopPropagation();

        const email = String(emailEl.value || "").trim();
        const box = form.querySelector(".mc4wp-response");
        try {
          const { res, data } = await postThankYou({ email });
          if (box) box.textContent = res.ok && data.sent ? MSG_OK : MSG_PARTIAL;
          if (res.ok && data.sent) form.reset();
        } catch {
          if (box) box.textContent = MSG_ERR;
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
        try {
          const { res, data } = await postThankYou(payload);
          if (out) {
            out.removeAttribute("aria-hidden");
            out.classList.remove("wpcf7-validation-errors", "wpcf7-spam-blocked");
            out.classList.add("wpcf7-mail-sent-ok");
            out.textContent = res.ok && data.sent ? MSG_OK : MSG_PARTIAL;
          }
          if (res.ok && data.sent) form.reset();
        } catch {
          if (out) {
            out.removeAttribute("aria-hidden");
            out.classList.add("wpcf7-validation-errors");
            out.textContent = MSG_ERR;
          }
        }
      }
    },
    true
  );
})();
