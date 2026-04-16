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

  // Fix reservation guest summary text (some exports show "Guests Adult, 0 Children")
  const normalizeGuestSummary = (s) => {
    let x = String(s || "").replace(/\s+/g, " ").trim();
    if (!x) return x;

    // If it starts with "Guests", drop that prefix (UI already indicates it's guests)
    x = x.replace(/^Guests?\s*/i, "");

    // If adult count is missing, assume 1 (common default)
    // Examples:
    // - "Adult, 0 Children" -> "1 Adult, 0 Children"
    // - "Adults, 0 Children" -> "1 Adult, 0 Children"
    if (/^(Adult|Adults)\s*,/i.test(x)) x = x.replace(/^(Adult|Adults)\s*,/i, "1 Adult,");

    // Normalize pluralization: "1 Adults" -> "1 Adult", "1 Children" -> "1 Child"
    x = x.replace(/\b1\s+Adults\b/i, "1 Adult");
    x = x.replace(/\b1\s+Children\b/i, "1 Child");

    return x;
  };

  const fixGuestInputs = (root) => {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('input[id$="-guests"][readonly], input[id*="-guests"][readonly]').forEach((inp) => {
      const v = inp.value;
      const next = normalizeGuestSummary(v);
      if (next && next !== v) inp.value = next;
    });
  };

  // Run once and keep in sync if scripts update values later.
  fixGuestInputs(document);
  const mo = new MutationObserver(() => fixGuestInputs(document));
  mo.observe(document.documentElement, { subtree: true, childList: true });
  document.addEventListener(
    "input",
    (e) => {
      const t = e.target;
      if (t && t.tagName === "INPUT") fixGuestInputs(document);
    },
    true
  );
})();

