(() => {
  "use strict";
  const SN = window.StayNest;
  const R = SN.reviews;
  const B = SN.bookings;
  const { plural } = SN;
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
  const d = (s) =>
    dateFmt.format(new Date(s.length === 10 ? `${s}T00:00:00` : s));
  const stars = (n) => `★ ${Number.isInteger(n) ? n : n.toFixed(1)}`;

  const hostedIds = new Set(SN.listings.hosted().map((i) => i.id));
  const propertyOf = (id) => SN.allProperties.find((p) => p.id === id);
  const live = $("[data-live]");

  function render() {
    const received = R.byAuthor("guest")
      .filter((r) => hostedIds.has(r.propertyId))
      .sort((a, b) => b.date.localeCompare(a.date));
    const sent = R.byAuthor("host")
      .filter((r) => hostedIds.has(r.propertyId))
      .sort((a, b) => b.date.localeCompare(a.date));
    const awaiting = B.forHost()
      .filter(
        (b) =>
          hostedIds.has(b.id) &&
          B.phase(b) === "past" &&
          !R.forBooking(b.ref, "host"),
      )
      .sort((a, b) => b.checkout.localeCompare(a.checkout));

    const avg = received.length
      ? received.reduce((s, r) => s + r.overall, 0) / received.length
      : null;
    const replied = received.filter((r) => r.reply).length;
    const kpis = [
      ["Guest reviews", String(received.length), "Written by guests"],
      [
        "Average rating",
        avg === null ? "—" : avg.toFixed(2),
        "From reviews in this browser",
      ],
      [
        "Replied to",
        received.length
          ? `${Math.round((replied / received.length) * 100)}%`
          : "—",
        received.length
          ? `${replied} of ${received.length}`
          : "Nothing to reply to",
      ],
      ["To review", String(awaiting.length), "Guests you haven't reviewed"],
    ];
    $("[data-kpis]").innerHTML = kpis
      .map(
        ([l, v, h]) =>
          `<div class="kpi"><p class="kpi__label">${l}</p><p class="kpi__value">${v}</p><p class="kpi__hint">${h}</p></div>`,
      )
      .join("");

    $("[data-await]").innerHTML = awaiting
      .map((b) => {
        const p = propertyOf(b.id);
        if (!p) return "";
        return `<li class="row row--res">
        <div><p class="row__title">${esc(b.name || "Guest")}</p><p class="row__sub">${esc(b.ref)}</p></div>
        <div><p class="row__title">${esc(p.title)}</p><p class="row__sub">${esc(p.city)}, ${esc(p.country)}</p></div>
        <div><p class="row__title">${esc(d(b.checkin))} – ${esc(d(b.checkout))}</p><p class="row__sub">${plural(SN.nights(b.checkin, b.checkout), "night")}</p></div>
        <a class="btn btn--primary btn--sm" href="review.html?ref=${esc(b.ref)}&as=host">Review guest</a>
      </li>`;
      })
      .join("");
    $("[data-await-empty]").hidden = awaiting.length > 0;

    $("[data-received]").innerHTML = received
      .map((r) => {
        const p = propertyOf(r.propertyId);
        return `<li class="rv-card">
        <div class="rv-card__head">
          <p class="row__title">${esc(r.author || "StayNest guest")} · <span class="row__sub">${esc(p ? p.title : "")}</span></p>
          <p class="rv-card__stars">${stars(r.overall)} <span class="row__sub">${esc(d(r.date))}</span></p>
        </div>
        <p class="rv-card__text">${esc(r.text)}</p>
        ${
          r.reply
            ? `<div class="review__reply"><p class="review__reply-by">Your reply · ${esc(d(r.reply.date))}</p><p>${esc(r.reply.text)}</p></div>`
            : `<form class="reply-form" data-reply="${esc(r.id)}" novalidate>
              <label class="visually-hidden" for="reply-${esc(r.id)}">Reply to ${esc(r.author || "this guest")}</label>
              <textarea class="input" id="reply-${esc(r.id)}" rows="3" maxlength="600" placeholder="Write a public reply" aria-describedby="reply-err-${esc(r.id)}"></textarea>
              <p class="field__error" id="reply-err-${esc(r.id)}"></p>
              <button class="btn btn--outline btn--sm" type="submit">Post reply</button>
            </form>`
        }
      </li>`;
      })
      .join("");
    $("[data-received]").hidden = !received.length;
    $("[data-recv-empty]").hidden = received.length > 0;

    $("[data-sent]").innerHTML = sent
      .map((r) => {
        const b = B.forHost().find((x) => x.ref === r.ref);
        const p = propertyOf(r.propertyId);
        return `<li class="rv-card">
        <div class="rv-card__head">
          <p class="row__title">${esc(b?.name || "Guest")} · <span class="row__sub">${esc(p ? p.title : "")}</span></p>
          <p class="rv-card__stars">${stars(r.overall)} <span class="row__sub">${esc(d(r.date))}</span></p>
        </div>
        <p class="rv-card__text">${esc(r.text)}</p>
      </li>`;
      })
      .join("");
    $("[data-sent]").hidden = !sent.length;
    $("[data-sent-empty]").hidden = sent.length > 0;
  }

  $("[data-received]").addEventListener("submit", (e) => {
    const form = e.target.closest("[data-reply]");
    if (!form) return;
    e.preventDefault();
    const id = form.dataset.reply;
    const text = form.querySelector("textarea").value.trim();
    const err = form.querySelector(".field__error");
    if (text.length < 5) {
      err.textContent = "Write a short reply first.";
      form.querySelector("textarea").focus();
      return;
    }
    if (!R.reply(id, text)) {
      err.textContent = "We couldn't save your reply. Try again.";
      return;
    }
    render();
    live.textContent = "Reply posted";
  });

  render();
})();
