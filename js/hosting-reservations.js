(() => {
  "use strict";
  const SN = window.StayNest;
  const B = SN.bookings;
  const { fmt, plural } = SN;
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
  const LABEL = {
    upcoming: "Upcoming",
    current: "Staying now",
    past: "Completed",
    cancelled: "Cancelled",
  };
  const ORDER = { current: 0, upcoming: 1, past: 2, cancelled: 3 };

  const hosted = SN.listings.hosted();
  const hostedIds = new Set(hosted.map((i) => i.id));
  const propertyOf = (id) => SN.allProperties.find((p) => p.id === id);

  const list = $("[data-list]");
  const empty = $("[data-empty]");
  const live = $("[data-live]");
  const select = $("[data-listing-filter]");
  const dialog = $("#cancel-dialog");
  let filter = "all";
  let listingId = new URLSearchParams(location.search).get("id") || "all";
  let pendingRef = null;

  select.innerHTML = `<option value="all">All listings</option>${hosted
    .map(
      (i) =>
        `<option value="${esc(i.id)}">${esc(i.p.title || "Untitled listing")}</option>`,
    )
    .join("")}`;
  if (![...select.options].some((o) => o.value === listingId))
    listingId = "all";
  select.value = listingId;

  const earnings = (b, p) => {
    const t = SN.quote(p, SN.nights(b.checkin, b.checkout));
    return t.subtotal + t.cleaning;
  };

  function rowHTML(b) {
    const p = propertyOf(b.id);
    const phase = B.phase(b);
    const nights = SN.nights(b.checkin, b.checkout);
    const canCancel = phase === "upcoming" || phase === "current";
    return `<li class="row row--res row--res-full">
      <div>
        <p class="row__title">${esc(b.name || "Guest")}</p>
        <p class="row__sub">${esc(b.ref)} · ${plural(+b.guests || 1, "guest")}</p>
      </div>
      <div>
        <p class="row__title">${esc(p.title)}</p>
        <p class="row__sub">${esc(p.city)}, ${esc(p.country)}</p>
      </div>
      <div>
        <p class="row__title">${esc(d(b.checkin))} – ${esc(d(b.checkout))}</p>
        <p class="row__sub">${plural(nights, "night")} · You earn ${fmt(earnings(b, p))}</p>
      </div>
      <div class="row__side">
        <span class="status status--${phase}">${LABEL[phase]}</span>
        <div class="row__actions">
          <a class="btn btn--outline btn--sm" href="messages.html?id=${esc(b.id)}">Message</a>
          <button class="btn btn--outline btn--sm" type="button" data-ics="${esc(b.ref)}">Add to calendar</button>
          ${canCancel ? `<button class="btn btn--outline btn--sm" type="button" data-cancel="${esc(b.ref)}">Cancel</button>` : ""}
        </div>
      </div>
    </li>`;
  }

  function visible() {
    return B.read()
      .filter((b) => hostedIds.has(b.id) && propertyOf(b.id))
      .filter((b) => listingId === "all" || b.id === listingId)
      .filter((b) => filter === "all" || B.phase(b) === filter)
      .sort((a, b) => {
        const pa = B.phase(a),
          pb = B.phase(b);
        if (pa !== pb) return ORDER[pa] - ORDER[pb];
        return pa === "past" || pa === "cancelled"
          ? b.checkin.localeCompare(a.checkin)
          : a.checkin.localeCompare(b.checkin);
      });
  }

  function render() {
    const rows = visible();
    list.innerHTML = rows.map(rowHTML).join("");
    list.hidden = !rows.length;
    empty.hidden = rows.length > 0;
    live.textContent = `${plural(rows.length, "reservation")} shown`;
  }

  $("[data-filters]").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    filter = btn.dataset.filter;
    document
      .querySelectorAll("[data-filter]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    render();
  });

  select.addEventListener("change", () => {
    listingId = select.value;
    try {
      const url = new URL(location.href);
      listingId === "all"
        ? url.searchParams.delete("id")
        : url.searchParams.set("id", listingId);
      history.replaceState(null, "", url);
    } catch {
      /* ignore */
    }
    render();
  });

  list.addEventListener("click", (e) => {
    const ics = e.target.closest("[data-ics]");
    if (ics) {
      const b = B.read().find((x) => x.ref === ics.dataset.ics);
      if (b) B.downloadICS(b, propertyOf(b.id));
      return;
    }
    const cancel = e.target.closest("[data-cancel]");
    if (cancel) {
      const b = B.read().find((x) => x.ref === cancel.dataset.cancel);
      if (!b) return;
      pendingRef = b.ref;
      $("[data-cancel-text]").textContent =
        `${b.name || "The guest"}'s stay at ${propertyOf(b.id).title} (${d(b.checkin)} – ${d(b.checkout)}) will be cancelled and the dates become free again.`;
      dialog.showModal();
    }
  });

  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "cancel" && pendingRef) {
      B.update(pendingRef, { status: "cancelled" });
      render();
      live.textContent = "Reservation cancelled";
    }
    pendingRef = null;
    dialog.returnValue = "";
  });

  render();
})();
