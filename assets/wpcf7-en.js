// Translate Contact Form 7 messages to English (static export)
(() => {
  const map = new Map([
    ["Có một hoặc nhiều mục nhập có lỗi.", "One or more fields have an error."],
    ["Vui lòng kiểm tra và thử lại.", "Please check and try again."],
    ["Vui lòng nhập dữ liệu cho trường này.", "Please fill out this field."],
    ["Trường này là bắt buộc.", "This field is required."],
    ["Địa chỉ email này không hợp lệ.", "Please enter a valid email address."]
  ]);

  const t = (s) => {
    if (!s) return s;
    const x = String(s).trim();
    return map.get(x) || x;
  };

  const apply = (root) => {
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

    root.querySelectorAll(".wpcf7-not-valid").forEach((control) => {
      if (typeof control.setCustomValidity !== "function") return;
      const current = control.validationMessage;
      const next = t(current);
      if (next !== current) control.setCustomValidity(next);
    });
  };

  document.addEventListener("wpcf7invalid", (ev) => apply(ev.target));
  document.addEventListener("wpcf7mailfailed", (ev) => apply(ev.target));
  document.addEventListener("wpcf7failed", (ev) => apply(ev.target));
  document.addEventListener("wpcf7spam", (ev) => apply(ev.target));
})();

