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
    let b = String(bed || "").replace(/\s+/g, " ").trim();
    // If leading count is 1, force singular "Bed"
    const m = b.match(/^(\d+)/);
    if (m && Number(m[1]) === 1) {
      b = b.replace(/\bBeds?\b/gi, "Bed");
    }
    return b;
  };

  const normalizeSize = (size) => String(size || "").trim();

  const findCarouselWrapper = () => {
    // Find the heading, then locate the rooms carousel.
    // NOTE: In exported Elementor HTML, the title widget and `cs_rooms` widget are often in
    // *different* sections (siblings). A `parentElement.querySelector(...)` from the title section
    // can miss the carousel entirely, which looks like "missing rooms" after DB sync changes.
    const headings = Array.from(document.querySelectorAll("h3.cs-title"));
    const h = headings.find((x) => (x.textContent || "").trim() === "The Accommodations");
    if (!h) return null;

    const titleSection = h.closest("section") || h.closest(".elementor-section");
    let posts = null;

    // Prefer the carousel in the next section(s) after the title section (common Elementor layout).
    if (titleSection) {
      let el = titleSection.nextElementSibling;
      for (let i = 0; i < 6 && el; i += 1) {
        const hit = el.querySelector?.(".posts.cs-rooms.cs-rooms-carousel");
        if (hit) {
          posts = hit;
          break;
        }
        el = el.nextElementSibling;
      }
    }

    // Fallback: global match (there should only be one on the home page).
    if (!posts) {
      posts = document.querySelector(".posts.cs-rooms.cs-rooms-carousel");
    }

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
    const current = String(imgEl.getAttribute("src") || "").trim();
    if (current === u) return; // avoid reloading/flicker
    imgEl.setAttribute("src", u);
    // Do NOT touch srcset/sizes; theme relies on them for layout.
  };

  const applyRoomToNode = (postEl, r) => {
    const href = `/room/${String(r.slug || "").toLowerCase()}/`;
    const imgUrl = Array.isArray(r.images) && r.images[0] ? r.images[0] : "";
    const size = normalizeSize(r.size);
    const bed = normalizeBed(r.bed);
    const guests = r.guests || 2;

    // Show this slot in the theme carousel (some slots are shipped as `.hide`)
    postEl.classList.remove("hide");

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
    // Keep DOM stable (no cloning). Use shipped `.hide` slots for extra rooms.
    const existing = Array.from(found.wrapper.querySelectorAll(".post.cs-room-item"));
    if (!existing.length) return;

    const n = Math.min(existing.length, rooms.length);
    for (let i = 0; i < n; i++) {
      applyRoomToNode(existing[i], rooms[i]);
    }

    // Hide unused slots (prevents stale cards showing when DB has fewer rooms than slots)
    for (let i = n; i < existing.length; i++) {
      existing[i].classList.add("hide");
    }

    // Theme carousels (Slick) often measure slides on init; nudge a refresh after we mutate slots.
    try {
      window.dispatchEvent(new Event("resize"));
    } catch {
      // ignore
    }
    try {
      if (found.posts && window.jQuery) {
        const $p = window.jQuery(found.posts);
        if ($p && typeof $p.slick === "function" && $p.hasClass("slick-initialized")) {
          $p.slick("setPosition");
        }
      }
    } catch {
      // ignore
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
      // Ensure "newest" rooms show up first on home carousel
      active.sort((a, b) => {
        const at = Date.parse(a.updatedAt || a.createdAt || "") || 0;
        const bt = Date.parse(b.updatedAt || b.createdAt || "") || 0;
        return bt - at;
      });
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

