(() => {
  "use strict";
  const SN = window.StayNest;
  const B = SN.bookings;
  const { today, addDays, range } = SN.dates;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (y, m, day) => `${y}-${pad(m + 1)}-${pad(day)}`;
  const monthFmt = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  });
  const longFmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const items = SN.listings.hosted();
  const grid = $("[data-grid]");
  const live = $("[data-live]");
  const select = $("[data-listing]");
  const form = $("[data-range]");
  const err = $("[data-range-err]");

  let id = new URLSearchParams(location.search).get("id");
  if (!items.some((i) => i.id === id)) id = items[0]?.id;
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  select.innerHTML = items
    .map(
      (i) =>
        `<option value="${esc(i.id)}">${esc(i.p.title || "Untitled listing")}</option>`,
    )
    .join("");
  select.value = id;

  // date → guest first name, for every night of every live reservation
  function bookedMap() {
    const map = {};
    B.read()
      .filter((b) => b.id === id && B.phase(b) !== "cancelled")
      .forEach((b) => {
        for (let day = b.checkin; day < b.checkout; day = addDays(day, 1)) {
          map[day] = (b.name || "Guest").trim().split(" ")[0];
        }
      });
    return map;
  }

  function render() {
    const booked = bookedMap();
    const t = today();
    const first = (new Date(year, month, 1).getDay() + 6) % 7; // Monday first
    const days = new Date(year, month + 1, 0).getDate();
    let blockedCount = 0;
    let bookedCount = 0;
    let html = '<span class="cal__pad"></span>'.repeat(first);

    for (let day = 1; day <= days; day += 1) {
      const date = iso(year, month, day);
      const label = longFmt.format(new Date(year, month, day));
      const past = date < t;
      if (booked[date]) {
        bookedCount += 1;
        html += `<button class="cal__day is-booked" type="button" disabled aria-label="${label}, booked by ${esc(booked[date])}"><span>${day}</span><small>${esc(booked[date])}</small></button>`;
      } else if (past) {
        html += `<button class="cal__day is-past" type="button" disabled aria-label="${label}, past"><span>${day}</span></button>`;
      } else {
        const blocked = SN.blocked.has(id, date);
        if (blocked) blockedCount += 1;
        html += `<button class="cal__day${blocked ? " is-blocked" : ""}${date === t ? " is-today" : ""}" type="button" data-date="${date}" aria-pressed="${blocked}" aria-label="${label}${blocked ? ", blocked" : ", available"}"><span>${day}</span></button>`;
      }
    }

    grid.innerHTML = html;
    $("#cal-title").textContent = monthFmt.format(new Date(year, month, 1));
    $("[data-prev]").disabled =
      year === now.getFullYear() && month === now.getMonth();
    $("[data-summary]").textContent =
      `${SN.plural(bookedCount, "night")} booked · ${SN.plural(blockedCount, "night")} blocked this month`;
  }

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-date]");
    if (!btn) return;
    const on = btn.getAttribute("aria-pressed") !== "true";
    SN.blocked.set(id, [btn.dataset.date], on);
    render();
    grid.querySelector(`[data-date="${btn.dataset.date}"]`)?.focus();
    live.textContent = `${btn.dataset.date} ${on ? "blocked" : "reopened"}`;
  });

  $("[data-prev]").addEventListener("click", () => {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    render();
  });
  $("[data-next]").addEventListener("click", () => {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    render();
  });

  select.addEventListener("change", () => {
    id = select.value;
    try {
      const url = new URL(location.href);
      url.searchParams.set("id", id);
      history.replaceState(null, "", url);
    } catch {
      /* ignore */
    }
    render();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const on = e.submitter?.value !== "open";
    const from = form.from.value;
    const to = form.to.value;
    const fail = (msg) => {
      err.textContent = msg;
      err.hidden = false;
    };
    err.hidden = true;
    if (!from || !to) return fail("Choose both a start and an end date.");
    if (to < from)
      return fail("The end date must be on or after the start date.");
    if (to < today()) return fail("Those dates are in the past.");
    if (range(from, to).length > 365)
      return fail("Choose a range of up to one year.");

    const booked = bookedMap();
    const dates = range(from < today() ? today() : from, to).filter(
      (x) => !booked[x],
    );
    SN.blocked.set(id, dates, on);
    const [y, m] = from.split("-").map(Number);
    year = y;
    month = m - 1;
    if (
      year < now.getFullYear() ||
      (year === now.getFullYear() && month < now.getMonth())
    ) {
      year = now.getFullYear();
      month = now.getMonth();
    }
    render();
    live.textContent = `${SN.plural(dates.length, "night")} ${on ? "blocked" : "reopened"}`;
    form.reset();
  });

  render();
})();
