(function () {
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderRooms(container, rooms) {
    container.innerHTML =
      '<div class="posts cs-rooms text-center layout-zigzag layout-list img-ratio-3-2">' +
      '<div class="posts-wrapper cs-rooms-wrapper">' +
      rooms
        .map(function (r) {
          return (
            '<div class="post cs-room-item format-standard">' +
            '<div class="post-content cs-room-content">' +
            '<header class="post-header item-header">' +
            '<h2 class="post-title item-title">' +
            '<a href="/room/' +
            esc(r.slug) +
            '/">' +
            esc(r.name) +
            "</a>" +
            "</h2>" +
            '<div class="cs-room-basic-info"><ul>' +
            '<li><div class="csrbi-icon"><i class="flaticon flaticon-user-2"></i></div><span class="csrbi-text">' +
            esc(r.guests) +
            " Guests</span></li>" +
            '<li><div class="csrbi-icon"><i class="flaticon flaticon-bed-6"></i></div><span class="csrbi-text">' +
            esc(r.bed) +
            "</span></li>" +
            '<li><div class="csrbi-icon"><i class="flaticon flaticon-bathing"></i></div><span class="csrbi-text">' +
            esc(r.bathroom) +
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

