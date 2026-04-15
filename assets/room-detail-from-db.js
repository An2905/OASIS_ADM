// Sync public room detail pages (/room/:slug/) from DB.
(() => {
  const getSlug = () => {
    const parts = String(location.pathname || "/").split("/").filter(Boolean);
    if (parts[0] !== "room") return null;
    return parts[1] || null;
  };

  const slug = getSlug();
  if (!slug) return;

  const setMeta = (prop, content) => {
    const el = document.querySelector(`meta[property="${prop}"]`);
    if (el) el.setAttribute("content", content);
  };

  const setText = (sel, text) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  };

  const setInfoByIcon = (iconClass, value) => {
    const icon = document.querySelector(`.cs-room-basic-info .${iconClass}`);
    if (!icon) return;
    const li = icon.closest("li");
    const text = li ? li.querySelector(".csrbi-text") : null;
    if (text) text.textContent = value;
  };

  const setIncludedList = (items) => {
    // On exported pages, included list appears as: ul.cs-list ... span.list-content
    const ul = document.querySelector("ul.cs-list");
    if (!ul) return;
    ul.innerHTML = items
      .map(
        (x) =>
          `<li><span class="list-icon color-primary"></span><span class="list-content">${escapeHtml(
            x
          )}</span></li>`
      )
      .join("");
  };

  const escapeHtml = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const setGallery = (images) => {
    // Try update the first thumbnail-gallery on page (hero gallery).
    const gal = document.querySelector("ul.thumbnail-gallery");
    if (!gal) return;
    const urls = (images || []).map((x) => (typeof x === "string" ? x : x?.url)).filter(Boolean).slice(0, 6);
    if (!urls.length) return;
    gal.innerHTML = urls
      .map(
        (u) =>
          `<li><img loading="lazy" decoding="async" src="${escapeHtml(u)}" alt="" /></li>`
      )
      .join("");
  };

  async function run() {
    try {
      const res = await fetch("/api/public/rooms", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      const rooms = Array.isArray(data.rooms) ? data.rooms : [];
      const room = rooms.find((r) => String(r.slug || "").toLowerCase() === String(slug).toLowerCase());
      if (!room) return;

      // Title + H1
      document.title = `${room.name} - Tamcoc Oasis`;
      setText("h1.entry-title", room.name);

      // Basic info
      if (room.size) setInfoByIcon("flaticon-maximize", room.size);
      if (room.bed) setInfoByIcon("flaticon-bed-6", room.bed);
      if (room.bathroom) setInfoByIcon("flaticon-bathing", room.bathroom);

      // Description: replace the first paragraph under the main content area
      const p = document.querySelector("article .entry-content p");
      if (p && room.description) p.textContent = room.description;

      // Included list (best-effort)
      if (room.included) {
        const items = String(room.included)
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);
        if (items.length) setIncludedList(items);
      }

      // Gallery
      if (Array.isArray(room.images) && room.images.length) setGallery(room.images);

      // Meta
      if (room.description) setMeta("og:description", room.description);
      setMeta("og:title", `${room.name} - Tamcoc Oasis`);
    } catch {
      // ignore
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();

