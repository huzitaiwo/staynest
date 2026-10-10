(() => {
  "use strict";
  const SN = window.StayNest;
  const B = SN.bookings;
  const { plural, fmt } = SN;
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
  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const d = (s) => dateFmt.format(new Date(`${s}T00:00:00`));

  const PHASES = [
    {
      key: "upcoming",
      tab: "Upcoming",
      badge: "Upcoming",
      emptyTitle: "No upcoming trips",
      emptyText: "When you book a stay, it will show up here.",
    },
    {
      key: "current",
      tab: "Current",
      badge: "Staying now",
      emptyTitle: "Nothing happening right now",
      emptyText: "Trips appear here from the day you check in.",
    },
    {
      key: "past",
      tab: "Past",
      badge: "Completed",
      emptyTitle: "No past trips yet",
      emptyText: "Your completed stays will be collected here.",
    },
    {
      key: "cancelled",
      tab: "Cancelled",
      badge: "Cancelled",
      emptyTitle: "No cancelled trips",
      emptyText: "Anything you cancel will be listed here.",
    },
  ];
  const sorters = {
    upcoming: (a, b) => a.b.checkin.localeCompare(b.b.checkin),
    current: (a, b) => a.b.checkout.localeCompare(b.b.checkout),
    past: (a, b) => b.b.checkout.localeCompare(a.b.checkout),
    cancelled: (a, b) =>
      (b.b.cancelledAt || "").localeCompare(a.b.cancelledAt || ""),
  };

  const tabsEl = $("[data-tabs]");
  const panel = $("[data-panel]");
  const list = $("[data-trips]");
  const emptyEl = $("[data-empty]");
  const live = $("[data-live]");
  const dialog = $("#cancel-dialog");
  let active = null;
  let pendingRef = null;

  function actionsFor(t) {
    const view = `<a class="btn btn--outline btn--sm" href="property.html?id=${t.p.id}">View stay</a>`;
    const cal = `<button class="btn btn--outline btn--sm" type="button" data-ics="${esc(t.b.ref)}">Add to calendar</button>`;
    const contact = `<a class="btn btn--outline btn--sm" href="messages.html?property=${t.p.id}">Contact host</a>`;
    const again = `<a class="btn btn--primary btn--sm" href="property.html?id=${t.p.id}">Book again</a>`;
    const cancel = `<button class="btn btn--outline btn--sm" type="button" data-cancel="${esc(t.b.ref)}">Cancel trip</button>`;
    return {
      upcoming: [view, cal, contact, cancel],
      current: [view, cal, contact],
      past: [again, view],
      cancelled: [again, view],
    }[t.phase].join("");
  }

  function tripHTML(t, ph) {
    const { b, p } = t;
    return `
    <li>
      <article class="trip">
        <img class="trip__img" src="${p.image}" alt="" width="520" height="390" loading="lazy">
        <div class="trip__body">
          <div class="trip__top">
            <span class="status status--${t.phase}">${ph.badge}</span>
            <p class="trip__ref">Reference <strong>${esc(b.ref)}</strong></p>
          </div>
          <h2 class="trip__title"><a href="property.html?id=${p.id}">${p.title}</a></h2>
          <p class="trip__meta">${p.area}, ${p.city}, ${p.country}</p>
          <ul class="trip__facts" role="list">
            <li>${esc(d(b.checkin))} – ${esc(d(b.checkout))}</li>
            <li>${plural(+b.guests || 1, "guest")}</li>
            <li>${fmt(+b.total || 0)}</li>
          </ul>
          <div class="trip__actions">${actionsFor(t)}</div>
          <details class="trip__more">
            <summary>Reservation details</summary>
            <dl class="trip__list">
              <div><dt>Host</dt><dd>${SN.host.name}</dd></div>
              <div><dt>Reservation</dt><dd>${ph.badge}</dd></div>
              <div><dt>Payment</dt><dd>Paid · demo card ending ${esc(b.last4 || "----")}</dd></div>
              <div><dt>Total</dt><dd>${fmt(+b.total || 0)}</dd></div>
              <div><dt>Booked on</dt><dd>${b.paidAt ? esc(d(b.paidAt.slice(0, 10))) : "—"}</dd></div>
              <div><dt>Reserved for</dt><dd>${esc(b.name || "—")}</dd></div>
            </dl>
          </details>
        </div>
      </article>
    </li>`;
  }

  function render({ focusTab = false } = {}) {
    const trips = B.read()
      .map((b) => ({
        b,
        p: SN.properties.find((x) => x.id === b.id),
        phase: B.phase(b),
      }))
      .filter((t) => t.p);
    const by = Object.fromEntries(
      PHASES.map((ph) => [
        ph.key,
        trips.filter((t) => t.phase === ph.key).sort(sorters[ph.key]),
      ]),
    );

    if (!active)
      active =
        ["current", "upcoming", "past", "cancelled"].find(
          (k) => by[k].length,
        ) || "upcoming";
    const ph = PHASES.find((x) => x.key === active);

    tabsEl.innerHTML = PHASES.map(
      (x) =>
        `<button class="tab" type="button" role="tab" id="tab-${x.key}" aria-selected="${x.key === active}" aria-controls="trips-panel" tabindex="${x.key === active ? 0 : -1}" data-tab="${x.key}">${x.tab}<span class="tab__count">${by[x.key].length}</span></button>`,
    ).join("");
    panel.setAttribute("aria-labelledby", `tab-${active}`);

    const items = by[active];
    list.innerHTML = items.map((t) => tripHTML(t, ph)).join("");
    list.hidden = !items.length;
    emptyEl.hidden = items.length > 0;
    $("[data-empty-title]").textContent = ph.emptyTitle;
    $("[data-empty-text]").textContent = ph.emptyText;

    if (focusTab) $(`#tab-${active}`).focus();
  }

  /* Tabs: click + arrow keys */
  tabsEl.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    active = tab.dataset.tab;
    render({ focusTab: true });
  });
  tabsEl.addEventListener("keydown", (e) => {
    const keys = PHASES.map((x) => x.key);
    const i = keys.indexOf(active);
    const move = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      Home: 0,
      End: keys.length - 1,
    }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    active = keys[(move + keys.length) % keys.length];
    render({ focusTab: true });
  });

  /* Trip actions */
  list.addEventListener("click", (e) => {
    const ics = e.target.closest("[data-ics]");
    if (ics) {
      const b = B.read().find((x) => x.ref === ics.dataset.ics);
      const p = b && SN.properties.find((x) => x.id === b.id);
      if (b && p) B.downloadICS(b, p);
      return;
    }
    const cancel = e.target.closest("[data-cancel]");
    if (cancel) {
      const b = B.read().find((x) => x.ref === cancel.dataset.cancel);
      const p = b && SN.properties.find((x) => x.id === b.id);
      if (!b || !p) return;
      pendingRef = b.ref;
      $("[data-cancel-text]").textContent =
        `This will cancel reservation ${b.ref} at ${p.title}. This is a demo, so no refund is processed.`;
      dialog.returnValue = "";
      dialog.showModal();
    }
  });

  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "cancel" && pendingRef) {
      B.update(pendingRef, {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
      });
      live.textContent = `Trip ${pendingRef} cancelled.`;
      active = "cancelled";
      render({ focusTab: true });
    }
    pendingRef = null;
  });

  render();
})();
