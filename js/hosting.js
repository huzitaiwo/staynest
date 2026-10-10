(() => {
  "use strict";
  const SN = window.StayNest;
  const B = SN.bookings;
  const L = SN.listings;
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
  const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="56"><rect width="100%" height="100%" fill="#e8dfd2"/></svg>')}`;
  const LABEL = {
    published: "Published",
    draft: "Draft",
    unpublished: "Unpublished",
  };
  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  });
  const d = (s) => dateFmt.format(new Date(`${s}T00:00:00`));
  const dayNum = (s) => Math.floor(Date.parse(`${s}T00:00:00Z`) / 864e5);

  const listingItems = () => L.hosted();
  const propertyOf = (id) => SN.allProperties.find((p) => p.id === id);

  function renderKpis(items, bookings) {
    const revenue = bookings.reduce((sum, b) => {
      const p = propertyOf(b.id);
      if (!p) return sum;
      const t = SN.quote(p, SN.nights(b.checkin, b.checkout));
      return sum + t.subtotal + t.cleaning;
    }, 0);
    const active = bookings.filter((b) =>
      ["upcoming", "current"].includes(B.phase(b)),
    ).length;

    const start = dayNum(new Date().toLocaleDateString("en-CA"));
    const end = start + 30;
    const nights = bookings.reduce(
      (s, b) =>
        s +
        Math.max(
          0,
          Math.min(dayNum(b.checkout), end) -
            Math.max(dayNum(b.checkin), start),
        ),
      0,
    );
    const published = items.filter((i) => i.status === "published").length;
    const occupancy = published
      ? Math.min(100, Math.round((nights / (published * 30)) * 100))
      : null;

    const rated = items.filter(
      (i) => i.status === "published" && i.p.reviews > 0,
    );
    const reviewCount = rated.reduce((s, i) => s + i.p.reviews, 0);
    const rating = reviewCount
      ? rated.reduce((s, i) => s + i.p.rating * i.p.reviews, 0) / reviewCount
      : null;

    const kpis = [
      ["Booked revenue", fmt(revenue), "Nightly rate plus cleaning"],
      ["Reservations", String(active), "Upcoming and current"],
      ["Occupancy", occupancy === null ? "—" : `${occupancy}%`, "Next 30 days"],
      [
        "Average rating",
        rating === null ? "—" : rating.toFixed(2),
        reviewCount ? plural(reviewCount, "review") : "No reviews yet",
      ],
      [
        "Response rate",
        `${SN.host.responseRate}%`,
        `Replies ${SN.host.responseTime}`,
      ],
    ];
    $("[data-kpis]").innerHTML = kpis
      .map(
        ([l, v, h]) =>
          `<div class="kpi"><p class="kpi__label">${l}</p><p class="kpi__value">${v}</p><p class="kpi__hint">${h}</p></div>`,
      )
      .join("");
  }

  function renderReservations(bookings) {
    const upcoming = bookings
      .filter((b) => ["upcoming", "current"].includes(B.phase(b)))
      .sort((a, b) => a.checkin.localeCompare(b.checkin))
      .slice(0, 5);
    $("[data-reservations]").innerHTML = upcoming
      .map((b) => {
        const p = propertyOf(b.id);
        if (!p) return "";
        return `<li class="row row--res">
        <div><p class="row__title">${esc(b.name || "Guest")}</p><p class="row__sub">${esc(b.ref)}</p></div>
        <div><p class="row__title">${p.title}</p><p class="row__sub">${p.city}, ${p.country}</p></div>
        <div><p class="row__title">${esc(d(b.checkin))} – ${esc(d(b.checkout))}</p><p class="row__sub">${plural(+b.guests || 1, "guest")}</p></div>
        <span class="status status--${B.phase(b)}">${B.phase(b) === "current" ? "Staying now" : "Upcoming"}</span>
      </li>`;
      })
      .join("");
    $("[data-reservations]").hidden = !upcoming.length;
    $("[data-res-empty]").hidden = upcoming.length > 0;
  }

  function actionsFor(i) {
    const view = `<a class="btn btn--outline btn--sm" href="property.html?id=${esc(i.id)}">View</a>`;
    const edit = `<a class="btn btn--outline btn--sm" href="hosting-new.html?id=${esc(i.id)}">Edit</a>`;
    const del = `<button class="btn btn--outline btn--sm" type="button" data-delete="${esc(i.id)}">Delete</button>`;
    const toggle =
      i.status === "published"
        ? `<button class="btn btn--outline btn--sm" type="button" data-status="unpublished" data-id="${esc(i.id)}">Unpublish</button>`
        : `<button class="btn btn--outline btn--sm" type="button" data-status="published" data-id="${esc(i.id)}">Publish</button>`;
    if (i.sample)
      return [i.status === "published" ? view : "", toggle].join("");
    if (i.status === "draft")
      return `<a class="btn btn--primary btn--sm" href="hosting-new.html?id=${esc(i.id)}">Continue editing</a>${del}`;
    return [edit, i.status === "published" ? view : "", toggle, del].join("");
  }

  function renderListings(items) {
    $("[data-listings]").innerHTML = items
      .map((i) => {
        const p = i.p;
        const place =
          [p.city, p.country].filter(Boolean).join(", ") || "No location yet";
        return `<li class="row row--listing">
        <img class="thumb" src="${p.image || PLACEHOLDER}" alt="" width="72" height="56" loading="lazy">
        <div>
          <p class="row__title">${esc(p.title || "Untitled listing")}</p>
          <p class="row__sub">${esc(place)} · ${p.price ? `${fmt(+p.price)} night` : "No price yet"}${i.sample ? " · Example" : ""}</p>
        </div>
        <span class="status status--${i.status}">${LABEL[i.status] || i.status}</span>
        <div class="row__actions">${actionsFor(i)}</div>
      </li>`;
      })
      .join("");
  }

  function render() {
    const items = listingItems();
    const ids = new Set(items.map((i) => i.id));
    const bookings = B.read().filter(
      (b) => ids.has(b.id) && b.status !== "cancelled",
    );
    renderKpis(items, bookings);
    renderReservations(bookings);
    renderListings(items);
  }

  /* Listing actions */
  const live = $("[data-live]");
  let pendingDelete = null;
  $("[data-listings]").addEventListener("click", (e) => {
    const s = e.target.closest("[data-status]");
    if (s) {
      if (!L.setStatus(s.dataset.id, s.dataset.status)) {
        live.textContent = "That change couldn't be saved.";
        return;
      }
      live.textContent = `Listing ${s.dataset.status}.`;
      render();
      return;
    }
    const del = e.target.closest("[data-delete]");
    if (del) {
      const l = L.get(del.dataset.delete);
      pendingDelete = del.dataset.delete;
      $("[data-delete-text]").textContent =
        `“${l?.title || "This draft"}” will be removed permanently. Existing bookings are not affected.`;
      const dlg = $("#delete-dialog");
      dlg.returnValue = "";
      dlg.showModal();
    }
  });
  $("#delete-dialog").addEventListener("close", (e) => {
    if (e.target.returnValue === "delete" && pendingDelete) {
      L.remove(pendingDelete);
      live.textContent = "Listing deleted.";
      render();
    }
    pendingDelete = null;
  });

  render();
})();
