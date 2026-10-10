(() => {
  "use strict";
  const SN = window.StayNest;
  const { plural, fmt } = SN;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (sel, text) => {
    const el = $(sel);
    if (el) el.textContent = text;
  };

  /* Bookings are kept in this browser only until a backend exists. */
  const { read: readBookings, add: saveBooking } = SN.bookings;

  const q = new URLSearchParams(location.search);
  const stored = readBookings().find((b) => b.ref === q.get("ref"));
  const p = SN.allProperties.find(
    (x) => x.id === (stored ? stored.id : q.get("id")),
  );

  const checkoutEl = $("[data-checkout]");
  const confirmEl = $("[data-confirmation]");

  if (!p) {
    $("[data-missing]").hidden = false;
    $("[data-head]").hidden = true;
    return;
  }

  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const d = (s) => dateFmt.format(new Date(`${s}T00:00:00`));

  /* State */
  const state = {
    checkin: q.get("checkin") || "",
    checkout: q.get("checkout") || "",
    guests: Math.min(Math.max(+q.get("guests") || 2, 1), p.guests),
    note: "",
  };
  let step = 1;
  let paying = false;

  /* Static page bits */
  const back = $("[data-back]");
  back.href = `property.html?id=${p.id}`;
  $("span", back).textContent = `Back to ${p.title}`;
  document.title = `Confirm your stay at ${p.title} — StayNest`;
  $("[data-s-img]").src = p.image;
  set("[data-s-type]", p.type);
  set("[data-s-title]", p.title);
  set("[data-s-loc]", `${p.city}, ${p.country}`);
  set("[data-s-rating]", `${p.rating.toFixed(2)} (${p.reviews})`);

  /* Step 1 inputs */
  const inEl = $("#t-in");
  const outEl = $("#t-out");
  const gEl = $("#t-guests");
  const noteEl = $("#t-note");
  const datesErr = $("#dates-err");
  const today = new Date().toISOString().split("T")[0];

  gEl.innerHTML = Array.from(
    { length: p.guests },
    (_, i) => `<option value="${i + 1}">${plural(i + 1, "guest")}</option>`,
  ).join("");
  inEl.min = outEl.min = today;
  inEl.value = state.checkin;
  outEl.value = state.checkout;
  outEl.min = state.checkin || today;
  gEl.value = String(state.guests);

  const readTrip = () => {
    state.checkin = inEl.value;
    state.checkout = outEl.value;
    state.guests = +gEl.value;
    state.note = noteEl.value.trim();
  };

  function syncURL() {
    const params = new URLSearchParams({ id: p.id, guests: state.guests });
    if (state.checkin) params.set("checkin", state.checkin);
    if (state.checkout) params.set("checkout", state.checkout);
    try {
      history.replaceState(null, "", `${location.pathname}?${params}`);
    } catch {}
  }

  /* Summary */
  const payBtn = $("[data-pay]");
  function renderSummary() {
    const problem =
      state.checkin && state.checkout
        ? SN.validateStay(state.checkin, state.checkout, p.id)
        : "incomplete";
    const bd = $("[data-s-breakdown]");
    set("[data-s-guests]", plural(state.guests, "guest"));
    if (problem) {
      set("[data-s-dates]", "Add dates");
      bd.hidden = true;
      $("[data-s-empty]").hidden = false;
      payBtn.textContent = "Pay";
      return null;
    }
    const n = SN.nights(state.checkin, state.checkout);
    const t = SN.quote(p, n);
    set("[data-s-dates]", `${d(state.checkin)} – ${d(state.checkout)}`);
    set("[data-s-l-nights]", `${fmt(p.price)} × ${plural(n, "night")}`);
    set("[data-s-v-nights]", fmt(t.subtotal));
    set("[data-s-v-cleaning]", fmt(t.cleaning));
    set("[data-s-v-service]", fmt(t.service));
    set("[data-s-v-tax]", fmt(t.tax));
    set("[data-s-v-total]", fmt(t.total));
    bd.hidden = false;
    $("[data-s-empty]").hidden = true;
    payBtn.textContent = `Pay ${fmt(t.total)}`;
    return t;
  }

  function validateTrip() {
    readTrip();
    const msg =
      !state.checkin || !state.checkout
        ? "Choose your check-in and check-out dates."
        : SN.validateStay(state.checkin, state.checkout, p.id);
    datesErr.textContent = msg;
    [inEl, outEl].forEach((el) =>
      el.setAttribute("aria-invalid", String(Boolean(msg))),
    );
    if (msg) (state.checkin ? outEl : inEl).focus();
    return !msg;
  }

  [inEl, outEl, gEl, noteEl].forEach((el) =>
    el.addEventListener("input", () => {
      if (el === inEl) {
        outEl.min = inEl.value || today;
        if (outEl.value && outEl.value <= inEl.value) outEl.value = "";
      }
      readTrip();
      if (
        datesErr.textContent &&
        state.checkin &&
        state.checkout &&
        !SN.validateStay(state.checkin, state.checkout, p.id)
      ) {
        datesErr.textContent = "";
        [inEl, outEl].forEach((x) => x.setAttribute("aria-invalid", "false"));
      }
      renderSummary();
      syncURL();
    }),
  );

  /* Field validation */
  const luhn = (num) => {
    let sum = 0;
    [...num].reverse().forEach((ch, i) => {
      let n = +ch;
      if (i % 2) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
    });
    return sum % 10 === 0;
  };
  const rules = {
    cname: (v) => (v.trim().length >= 2 ? "" : "Enter the name on the card."),
    cnum: (v) => {
      const n = v.replace(/\s/g, "");
      return /^\d{13,19}$/.test(n) && luhn(n)
        ? ""
        : "Enter a valid card number.";
    },
    cexp: (v) => {
      const m = /^(\d{2})\/(\d{2})$/.exec(v);
      if (!m) return "Use the format MM/YY.";
      const month = +m[1];
      if (month < 1 || month > 12) return "Enter a valid month.";
      return new Date(2000 + +m[2], month, 1) > new Date()
        ? ""
        : "This card has expired.";
    },
    ccvc: (v) => (/^\d{3,4}$/.test(v) ? "" : "Enter the 3 or 4 digit code."),
    terms: (v) => (v ? "" : "Please accept to continue."),
  };
  const checkField = (el) => SN.checkField(el, rules);
  function validateStep(n) {
    const bad = $$(`[data-step="${n}"] [data-rule]`).filter(
      (el) => !checkField(el),
    );
    bad[0]?.focus();
    return bad.length === 0;
  }
  $$("[data-rule]").forEach((el) => {
    el.addEventListener("blur", () => {
      if (el.value || el.checked) checkField(el);
    });
    el.addEventListener("input", () => {
      if (el.getAttribute("aria-invalid") === "true") checkField(el);
    });
  });

  /* Input formatting */
  $("#p-num").addEventListener("input", (e) => {
    e.target.value = e.target.value
      .replace(/\D/g, "")
      .slice(0, 19)
      .replace(/(\d{4})(?=\d)/g, "$1 ");
  });
  $("#p-exp").addEventListener("input", (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
    e.target.value =
      digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  });
  $("#p-cvc").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  });

  /* Steps */
  const panels = $$("[data-step]");
  const stepperItems = $$("[data-stepper] li");
  function setStep(n, { focus = true } = {}) {
    step = n;
    panels.forEach((el) => (el.hidden = +el.dataset.step !== n));
    stepperItems.forEach((li, i) => {
      li.classList.toggle("is-current", i + 1 === n);
      li.classList.toggle("is-done", i + 1 < n);
      if (i + 1 === n) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
    if (focus) {
      $(`#st${n}`).focus({ preventScroll: true });
      $("[data-stepper]").scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }
  function next() {
    if (step === 1 && validateTrip()) setStep(2);
    else if (step === 2 && validateStep(2)) setStep(3);
  }
  $$("[data-next]").forEach((b) => b.addEventListener("click", next));
  $$("[data-back-step]").forEach((b) =>
    b.addEventListener("click", () => setStep(step - 1)),
  );
  $("[data-form]").addEventListener("submit", (e) => {
    e.preventDefault();
    if (step < 3) next();
    else pay();
  });

  /* Payment (simulated) */
  const payError = $("[data-pay-error]");
  const showPayError = (msg) => {
    payError.textContent = msg;
    payError.hidden = false;
    payError.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  async function pay() {
    if (paying) return;
    payError.hidden = true;
    if (!validateTrip()) {
      setStep(1);
      return;
    }
    if (!validateStep(3)) return;
    if (!navigator.onLine) {
      showPayError(
        "You appear to be offline. Check your connection and try again. You haven't been charged.",
      );
      return;
    }

    paying = true;
    payBtn.classList.add("is-loading");
    payBtn.setAttribute("aria-busy", "true");
    await new Promise((r) => setTimeout(r, 1400));
    paying = false;
    payBtn.classList.remove("is-loading");
    payBtn.removeAttribute("aria-busy");

    const digits = $("#p-num").value.replace(/\s/g, "");
    if (digits === "4000000000000002") {
      showPayError(
        "Your card was declined. Try a different card or contact your bank. You have not been charged.",
      );
      return;
    }

    const t = SN.quote(p, SN.nights(state.checkin, state.checkout));
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const booking = {
      ref: `SN-${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`,
      id: p.id,
      checkin: state.checkin,
      checkout: state.checkout,
      guests: state.guests,
      total: t.total,
      name: $("#c-name").value.trim(),
      last4: digits.slice(-4),
      status: "confirmed",
      paidAt: new Date().toISOString(),
    };
    saveBooking(booking);
    try {
      history.replaceState(null, "", `${location.pathname}?ref=${booking.ref}`);
    } catch {}
    showConfirmation(booking);
  }

  /* Confirmation */
  function showConfirmation(b) {
    checkoutEl.hidden = true;
    confirmEl.hidden = false;
    set("[data-eyebrow]", "Reservation confirmed");
    set("[data-title]", "Booked.");
    $("[data-back]").hidden = true;
    set("[data-c-ref]", b.ref);
    set("[data-c-title]", `${p.title}, ${p.city}`);
    set("[data-c-dates]", `${d(b.checkin)} – ${d(b.checkout)}`);
    set("[data-c-guests]", plural(b.guests, "guest"));
    set("[data-c-name]", b.name);
    set("[data-c-total]", fmt(b.total));
    set("[data-c-card]", `Demo card ending ${b.last4}`);
    $("[data-c-link]").href = `property.html?id=${p.id}`;
    $("#confirm-title").focus();
    $("[data-ics]").onclick;
  }

  /* Init */
  if (stored) {
    showConfirmation(stored);
  } else {
    checkoutEl.hidden = false;
    renderSummary();
    setStep(1, { focus: false });
  }
})();
