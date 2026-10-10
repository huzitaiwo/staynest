(() => {
  "use strict";
  const SN = window.StayNest;
  const PAGE = 9;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
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
  const titleCase = (s) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

  const topForm = $(".search");
  const filterForm = $("#filter-form");
  const filtersEl = $("#filters");
  const scrim = $("[data-scrim]");
  const layout = $(".layout");
  const grid = $("#results");
  const titleEl = $("#page-title");
  const countEl = $("#count");
  const sortEl = $("#sort");
  const chipsEl = $("[data-chips]");
  const emptyEl = $("[data-empty]");
  const moreEl = $("[data-more]");
  const moreText = $("[data-more-text]");
  const pinsEl = $("[data-pins]");
  const previewEl = $("[data-preview]");
  const badgeEl = $("[data-filter-badge]");
  const showBtn = $("[data-show-btn]");
  const openBtn = $("[data-filters-open]");

  const sorters = {
    recommended: (a, b) => a.rank - b.rank,
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
    reviews: (a, b) => b.reviews - a.reviews,
  };

  const filterDefaults = () => ({
    types: [],
    min: "",
    max: "",
    beds: "",
    rating: "",
    instant: false,
    access: false,
    amenities: [],
  });
  const state = {
    where: "",
    checkin: "",
    checkout: "",
    guests: "",
    sort: "recommended",
    view: "list",
    shown: PAGE,
    ...filterDefaults(),
  };

  /* ---------- URL <-> state ---------- */
  function readURL() {
    const q = new URLSearchParams(location.search);
    Object.assign(state, filterDefaults(), {
      where: q.get("where") || "",
      checkin: q.get("checkin") || "",
      checkout: q.get("checkout") || "",
      guests: q.get("guests") || "",
      types: q.getAll("type"),
      min: q.get("min") || "",
      max: q.get("max") || "",
      beds: q.get("beds") || "",
      rating: q.get("rating") || "",
      instant: q.get("instant") === "1",
      access: q.get("access") === "1",
      amenities: q.getAll("amenity"),
      sort: sorters[q.get("sort")] ? q.get("sort") : "recommended",
      view: q.get("view") === "map" ? "map" : "list",
    });
  }
  function writeURL() {
    const q = new URLSearchParams();
    [
      "where",
      "checkin",
      "checkout",
      "guests",
      "min",
      "max",
      "beds",
      "rating",
    ].forEach((k) => state[k] && q.set(k, state[k]));
    state.types.forEach((v) => q.append("type", v));
    state.amenities.forEach((v) => q.append("amenity", v));
    if (state.instant) q.set("instant", "1");
    if (state.access) q.set("access", "1");
    if (state.sort !== "recommended") q.set("sort", state.sort);
    if (state.view === "map") q.set("view", "map");
    const qs = q.toString();
    try {
      history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : ""));
    } catch {}
  }

  /* ---------- Controls <-> state ---------- */
  function readControls() {
    state.where = $("#s-where").value;
    state.checkin = $("#s-in").value;
    state.checkout = $("#s-out").value;
    state.guests = $("#s-guests").value;
    state.sort = sortEl.value;
    const fd = new FormData(filterForm);
    state.types = fd.getAll("type");
    state.min = fd.get("min") || "";
    state.max = fd.get("max") || "";
    state.beds = fd.get("beds") || "";
    state.rating = fd.get("rating") || "";
    state.instant = fd.has("instant");
    state.access = fd.has("access");
    state.amenities = fd.getAll("amenity");
  }
  function applyStateToControls() {
    $("#s-where").value = state.where;
    $("#s-in").value = state.checkin;
    $("#s-out").value = state.checkout;
    $("#s-guests").value = state.guests;
    sortEl.value = state.sort;
    const f = filterForm.elements;
    $$('input[name="type"]', filterForm).forEach(
      (i) => (i.checked = state.types.includes(i.value)),
    );
    $$('input[name="amenity"]', filterForm).forEach(
      (i) => (i.checked = state.amenities.includes(i.value)),
    );
    f.min.value = state.min;
    f.max.value = state.max;
    f.beds.value = state.beds;
    f.rating.value = state.rating;
    f.instant.checked = state.instant;
    f.access.checked = state.access;
  }

  /* ---------- Filtering ---------- */
  function match(p) {
    const w = state.where.trim().toLowerCase();
    if (
      w &&
      ![p.title, p.city, p.country, p.area].some((v) =>
        v.toLowerCase().includes(w),
      )
    )
      return false;
    if (state.guests && p.guests < +state.guests) return false;
    if (state.types.length && !state.types.includes(p.type)) return false;
    if (state.min !== "" && p.price < +state.min) return false;
    if (state.max !== "" && p.price > +state.max) return false;
    if (state.beds && p.bedrooms < +state.beds) return false;
    if (state.rating && p.rating < +state.rating) return false;
    if (state.instant && !p.instant) return false;
    if (state.access && !p.stepFree) return false;
    return state.amenities.every((a) => p.amenities.includes(a));
  }

  let activeCache = [];
  function activeFilters() {
    const f = [];
    state.types.forEach((t) =>
      f.push({
        label: t,
        clear: () => (state.types = state.types.filter((x) => x !== t)),
      }),
    );
    if (state.min !== "" || state.max !== "") {
      const label =
        state.min !== "" && state.max !== ""
          ? `€${state.min}–€${state.max}`
          : state.min !== ""
            ? `From €${state.min}`
            : `Up to €${state.max}`;
      f.push({
        label,
        clear: () => {
          state.min = "";
          state.max = "";
        },
      });
    }
    if (state.beds)
      f.push({
        label: `${state.beds}+ bedrooms`,
        clear: () => (state.beds = ""),
      });
    if (state.rating)
      f.push({
        label: `${state.rating}+ rating`,
        clear: () => (state.rating = ""),
      });
    if (state.instant)
      f.push({
        label: "Instant booking",
        clear: () => (state.instant = false),
      });
    if (state.access)
      f.push({
        label: "Step-free access",
        clear: () => (state.access = false),
      });
    state.amenities.forEach((a) =>
      f.push({
        label: SN.amenities[a],
        clear: () => (state.amenities = state.amenities.filter((x) => x !== a)),
      }),
    );
    return f;
  }

  /* ---------- Render ---------- */
  let current = [];
  let selectedId = null;

  function render({ focusFrom = null } = {}) {
    current = SN.properties.filter(match).sort(sorters[state.sort]);
    const total = current.length;
    const visible = current.slice(0, state.shown);

    grid.innerHTML = visible
      .map((p) => `<li>${SN.cardHTML(p, { reveal: false })}</li>`)
      .join("");
    grid.setAttribute("aria-busy", "false");
    grid.hidden = total === 0;
    SN.syncSaved(grid);
    if (focusFrom !== null)
      grid.querySelectorAll(".card__link")[focusFrom]?.focus();

    const place = state.where.trim();
    const heading = place ? `Stays in ${titleCase(place)}` : "All stays";
    titleEl.textContent = heading;
    document.title = `${place ? heading : "Search stays"} - StayNest`;
    countEl.textContent = total === 1 ? "1 stay" : `${total} stays`;
    showBtn.textContent = total === 1 ? "Show 1 stay" : `Show ${total} stays`;

    activeCache = activeFilters();
    chipsEl.innerHTML = activeCache.length
      ? activeCache
          .map(
            (f, i) =>
              `<button class="chip" type="button" data-chip="${i}" aria-label="Remove filter: ${esc(f.label)}">${esc(f.label)}<svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>`,
          )
          .join("") +
        '<button class="link-btn" type="button" data-clear-filters>Clear all</button>'
      : "";
    badgeEl.textContent = activeCache.length;
    badgeEl.hidden = !activeCache.length;

    emptyEl.hidden = total > 0;
    moreEl.hidden = total <= state.shown;
    moreText.textContent = `Showing ${Math.min(state.shown, total)} of ${total}`;

    renderMap();
  }

  function renderMap() {
    if (!current.length) {
      pinsEl.innerHTML = "";
      select(null);
      return;
    }
    const lats = current.map((p) => p.lat);
    const lngs = current.map((p) => p.lng);
    const minLat = Math.min(...lats),
      maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs),
      maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 0.04),
      spanLng = Math.max(maxLng - minLng, 0.04);
    const cLat = (maxLat + minLat) / 2,
      cLng = (maxLng + minLng) / 2;

    pinsEl.innerHTML = current
      .map((p) => {
        const x = (50 + ((p.lng - cLng) / spanLng) * 76).toFixed(1);
        const y = (50 - ((p.lat - cLat) / spanLat) * 70).toFixed(1);
        return `<button class="pin" type="button" style="--x:${x};--y:${y}" data-id="${p.id}" aria-pressed="false" aria-label="${esc(p.title)}, €${p.price} per night">€${p.price}</button>`;
      })
      .join("");

    select(
      selectedId && current.some((p) => p.id === selectedId)
        ? selectedId
        : null,
    );
  }

  function select(id, { scroll = false } = {}) {
    selectedId = id;
    $$(".pin", pinsEl).forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.id === id)),
    );
    $$(".card", grid).forEach((c) =>
      c.classList.toggle("is-selected", c.dataset.id === id),
    );
    const p = SN.properties.find((x) => x.id === id);
    if (!p) {
      previewEl.classList.remove("is-visible");
      previewEl.innerHTML = "";
      return;
    }
    previewEl.innerHTML = `
      <img src="${p.image}" alt="" width="88" height="88">
      <div>
        <p class="map__preview-title">${p.title}</p>
        <p>${p.city}, ${p.country}</p>
        <p>${p.reviews ? `★ ${p.rating.toFixed(2)} · ` : ""}€${p.price} night</p>
        <a class="link-arrow" href="property.html?id=${p.id}">View stay <svg class="icon" aria-hidden="true"><use href="#i-arrow-up-right"/></svg></a>
      </div>
      <button class="icon-btn" type="button" data-preview-close aria-label="Close preview"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>`;
    previewEl.classList.add("is-visible");
    if (scroll)
      grid
        .querySelector(`.card[data-id="${id}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const setHover = (id) =>
    $$(".pin", pinsEl).forEach((b) =>
      b.classList.toggle("is-active", b.dataset.id === id),
    );

  /* ---------- Commit helpers ---------- */
  function commit() {
    state.shown = PAGE;
    applyStateToControls();
    writeURL();
    render();
  }
  function onControlChange() {
    readControls();
    state.shown = PAGE;
    writeURL();
    render();
  }
  let timer;
  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(onControlChange, 150);
  };

  /* ---------- Filter drawer (mobile) ---------- */
  const desktop = matchMedia("(min-width: 1024px)");
  function setFilters(open) {
    filtersEl.classList.toggle("is-open", open);
    scrim.classList.toggle("is-open", open);
    openBtn.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) $("[data-filters-close]", filtersEl)?.focus();
  }
  function syncDrawerA11y() {
    if (desktop.matches) {
      setFilters(false);
      filtersEl.removeAttribute("role");
      filtersEl.removeAttribute("aria-modal");
    } else {
      filtersEl.setAttribute("role", "dialog");
      filtersEl.setAttribute("aria-modal", "true");
    }
  }

  /* ---------- Build option lists ---------- */
  function buildOptions() {
    const types = [...new Set(SN.properties.map((p) => p.type))].sort();
    $("[data-type-list]").innerHTML = types
      .map(
        (t) =>
          `<label class="check"><input type="checkbox" name="type" value="${t}"> ${t}</label>`,
      )
      .join("");
    $("[data-amenity-list]").innerHTML = Object.entries(SN.amenities)
      .map(
        ([k, v]) =>
          `<label class="check"><input type="checkbox" name="amenity" value="${k}"> ${v}</label>`,
      )
      .join("");
  }

  /* ---------- Events ---------- */
  filterForm.addEventListener("input", debounced);
  filterForm.addEventListener("submit", (e) => e.preventDefault());
  sortEl.addEventListener("change", onControlChange);
  topForm.addEventListener("submit", (e) => {
    e.preventDefault();
    onControlChange();
  });

  chipsEl.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip]");
    if (chip) {
      activeCache[+chip.dataset.chip].clear();
      commit();
      return;
    }
    if (e.target.closest("[data-clear-filters]")) {
      Object.assign(state, filterDefaults());
      commit();
    }
  });
  $("[data-clear-filters]", filtersEl).addEventListener("click", () => {
    Object.assign(state, filterDefaults());
    commit();
  });
  $("[data-reset-all]").addEventListener("click", () => {
    Object.assign(state, filterDefaults(), {
      where: "",
      checkin: "",
      checkout: "",
      guests: "",
    });
    commit();
  });

  $("[data-more-btn]").addEventListener("click", () => {
    const prev = state.shown;
    state.shown += PAGE;
    render({ focusFrom: prev });
  });

  $$("[data-view-btn]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.view = btn.dataset.viewBtn;
      layout.dataset.view = state.view;
      $$("[data-view-btn]").forEach((b) =>
        b.setAttribute("aria-pressed", String(b === btn)),
      );
      writeURL();
    }),
  );

  pinsEl.addEventListener("click", (e) => {
    const pin = e.target.closest(".pin");
    if (pin) select(pin.dataset.id, { scroll: true });
  });
  previewEl.addEventListener("click", (e) => {
    if (e.target.closest("[data-preview-close]")) select(null);
  });
  grid.addEventListener("pointerover", (e) =>
    setHover(e.target.closest(".card")?.dataset.id || null),
  );
  grid.addEventListener("pointerleave", () => setHover(null));
  grid.addEventListener("focusin", (e) =>
    setHover(e.target.closest(".card")?.dataset.id || null),
  );
  grid.addEventListener("focusout", () => setHover(null));

  openBtn.addEventListener("click", () => setFilters(true));
  $$("[data-filters-close]").forEach((b) =>
    b.addEventListener("click", () => {
      setFilters(false);
      openBtn.focus();
    }),
  );
  scrim.addEventListener("click", () => setFilters(false));
  addEventListener("keydown", (e) => {
    if (!filtersEl.classList.contains("is-open")) return;
    if (e.key === "Escape") {
      setFilters(false);
      openBtn.focus();
      return;
    }
    if (e.key === "Tab") {
      const f = $$("button, input, select", filtersEl).filter(
        (el) => el.offsetParent !== null,
      );
      const first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  desktop.addEventListener("change", syncDrawerA11y);

  /* ---------- Init ---------- */
  buildOptions();
  readURL();
  applyStateToControls();
  layout.dataset.view = state.view;
  $$("[data-view-btn]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.viewBtn === state.view)),
  );
  syncDrawerA11y();
  render();
})();
