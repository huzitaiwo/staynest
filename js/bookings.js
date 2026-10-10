(() => {
  const SN = (window.StayNest = window.StayNest || {});
  const KEY = "sn-bookings";

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
  const todayLocal = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the user's time zone

  SN.bookings = {
    read,
    add: (b) => write([b, ...read()]),
    update: (ref, patch) =>
      write(read().map((b) => (b.ref === ref ? { ...b, ...patch } : b))),

    // upcoming | current | past | cancelled
    phase(b) {
      if (b.status === "cancelled") return "cancelled";
      const t = todayLocal();
      if (b.checkout < t) return "past";
      if (b.checkin <= t) return "current";
      return "upcoming";
    },

    downloadICS(b, p) {
      const day = (s) => s.replaceAll("-", "");
      const stamp = `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
      const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//StayNest//Booking//EN",
        "BEGIN:VEVENT",
        `UID:${b.ref}@staynest`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day(b.checkin)}`,
        `DTEND;VALUE=DATE:${day(b.checkout)}`,
        `SUMMARY:Stay at ${p.title}`,
        `LOCATION:${p.city}\\, ${p.country}`,
        `DESCRIPTION:StayNest reservation ${b.ref}`,
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");
      const url = URL.createObjectURL(
        new Blob([ics], { type: "text/calendar" }),
      );
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: `${b.ref}.ics`,
      });
      a.click();
      URL.revokeObjectURL(url);
    },
  };
})();
