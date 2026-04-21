async function loadCmsSettings() {
  const res = await fetch("/api/public/settings", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load settings");
  return await res.json();
}

function setText(selectorOrEl, text) {
  const el = typeof selectorOrEl === "string" ? document.querySelector(selectorOrEl) : selectorOrEl;
  if (!el) return;
  el.textContent = text;
}

function setAttr(el, attr, value) {
  if (!el) return;
  if (value == null || value === "") return;
  el.setAttribute(attr, value);
}

function applySettingsToDom(settings) {
  // Generic: data-cms-text="key"
  document.querySelectorAll("[data-cms-text]").forEach((el) => {
    const key = el.getAttribute("data-cms-text");
    if (!key) return;
    if (settings[key] == null) return;
    el.textContent = String(settings[key]);
  });

  // Generic: data-cms-href="key"
  document.querySelectorAll("[data-cms-href]").forEach((el) => {
    const key = el.getAttribute("data-cms-href");
    if (!key) return;
    if (settings[key] == null) return;
    el.setAttribute("href", String(settings[key]));
  });

  // Counters: avoid "animate old value then jump".
  // Strategy:
  // - Set HTML default data-to-value="0" (so Elementor doesn't animate old numbers).
  // - After CMS loads, animate from current value -> CMS value when element is visible.
  const formatWithDelimiter = (n, delimiter) => {
    const x = Math.round(Number(n) || 0);
    if (!delimiter) return String(x);
    return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, delimiter);
  };

  const animateNumber = (el, toValue) => {
    const delimiter = el.getAttribute("data-delimiter") || "";
    const duration = Number(el.getAttribute("data-duration")) || 1200;
    const fromRaw = String(el.textContent || "").replace(/[^\d.-]/g, "");
    const from = Number(fromRaw || 0);
    const to = Number(toValue);
    if (!Number.isFinite(to)) return;
    if (el.dataset.cmsCounterValue === String(to)) return; // already animated to this value
    el.dataset.cmsCounterValue = String(to);

    const start = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      const v = from + (to - from) * easeOutCubic(t);
      el.textContent = formatWithDelimiter(v, delimiter);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const counterEls = Array.from(document.querySelectorAll("[data-cms-counter-to]"));
  const applyCounterTargets = () => {
    counterEls.forEach((el) => {
      const key = el.getAttribute("data-cms-counter-to");
      if (!key) return;
      if (settings[key] == null) return;
      const v = Number(settings[key]);
      if (!Number.isFinite(v)) return;
      el.setAttribute("data-to-value", String(v));
      // Keep attribute in sync; animation will handle visible text.
    });
  };
  applyCounterTargets();

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const key = el.getAttribute("data-cms-counter-to");
          const v = key ? settings[key] : null;
          if (v != null) animateNumber(el, v);
        });
      },
      { threshold: 0.25 }
    );
    counterEls.forEach((el) => io.observe(el));
  } else {
    // Fallback: animate immediately
    counterEls.forEach((el) => {
      const key = el.getAttribute("data-cms-counter-to");
      const v = key ? settings[key] : null;
      if (v != null) animateNumber(el, v);
    });
  }

  // Specific mappings
  const isHome = window.location && window.location.pathname === "/";
  if (isHome) {
    document.title = `Home - ${settings.siteName}`;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", `Home - ${settings.siteName}`);
  }

  const ogSite = document.querySelector('meta[property="og:site_name"]');
  if (ogSite) ogSite.setAttribute("content", settings.siteName);

  // Social menu links (by data-cms-social)
  document.querySelectorAll("[data-cms-social]").forEach((a) => {
    const k = a.getAttribute("data-cms-social");
    const url = settings.social?.[k];
    if (url) a.setAttribute("href", url);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const settings = await loadCmsSettings();
    applySettingsToDom(settings);
  } catch (_e) {
    // Silent fail: keep static content.
  }
});

