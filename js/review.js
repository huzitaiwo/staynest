// js/review.js
(() => {
  "use strict";
  const SN = window.StayNest;
  const R = SN.reviews;
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

  const q = new URLSearchParams(location.search);
  const ref = q.get("ref");
  const as = q.get("as") === "host" ? "host" : "guest";
  const b = SN.bookings.read().find((x) => x.ref === ref);
  const p = b && SN.allProperties.find((x) => x.id === b.id);

  const MODES = {
    guest: {
      cats: R.STAY_CATS,
      back: "trips.html",
      eyebrow: (pp) => pp.title,
      title: "How was your stay?",
      lead: "Your review helps other guests choose, and helps the host improve.",
      textLabel: "Tell future guests about your stay",
      note: "Your first name and review appear on the stay's page. This is a demo, so reviews are saved only in this browser.",
      done: "Thanks for your review",
      doneText: "It now appears on the stay's page.",
      doneLink: (pp) => [
        `property.html?id=${pp.id}#reviews`,
        "See it on the stay",
      ],
    },
    host: {
      cats: R.GUEST_CATS,
      back: "hosting-reviews.html",
      eyebrow: (pp, bk) => `${bk.name || "Guest"} · ${pp.title}`,
      title: "Review your guest",
      lead: "Let the guest and other hosts know what it was like to host them.",
      textLabel: "Tell us about hosting this guest",
      note: "This is a demo, so your review is saved only in this browser.",
      done: "Guest review saved",
      doneText: "Thanks for helping keep the community trustworthy.",
      doneLink: () => ["hosting-reviews.html", "Back to reviews"],
    },
  };
  const mode = MODES[as];
  $("[data-back]").href = mode.back;
  $("[data-blocked-link]").href = mode.back;

  const show = (name) =>
    ["form-wrap", "done", "blocked", "missing"].forEach((k) => {
      $(`[data-${k}]`).hidden = k !== name;
    });

  function showDone(title, text, review) {
    const [href, label] = mode.doneLink(p);
    $("[data-done-title]").textContent = title;
    $("[data-done-text]").textContent = text;
    const link = $("[data-done-link]");
    link.href = href;
    link.textContent = label;
    const quote = $("[data-done-quote]");
    quote.hidden = !review;
    if (review)
      quote.innerHTML = `<p class="review__stars-line">★ ${review.overall.toFixed(1)}</p><p>${esc(review.text)}</p>`;
    show("done");
    $("[data-done-title]").focus();
  }

  const hostedIds = new Set(SN.listings.hosted().map((i) => i.id));
  if (!b || !p || (as === "host" && !hostedIds.has(b.id))) {
    show("missing");
  } else if (SN.bookings.phase(b) !== "past") {
    show("blocked");
  } else if (R.forBooking(ref, as)) {
    showDone(
      "You've already reviewed this stay",
      "Here is what you wrote.",
      R.forBooking(ref, as),
    );
  } else {
    $("[data-eyebrow]").textContent = mode.eyebrow(p, b);
    $("[data-title]").textContent = mode.title;
    $("[data-lead]").textContent = mode.lead;
    $("[data-text-label]").textContent = mode.textLabel;
    $("[data-demo-note]").textContent = mode.note;

    $("[data-cats]").innerHTML = mode.cats
      .map(
        ([key, label]) => `
      <fieldset class="rate" aria-describedby="err-${key}">
        <legend class="rate__label">${label}</legend>
        <div class="rate__stars">
          ${[5, 4, 3, 2, 1].map((n) => `<input class="visually-hidden" type="radio" name="${key}" id="${key}-${n}" value="${n}"><label for="${key}-${n}" title="${n} out of 5"><span class="visually-hidden">${n} out of 5</span><span aria-hidden="true">★</span></label>`).join("")}
        </div>
        <p class="field__error" id="err-${key}"></p>
      </fieldset>`,
      )
      .join("");
    show("form-wrap");

    const form = $("[data-form]");
    const text = $("#r-text");
    text.addEventListener("input", () => {
      $("[data-count]").textContent = text.value.length;
    });

    form.addEventListener("change", (e) => {
      if (e.target.type === "radio")
        $(`#err-${e.target.name}`).textContent = "";
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ratings = {};
      let firstBad = null;
      mode.cats.forEach(([key]) => {
        const v = form.querySelector(`input[name="${key}"]:checked`);
        const err = $(`#err-${key}`);
        if (v) {
          ratings[key] = +v.value;
          err.textContent = "";
        } else {
          err.textContent = "Choose a rating from 1 to 5.";
          firstBad = firstBad || form.querySelector(`input[name="${key}"]`);
        }
      });
      const body = text.value.trim();
      const tErr = $("#r-text-err");
      if (body.length < 20) {
        tErr.textContent = "Please write at least 20 characters.";
        firstBad = firstBad || text;
      } else tErr.textContent = "";
      if (firstBad) {
        firstBad.focus();
        return;
      }

      const author =
        as === "host" ? SN.host.name : (b.name || "").trim().split(" ")[0];
      if (
        !R.add({ ref, propertyId: p.id, by: as, ratings, text: body, author })
      ) {
        tErr.textContent =
          "We couldn't save your review. Check your browser storage and try again.";
        return;
      }
      showDone(mode.done, mode.doneText, R.forBooking(ref, as));
    });
  }
})();
