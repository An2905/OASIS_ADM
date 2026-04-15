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

  const render = (rooms) => {
    const found = findCarouselWrapper();
    if (!found || !found.wrapper) return;

    // If theme carousel JS doesn't re-init after DOM swap,
    // enforce a 3-column grid so it doesn't become a vertical list.
    if (found.posts && !found.posts.classList.contains("cms-db-home")) {
      found.posts.classList.add("cms-db-home");
      if (!document.getElementById("cms-db-home-rooms-style")) {
        const style = document.createElement("style");
        style.id = "cms-db-home-rooms-style";
        style.textContent = `
          .posts.cs-rooms.cs-rooms-carousel.cms-db-home .posts-wrapper.cs-rooms-wrapper{
            display:grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 30px;
          }
          @media (max-width: 1024px){
            .posts.cs-rooms.cs-rooms-carousel.cms-db-home .posts-wrapper.cs-rooms-wrapper{
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 640px){
            .posts.cs-rooms.cs-rooms-carousel.cms-db-home .posts-wrapper.cs-rooms-wrapper{
              grid-template-columns: 1fr;
            }
          }
          .posts.cs-rooms.cs-rooms-carousel.cms-db-home .featured-img img{
            width:100%;
            aspect-ratio: 1 / 1;
            object-fit: cover;
            display:block;
          }
        `;
        document.head.appendChild(style);
      }
    }

    found.wrapper.innerHTML = rooms
      .map((r) => {
        const img = Array.isArray(r.images) && r.images[0] ? r.images[0] : "";
        const size = normalizeSize(r.size);
        const bed = normalizeBed(r.bed);
        const guests = r.guests || 2;

        return (
          '<div class="post cs-room-item has-post-thumbnail">' +
          '<div class="featured-img">' +
          '<a href="/room/' +
          esc(r.slug) +
          '/" aria-label="Room Featured Image">' +
          (img
            ? '<img loading="lazy" decoding="async" src="' + esc(img) + '" alt="" />'
            : "") +
          "</a>" +
          "</div>" +
          '<div class="post-content cs-room-content">' +
          '<header class="post-header item-header">' +
          '<h2 class="post-title item-title"><a href="/room/' +
          esc(r.slug) +
          '/">' +
          esc(r.name) +
          "</a></h2>" +
          '<div class="cs-room-basic-info"><ul>' +
          '<li><div class="csrbi-icon"><i class="flaticon flaticon-maximize"></i></div><span class="csrbi-text">' +
          esc(size) +
          "</span></li>" +
          '<li><div class="csrbi-icon"><i class="flaticon flaticon-user-2"></i></div><span class="csrbi-text">' +
          esc(guests) +
          " Guests</span></li>" +
          '<li><div class="csrbi-icon"><i class="flaticon flaticon-bed-6"></i></div><span class="csrbi-text">' +
          esc(bed) +
          "</span></li>" +
          "</ul></div>" +
          "</header>" +
          (r.description
            ? '<div class="post-excerpt item-excerpt"><p>' + esc(r.description) + "</p></div>"
            : "") +
          '<footer class="post-footer item-footer"><div class="more-btn">' +
          '<a class="read-more-btn button cs-btn-underline" href="/room/' +
          esc(r.slug) +
          '/"><span>Discover More</span></a>' +
          "</div></footer>" +
          "</div></div>"
        );
      })
      .join("");
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

