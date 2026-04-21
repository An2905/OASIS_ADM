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

  // Counters: Elementor scripts may mutate numbers after DOMContentLoaded,
  // so we re-apply values a few times to ensure the final value matches CMS.
  const applyCounters = () => {
    document.querySelectorAll("[data-cms-counter-to]").forEach((el) => {
      const key = el.getAttribute("data-cms-counter-to");
      if (!key) return;
      if (settings[key] == null) return;
      const v = Number(settings[key]);
      if (!Number.isFinite(v)) return;
      el.setAttribute("data-to-value", String(v));
      el.textContent = String(v);
    });
  };
  applyCounters();
  // After page scripts initialize and after a couple of ticks.
  window.addEventListener("load", applyCounters, { once: true });
  [250, 1000, 2500].forEach((ms) => window.setTimeout(applyCounters, ms));
  // If counters animate on scroll/appear, ensure we overwrite afterward.
  window.addEventListener("scroll", applyCounters, { passive: true });

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

