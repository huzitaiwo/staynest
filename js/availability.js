// js/availability.js — dates are unavailable if blocked by the host, or already booked by anyone
(() => {
  "use strict";
  const SN = window.StayNest;
  const read = (k, fb) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? fb;
    } catch {
      return fb;
    }
  };

  SN.availability = {
    conflict(id, checkin, checkout) {
      const { addDays } = SN.dates;
      const blocked = new Set([
        ...(SN.blocked?.list(id) || []),
        ...(read("sn-blocked-remote", {})[id] || []),
      ]);
      for (let d = checkin; d < checkout; d = addDays(d, 1))
        if (blocked.has(d)) return true;

      if (
        (read("sn-busy", {})[id] || []).some(
          ([from, to]) => from < checkout && to > checkin,
        )
      )
        return true;
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
