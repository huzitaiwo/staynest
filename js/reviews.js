// js/reviews.js — load before any script that uses SN.reviews
(() => {
  "use strict";
  const SN = (window.StayNest = window.StayNest || {});
  const KEY = "sn-reviews";

  const STAY_CATS = [
    ["cleanliness", "Cleanliness"],
    ["accuracy", "Accuracy"],
    ["communication", "Communication"],
    ["location", "Location"],
    ["checkin", "Check-in"],
    ["value", "Value"],
  ];
  const GUEST_CATS = [
    ["communication", "Communication"],
    ["cleanliness", "Cleanliness"],
    ["rules", "Respect for house rules"],
  ];
  // Baseline spread for the example stays' pre-existing scores
  const OFFSETS = {
    cleanliness: 0.02,
    accuracy: -0.01,
    communication: 0.03,
    location: -0.03,
    checkin: 0.01,
    value: -0.04,
  };

  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const write = (list) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  };
  const average = (ratings) => {
    const v = Object.values(ratings);
    return v.length
      ? Math.round((v.reduce((a, c) => a + c, 0) / v.length) * 10) / 10
      : 0;
  };
  const forBooking = (ref, by) =>
    read().find((r) => r.ref === ref && r.by === by) || null;

  SN.reviews = {
    STAY_CATS,
    GUEST_CATS,
    read,
    average,
    forBooking,
    forProperty: (id) =>
      read()
        .filter((r) => r.propertyId === id && r.by === "guest")
        .sort((a, b) => b.date.localeCompare(a.date)),
    byAuthor: (by) => read().filter((r) => r.by === by),

    add({ ref, propertyId, by, ratings, text, author }) {
      if (forBooking(ref, by)) return false; // one review per stay, per side
      const r = {
        id: `rv-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        ref,
        propertyId,
        by,
        ratings,
        overall: average(ratings),
        text,
        author: author || "",
        date: new Date().toISOString(),
        reply: null,
      };
      return write([r, ...read()]);
    },

    reply: (id, text) =>
      write(
        read().map((r) =>
          r.id === id
            ? { ...r, reply: { text, date: new Date().toISOString() } }
            : r,
        ),
      ),

    // Blends a stay's existing score with real guest reviews. Returns null when there is nothing to show.
    summary(p, real) {
      const base = p.reviews || 0;
      const count = base + real.length;
      if (!count) return null;
      const score =
        (p.rating * base + real.reduce((s, r) => s + r.overall, 0)) / count;
      const cats = STAY_CATS.map(([key, label]) => {
        const given = real.filter((r) => r.ratings[key]);
        const baseVal = base ? Math.min(5, p.rating + OFFSETS[key]) : 0;
        const n = base + given.length;
        const v = n
          ? (baseVal * base + given.reduce((s, r) => s + r.ratings[key], 0)) / n
          : 0;
        return [label, v];
      });
      return { score, count, cats };
    },
  };
})();
