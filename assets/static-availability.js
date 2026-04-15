// Make reservation forms work in static mode:
// - ensure checkin/checkout values are submitted
// - redirect to /stay/ with query params (acts like "Check Availability")
(function () {
  function toISODate(d) {
    // Expect YYYY-MM-DD already
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
  }

  function attach(form) {
    if (form.dataset.staticAvailabilityBound === '1') return;
    form.dataset.staticAvailabilityBound = '1';

    form.addEventListener('submit', function (e) {
      // Let native GET work, but make sure fields have values
      const checkinEl = form.querySelector('.cs-check-in .check-in-date[name="checkin"]');
      const checkoutEl = form.querySelector('.cs-check-out .check-out-date[name="checkout"]');
      const roomsEl = form.querySelector('input[name="room-quantity"]');
      const adultEl = form.querySelector('input[name="adult-quantity"]');
      const childEl = form.querySelector('input[name="child-quantity"]');

      const checkin = toISODate(checkinEl?.dataset.value || checkinEl?.getAttribute('data-value') || '');
      const checkout = toISODate(checkoutEl?.dataset.value || checkoutEl?.getAttribute('data-value') || '');

      if (checkinEl && !checkinEl.value) checkinEl.value = checkin;
      if (checkoutEl && !checkoutEl.value) checkoutEl.value = checkout;

      // If action is missing or still "/", force to /room-search-results/
      const action = form.getAttribute('action') || '';
      if (action === '/' || action === '' || action === '#') {
        form.setAttribute('action', '/room-search-results/');
      }

      // Some pages rely on JS-only behaviors; ensure navigation works even if form serialization is weird
      // We do a simple redirect to /room-search-results/ with params.
      e.preventDefault();
      const params = new URLSearchParams();
      if (checkin) params.set('checkin', checkin);
      if (checkout) params.set('checkout', checkout);
      if (roomsEl?.value) params.set('room-quantity', roomsEl.value);
      if (adultEl?.value) params.set('adult-quantity', adultEl.value);
      if (childEl?.value) params.set('child-quantity', childEl.value);
      window.location.href = '/room-search-results/' + (params.toString() ? '?' + params.toString() : '');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form.cs-form-wrap').forEach(attach);
  });
})();

