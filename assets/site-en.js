// Global English overrides for this static WordPress export.
(() => {
  try {
    document.documentElement.lang = "en";
  } catch {}

  // Map common Vietnamese UI/validation strings -> English.
  const map = new Map([
    ["Vui lòng nhập dữ liệu cho trường này.", "Please fill out this field."],
    ["Có một hoặc nhiều mục nhập có lỗi.", "One or more fields have an error."],
    ["Vui lòng kiểm tra và thử lại.", "Please check and try again."],
    ["Trường này là bắt buộc.", "This field is required."],
    ["Địa chỉ email này không hợp lệ.", "Please enter a valid email address."]
  ]);

  const t = (s) => {
    if (!s) return s;
    const x = String(s).trim();
    return map.get(x) || x;
  };

  // Browser native constraint validation (Vietnamese from browser locale)
  // We can override per-field on invalid events.
  document.addEventListener(
    "invalid",
    (ev) => {
      const el = ev.target;
      if (!el || typeof el.setCustomValidity !== "function") return;

      let msg = el.validationMessage;
      // Heuristic: if browser is Vietnamese, force common message(s) to English.
      if (msg && /Vui lòng|bắt buộc|không hợp lệ/i.test(msg)) {
        // Prefer a generic English message.
        msg = "Please fill out this field.";
      }
      el.setCustomValidity(msg || "");
    },
    true
  );

  const clearCustomValidity = (ev) => {
    const el = ev.target;
    if (!el || typeof el.setCustomValidity !== "function") return;
    el.setCustomValidity("");
  };
  document.addEventListener("input", clearCustomValidity, true);
  document.addEventListener("change", clearCustomValidity, true);

  // Contact Form 7 messages
  const applyCf7 = (root) => {
    if (!root || !(root instanceof Element)) return;

    root.querySelectorAll(".wpcf7-response-output").forEach((el) => {
      el.textContent = String(el.textContent || "")
        .split("\n")
        .map((line) => t(line))
        .join("\n");
    });

    root.querySelectorAll(".wpcf7-not-valid-tip").forEach((el) => {
      el.textContent = t(el.textContent);
    });
  };

  document.addEventListener("wpcf7invalid", (ev) => applyCf7(ev.target));
  document.addEventListener("wpcf7mailfailed", (ev) => applyCf7(ev.target));
  document.addEventListener("wpcf7failed", (ev) => applyCf7(ev.target));
  document.addEventListener("wpcf7spam", (ev) => applyCf7(ev.target));
})();

