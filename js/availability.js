// js/availability.js — load after bookings.js and host-data.js
(() => {
  "use strict";
  const SN = window.StayNest;

  SN.availability = {
    // true when any night in [checkin, checkout) is blocked by the host or already reserved
    conflict(id, checkin, checkout) {
      const { addDays } = SN.dates;
      for (let d = checkin; d < checkout; d = addDays(d, 1)) {
        if (SN.blocked.has(id, d)) return true;
      }
      return SN.bookings
        .read()
        .some(
          (b) =>
            b.id === id &&
            SN.bookings.phase(b) !== "cancelled" &&
            b.checkin < checkout &&
            b.checkout > checkin,
        );
    },
  };
})();
