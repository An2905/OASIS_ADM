// Sync "The Accommodations" carousel on home page from DB.
(() => {
  const esc = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const normalizeBed = (bed) => {
    let b = String(bed || "").trim();
    if (/^1\b/.test(b) && /\bBeds\b/i.test(b)) b = b.replace(/\bBeds\b/gi, "Bed");
    return b;
  };

  const normalizeSize = (size) => String(size || "").trim();

  const findCarouselWrapper = () => {
    // Find the section by heading text, then locate the nearest rooms carousel wrapper.
    const headings = Array.from(document.querySelectorAll("h3.cs-title"));
    const h = headings.find((x) => (x.textContent || "").trim() === "The Accommodations");
    if (!h) return null;
    const section = h.closest("section") || h.closest(".elementor-section") || document;
    const posts = section.parentElement
      ? section.parentElement.querySelector(".posts.cs-rooms.cs-rooms-carousel")
      : null;
    const wrapper = posts ? posts.querySelector(".posts-wrapper.cs-rooms-wrapper") : null;
    return { posts, wrapper };
  };

  const setText = (el, text) => {
    if (!el) return;
    el.textContent = String(text ?? "");
  };

  const setHref = (el, href) => {
    if (!el) return;
    el.setAttribute("href", href);
  };

  const setImg = (imgEl, url) => {
    if (!imgEl) return;
    const u = String(url || "").trim();
    // Only accept clearly valid URLs (avoid setting broken src like "undefined")
    if (!u || (!u.startsWith("/") && !u.startsWith("http://") && !u.startsWith("https://"))) return;
    imgEl.setAttribute("src", u);
    // Keep theme sizing; just remove responsive candidates if present.
    imgEl.removeAttribute("srcset");
  };

  const applyRoomToNode = (postEl, r) => {
    const href = `/room/${String(r.slug || "").toLowerCase()}/`;
    const imgUrl = Array.isArray(r.images) && r.images[0] ? r.images[0] : "";
    const size = normalizeSize(r.size);
    const bed = normalizeBed(r.bed);
    const guests = r.guests || 2;

    const featuredA = postEl.querySelector(".featured-img a");
    setHref(featuredA, href);

    const titleA = postEl.querySelector("h2.post-title a");
    setHref(titleA, href);
    setText(titleA, r.name || "");

    const moreA = postEl.querySelector("a.read-more-btn");
    setHref(moreA, href);

    const imgEl = postEl.querySelector(".featured-img img");
    setImg(imgEl, imgUrl);

    const infoLis = postEl.querySelectorAll(".cs-room-basic-info ul li .csrbi-text");
    if (infoLis && infoLis.length >= 3) {
      setText(infoLis[0], size);
      setText(infoLis[1], `${guests} Guests`);
      setText(infoLis[2], bed);
    }

    const excerptP = postEl.querySelector(".post-excerpt p");
    setText(excerptP, r.description || "");
  };

  const render = (rooms) => {
    const found = findCarouselWrapper();
    if (!found || !found.wrapper) return;

    // IMPORTANT: don't replace wrapper HTML; it breaks theme/carousel layout.
    // Also don't clone/hide nodes; carousel JS depends on a stable DOM.
    const existing = Array.from(found.wrapper.querySelectorAll(".post.cs-room-item"));
    if (!existing.length) return;

    // Apply up to existing count (leave extras untouched)
    const n = Math.min(existing.length, rooms.length);
    for (let i = 0; i < n; i++) {
      applyRoomToNode(existing[i], rooms[i]);
    }
  };

  async function init() {
    const found = findCarouselWrapper();
    if (!found || !found.wrapper) return;

    try {
      const res = await fetch("/api/rooms", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      const rooms = Array.isArray(data.rooms) ? data.rooms : [];
      const active = rooms.filter((r) => r && r.status === "ACTIVE");
      if (!active.length) return;
      render(active);
    } catch {
      // ignore
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

