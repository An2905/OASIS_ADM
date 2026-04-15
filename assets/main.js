const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// Optional: smooth anchor scrolling
document.addEventListener('click', (e) => {
  const a = e.target instanceof Element ? e.target.closest('a[href^=\"#\"]') : null;
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || href === '#') return;
  const el = document.querySelector(href);
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.pushState(null, '', href);
});
