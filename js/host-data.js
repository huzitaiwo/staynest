// js/host-data.js — load after listings.js
(() => {
  "use strict";
  const SN = window.StayNest;
  const L = SN.listings;
  const KEY = "sn-blocked";

  const today = () => new Date().toLocaleDateString("en-CA");
  const addDays = (iso, n) =>
    new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5)
      .toISOString()
      .slice(0, 10);

  // Every stay this host manages: the built-in examples plus their own listings
  L.hosted = () => [
    ...SN.samples.map((p) => ({
      id: p.id,
      p,
      status: L.statusOf(p.id),
      sample: true,
    })),
    ...L.mine().map((l) => ({
      id: l.id,
      p: SN.toProperty(l),
      status: l.status || "draft",
      sample: false,
    })),
  ];

  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
      return {};
    }
  };
  const write = (o) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(o));
      return true;
    } catch {
      return false;
    }
  };

  SN.dates = {
    today,
    addDays,
    range(from, to) {
      const out = [];
      for (let d = from; d <= to && out.length < 366; d = addDays(d, 1))
        out.push(d);
      return out;
    },
  };

  SN.blocked = {
    has: (id, date) => (read()[id] || []).includes(date),
    list: (id) => read()[id] || [],
    set(id, dates, on) {
      const all = read();
      const set = new Set(all[id] || []);
      dates.forEach((d) => (on ? set.add(d) : set.delete(d)));
      all[id] = [...set].filter((d) => d >= today()).sort();
      return write(all);
    },
  };
})();
