(function () {
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function pickImageCandidates(images) {
    if (!Array.isArray(images)) return [];
    var out = [];
    for (var i = 0; i < images.length; i++) {
      var u = String(images[i] || "").trim();
      if (!u) continue;
      if (u.indexOf("undefined") !== -1 || u.indexOf("null") !== -1) continue;
      if (u.startsWith("/") || u.startsWith("http://") || u.startsWith("https://")) out.push(u);
      if (out.length >= 6) break;
    }
    return out;
  }

  function bindImageFallbacks(root) {
    var imgs = root.querySelectorAll("img[data-fallback]");
    imgs.forEach(function (img) {
      img.addEventListener("error", function () {
        var cur = String(img.getAttribute("src") || "").trim();
        var fb = String(img.getAttribute("data-fallback") || "").split("|").filter(Boolean);
        while (fb.length && fb[0] === cur) fb.shift();
        if (!fb.length) return;
        img.setAttribute("data-fallback", fb.slice(1).join("|"));
        img.setAttribute("src", fb[0]);
      });
    });
  }

  function renderRooms(container, rooms) {
    container.innerHTML =
      '<div class="posts cs-rooms text-center layout-zigzag layout-list img-ratio-3-2">' +
      '<div class="posts-wrapper cs-rooms-wrapper">' +
      rooms
        .map(function (r) {
          var bedLabel = String(r.bed || "").trim();
          if (/^1\b/.test(bedLabel) && /\bBeds\b/i.test(bedLabel)) {
            bedLabel = bedLabel.replace(/\bBeds\b/gi, "Bed");
          }
          var bathLabel = String(r.bathroom || "").trim();
          if (/^1\b/.test(bathLabel) && /\bBathrooms\b/i.test(bathLabel)) {
            bathLabel = bathLabel.replace(/\bBathrooms\b/gi, "Bathroom");
          }

          // IMPORTANT: match theme markup on /stay/ so images display reliably.
          // Use the first concept image as the featured image.
          var candidates = pickImageCandidates(r.images);
          var featured = candidates[0] ? String(candidates[0]) : "";
          var fallbacks = candidates.length > 1 ? candidates.slice(1).join("|") : "";
          var gallery =
            '<div class="featured-img">' +
            '<a href="/room/' +
            esc(r.slug) +
            '/" aria-label="Room Featured Image">' +
            (featured
              ? '<img loading="lazy" decoding="async" width="780" height="520" src="' +
                esc(featured) +
                '" ' +
                (fallbacks ? 'data-fallback="' + esc(fallbacks) + '" ' : "") +
                'class="attachment-cozystay_780x9999 size-cozystay_780x9999" alt="" />'
              : "") +
            "</a>" +
            "</div>";

          return (
            '<div class="post cs-room-item ' +
            (featured ? "has-post-thumbnail " : "") +
            'format-gallery">' +
            gallery +
            '<div class="post-content cs-room-content">' +
            '<header class="post-header item-header">' +
            '<div class="item-subtitle"></div>' +
            '<h2 class="post-title item-title">' +
            '<a href="/room/' +
            esc(r.slug) +
            '/">' +
            esc(r.name) +
            "</a>" +
            "</h2>" +
            '<div class="cs-room-basic-info"><ul>' +
            '<li><div class="csrbi-icon"><i class="flaticon flaticon-maximize"></i></div><span class="csrbi-text">' +
            esc(r.size || "") +
            "</span></li>" +
            '<li><div class="csrbi-icon"><i class="flaticon flaticon-user-2"></i></div><span class="csrbi-text">' +
            esc(r.guests) +
            " Guests</span></li>" +
            '<li><div class="csrbi-icon"><i class="flaticon flaticon-bed-6"></i></div><span class="csrbi-text">' +
            esc(bedLabel) +
            "</span></li>" +
            '<li><div class="csrbi-icon"><i class="flaticon flaticon-bathing"></i></div><span class="csrbi-text">' +
            esc(bathLabel) +
            "</span></li>" +
            "</ul></div>" +
            "</header>" +
            (r.description
              ? '<div class="post-excerpt item-excerpt"><p>' + esc(r.description) + "</p></div>"
              : "") +
            '<footer class="post-footer item-footer">' +
            '<div class="more-btn"><a class="read-more-btn button cs-btn-underline" href="/room/' +
            esc(r.slug) +
            '/"><span>Discover More</span></a></div>' +
            "</footer>" +
            "</div>" +
            "</div>"
          );
        })
        .join("") +
      "</div></div>";

    bindImageFallbacks(container);
  }

  async function init() {
    var container = document.getElementById("js-rooms-from-db");
    if (!container) return;

    try {
      var res = await fetch("/api/rooms", { credentials: "same-origin" });
      if (!res.ok) return;
      var data = await res.json();
      var rooms = Array.isArray(data.rooms) ? data.rooms : [];
      rooms = rooms.filter(function (r) {
        return r && r.status === "ACTIVE";
      });
      if (!rooms.length) return;

      var staticWrap = document.getElementById("js-rooms-static");
      if (staticWrap) staticWrap.style.display = "none";

      renderRooms(container, rooms);
    } catch (_) {
      // ignore
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

