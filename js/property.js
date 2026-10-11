(() => {
  "use strict";
  const SN = window.StayNest;
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
  const set = (sel, text) => {
    const el = $(sel);
    if (el) el.textContent = text;
  };
  const { plural, fmt } = SN;
  const icon = (n) =>
    `<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`;

  const q = new URLSearchParams(location.search);
  const p = SN.properties.find((x) => x.id === q.get("id"));
  const view = $("#property");

  /* Not found */
  if (!p) {
    $("#not-found").hidden = false;
    $(".crumbs").hidden = true;
    document.title = "Stay not found — StayNest";
    return;
  }

  /* Head, meta, crumbs */
  const about = SN.about[p.id] || p.about;
  const heading = `${p.title}, ${p.city}`;
  document.title = `${heading} - StayNest`;
  $('meta[name="description"]').content = about;
  $('meta[property="og:title"]').content = `${heading} - StayNest`;
  $('meta[property="og:image"]').content = p.image;

  const cityLink = $("[data-crumb-city]");
  cityLink.textContent = p.city;
  cityLink.href = `search.html?where=${encodeURIComponent(p.city)}`;
  set("[data-crumb-title]", p.title);

  set("[data-kicker]", `${p.type} · ${p.area}`);
  set("[data-title]", p.title);
  if (p.reviews) {
    set("[data-rating]", p.rating.toFixed(2));
    set("[data-review-count]", plural(p.reviews, "review"));
  } else {
    set("[data-rating]", "New");
  }
  set("[data-location]", `${p.city}, ${p.country}`);

  const saveBtn = $("[data-save]");
  saveBtn.dataset.save = p.id;
  saveBtn.setAttribute("aria-label", `Save ${p.title}`);
  SN.syncSaved(view);

  /* Gallery + lightbox */
  const imgs =
    SN.galleries?.[p.id] || (p.gallery?.length ? p.gallery : [p.image]);
  const shown = imgs.length >= 5 ? 5 : imgs.length === 4 ? 3 : imgs.length;
  $("[data-gallery]").innerHTML =
    `<ul class="gallery__grid gallery__grid--${shown}" role="list">${imgs
      .slice(0, shown)
      .map(
        (src, i) =>
          `<li class="gallery__item"><button class="gallery__btn" type="button" data-open="${i}" aria-label="Open photo ${i + 1} of ${imgs.length}"><img src="${src}" alt="${esc(p.title)}, photo ${i + 1}" width="1200" height="900"${i ? ' loading="lazy"' : ' fetchpriority="high"'}></button></li>`,
      )
      .join("")}</ul>` +
    (imgs.length > 1
      ? `<button class="btn btn--light btn--sm gallery__all" type="button" data-open="0">${icon("grid")}Show all photos (${imgs.length})</button>`
      : "");

  const lb = $("#lightbox");
  const lbImg = $("[data-lb-img]");
  const lbCap = $("[data-lb-cap]");
  let idx = 0;
  const showPhoto = (i) => {
    idx = (i + imgs.length) % imgs.length;
    lbImg.src = imgs[idx];
    lbImg.alt = `${p.title}, photo ${idx + 1} of ${imgs.length}`;
    lbCap.textContent = `${idx + 1} / ${imgs.length}`;
  };
  $$("[data-lb-prev], [data-lb-next]").forEach(
    (b) => (b.hidden = imgs.length < 2),
  );
  $("[data-gallery]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (!b) return;
    showPhoto(+b.dataset.open);
    lb.showModal();
  });
  $("[data-lb-close]").addEventListener("click", () => lb.close());
  $("[data-lb-prev]").addEventListener("click", () => showPhoto(idx - 1));
  $("[data-lb-next]").addEventListener("click", () => showPhoto(idx + 1));
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") showPhoto(idx + 1);
    if (e.key === "ArrowLeft") showPhoto(idx - 1);
  });
  lb.addEventListener("click", (e) => {
    if (e.target === lb) lb.close();
  });

  /* Facts, highlights, about, amenities */
  set(
    "[data-facts-title]",
    `Entire ${p.type.toLowerCase()} hosted by ${SN.host.name}`,
  );
  $("[data-facts]").innerHTML = [
    plural(p.guests, "guest"),
    plural(p.bedrooms, "bedroom"),
    plural(p.beds, "bed"),
    plural(p.baths, "bath"),
  ]
    .map((t) => `<li>${t}</li>`)
    .join("");
  const highlights = [
    p.instant
      ? "Instant booking: confirm your dates straight away."
      : "Request to book: the host replies before you are charged.",
    ...(p.stepFree ? ["Step-free access to the main living areas."] : []),
  ];
  $("[data-highlights]").innerHTML = highlights
    .map((t) => `<li>${icon("check")}<span>${t}</span></li>`)
    .join("");
  set("[data-about]", about);
  $("[data-amenities]").innerHTML = p.amenities
    .map((a) => `<li>${icon("check")}${SN.amenities[a]}</li>`)
    .join("");

  /* Host */
  $(".host-card__cta").href = `messages.html?property=${p.id}`;

  /* Reviews */
  const escR = (s) =>
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
  const real = SN.reviews.forProperty(p.id);
  const sum = SN.reviews.summary(p, real);
  $("#reviews").hidden = !sum;
  if (sum) {
    set("[data-rv-score]", sum.score.toFixed(2));
    set("[data-rv-count]", plural(sum.count, "review"));
    $("[data-bars]").innerHTML = sum.cats
      .map(
        ([label, v]) =>
          `<li class="bar"><span>${label}</span><span class="bar__track" role="img" aria-label="${label}: ${v.toFixed(1)} out of 5"><span class="bar__fill" style="--v:${v.toFixed(2)}"></span></span><strong>${v.toFixed(1)}</strong></li>`,
      )
      .join("");

    const monthFmt = new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
    });
    const pool = p.reviews
      ? Array.from(
          { length: 6 },
          (_, i) => SN.reviewPool[(i + p.rank) % SN.reviewPool.length],
        )
      : [];
    const items = [
      ...real.map((r) => ({
        id: r.id,
        rating: r.overall,
        date: r.date.slice(0, 7),
        text: escR(r.text),
        name: escR(r.author || "StayNest guest"),
        reply: r.reply,
      })),
      ...pool.map((r) => ({ ...r, name: "StayNest guest", reply: null })),
    ];
    $("[data-reviews]").innerHTML = items
      .map(
        (r) => `
      <article class="review">
        <header class="review__head">
          <span class="avatar avatar--sm" aria-hidden="true">${icon("user")}</span>
          <div>
            <p class="review__name">${r.name}</p>
            <p class="review__date"><time datetime="${r.date}">${monthFmt.format(new Date(`${r.date}-01`))}</time></p>
          </div>
          <p class="review__stars">${icon("star")}<span>${Number.isInteger(r.rating) ? r.rating : r.rating.toFixed(1)}</span></p>
        </header>
        <p class="review__text">${r.text}</p>
        ${r.id ? `<button class="link-btn" type="button" data-report data-type="review" data-id="${r.id}" data-label="${r.text.slice(0, 60)}">Report</button>` : ""}
        ${r.reply ? `<div class="review__reply"><p class="review__reply-by">Reply from ${escR(SN.host.name)}</p><p>${escR(r.reply.text)}</p></div>` : ""}
      </article>`,
      )
      .join("");
  }

  if (!p.reviews) $("#reviews").hidden = true;

  const reportBtn = $('[data-report][data-type="listing"]');
  if (reportBtn) {
    reportBtn.dataset.id = p.id;
    reportBtn.dataset.label = p.title;
  }

  /* Location */
  set("[data-map-pin]", fmt(p.price));
  set("[data-area]", `${p.area}, ${p.city}. ${SN.areas[p.city] || ""}`);

  /* Booking */
  set("[data-price]", fmt(p.price));
  set("[data-bar-price]", fmt(p.price));
  $("[data-reserve-bar]").hidden = false;

  const form = $("[data-booking]");
  const inEl = $("#b-in");
  const outEl = $("#b-out");
  const gEl = $("#b-guests");
  const errEl = $("[data-error]");
  const cta = $("[data-reserve]");
  const breakdown = $("[data-breakdown]");

  gEl.innerHTML = Array.from(
    { length: p.guests },
    (_, i) => `<option value="${i + 1}">${plural(i + 1, "guest")}</option>`,
  ).join("");
  gEl.value = String(Math.min(Math.max(+q.get("guests") || 2, 1), p.guests));
  const today = new Date().toISOString().split("T")[0];
  inEl.min = outEl.min = today;
  inEl.value = q.get("checkin") || "";
  outEl.value = q.get("checkout") || "";

  function updateBooking() {
    errEl.hidden = true;
    breakdown.hidden = true;
    cta.disabled = true;
    cta.textContent = "Add dates to reserve";
    if (!inEl.value || !outEl.value) return;

    const problem = SN.validateStay(inEl.value, outEl.value, p.id);
    if (problem) {
      errEl.textContent = problem;
      errEl.hidden = false;
      return;
    }

    const n = SN.nights(inEl.value, outEl.value);
    const t = SN.quote(p, n);
    set("[data-l-nights]", `${fmt(p.price)} × ${plural(n, "night")}`);
    set("[data-v-nights]", fmt(t.subtotal));
    set("[data-v-cleaning]", fmt(t.cleaning));
    set("[data-v-service]", fmt(t.service));
    set("[data-v-tax]", fmt(t.tax));
    set("[data-v-total]", fmt(t.total));
    breakdown.hidden = false;
    cta.disabled = false;
    cta.textContent = "Reserve";
  }
  inEl.addEventListener("change", () => {
    outEl.min = inEl.value || today;
    if (outEl.value && outEl.value <= inEl.value) outEl.value = "";
    updateBooking();
  });
  outEl.addEventListener("change", updateBooking);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (cta.disabled) return;
    location.href = `booking.html?${new URLSearchParams({ id: p.id, checkin: inEl.value, checkout: outEl.value, guests: gEl.value })}`;
  });
  outEl.min = inEl.value || today;
  updateBooking();

  /* Similar stays */
  const score = (x) =>
    (x.city === p.city ? 2 : 0) + (x.type === p.type ? 1 : 0);
  const similar = SN.properties
    .filter((x) => x.id !== p.id)
    .sort((a, b) => score(b) - score(a) || a.rank - b.rank)
    .slice(0, 3);
  $("[data-similar]").innerHTML = similar
    .map((s) => `<li>${SN.cardHTML(s, { reveal: false })}</li>`)
    .join("");
  SN.syncSaved($("[data-similar]"));

  /* Structured data */
  const ld = document.createElement("script");
  ld.type = "application/ld+json";
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: p.title,
    description: about,
    image: new URL(p.image, location.href).href,
    address: {
      "@type": "PostalAddress",
      addressLocality: p.city,
      addressCountry: p.country,
    },
    priceRange: `€${p.price} per night`,
    ...(p.reviews
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: p.rating,
            reviewCount: p.reviews,
          },
        }
      : {}),
  });
  document.head.appendChild(ld);

  view.hidden = false;
})();
