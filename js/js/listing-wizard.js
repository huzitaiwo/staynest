(() => {
  "use strict";
  const SN = window.StayNest;
  const L = SN.listings;
  const { fmt } = SN;
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

  const TYPES = [
    ["House", "A whole home with its own entrance."],
    ["Apartment", "A flat or loft in a building."],
    ["Villa", "A larger home, often with a pool or garden."],
    ["Cabin", "A small, simple retreat in nature."],
    ["Retreat", "A place made for switching off."],
    ["Riad", "A courtyard house, traditionally in Morocco."],
  ];
  const COUNTERS = [
    ["guests", "Guests", 1, 16],
    ["bedrooms", "Bedrooms", 0, 12],
    ["beds", "Beds", 1, 20],
    ["baths", "Bathrooms", 1, 10],
  ];
  const STEPS = [
    "Property type",
    "Location",
    "Space",
    "Amenities",
    "Photos",
    "Description",
    "Pricing",
    "Availability",
    "Review",
  ];
  const FIELDS = {
    country: "#w-country",
    city: "#w-city",
    area: "#w-area",
    title: "#w-title",
    note: "#w-note",
    description: "#w-desc",
    price: "#w-price",
    minNights: "#w-nights",
  };
  const MAX_PHOTOS = 6;
  const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="533"><rect width="100%" height="100%" fill="#e8dfd2"/></svg>')}`;

  const rules = {
    country: (v) => (v.trim().length >= 2 ? "" : "Enter the country."),
    city: (v) => (v.trim().length >= 2 ? "" : "Enter the city."),
    title: (v) =>
      v.trim().length >= 10 && v.trim().length <= 60
        ? ""
        : "Use 10 to 60 characters.",
    note: (v) =>
      v.trim().length <= 70 ? "" : "Keep it to 70 characters or fewer.",
    desc: (v) =>
      v.trim().length >= 50 && v.trim().length <= 1000
        ? ""
        : "Write between 50 and 1,000 characters.",
    price: (v) =>
      /^\d+$/.test(v) && +v >= 20 && +v <= 5000
        ? ""
        : "Enter a whole number between €20 and €5,000.",
    nights: (v) =>
      /^\d+$/.test(v) && +v >= 1 && +v <= 30 ? "" : "Enter 1 to 30 nights.",
  };

  const blank = () => ({
    id: null,
    status: "draft",
    type: "",
    country: "",
    city: "",
    area: "",
    guests: 2,
    bedrooms: 1,
    beds: 1,
    baths: 1,
    amenities: [],
    stepFree: false,
    photos: [],
    title: "",
    note: "",
    description: "",
    price: "",
    instant: false,
    minNights: "1",
  });

  const wizardEl = $("[data-wizard]");
  const form = $("[data-form]");
  const preview = $("[data-preview]");
  const errBox = $("[data-error]");
  let draft = blank();
  let step = 1;
  let dirty = false;

  function block(title, text) {
    wizardEl.hidden = true;
    $("[data-blocked]").hidden = false;
    $("[data-blocked-title]").textContent = title;
    $("[data-blocked-text]").textContent = text;
  }

  /* Load an existing listing when editing */
  const editId = new URLSearchParams(location.search).get("id");
  if (editId) {
    if (L.isSample(editId)) {
      block(
        "This is an example listing",
        "Example stays can be published or unpublished from your overview, but not edited.",
      );
      return;
    }
    const found = L.get(editId);
    if (!found) {
      block("We couldn't find that listing", "It may have been deleted.");
      return;
    }
    draft = { ...blank(), ...found };
  }
  const isNew = !editId;
  document.title = `${isNew ? "Create a listing" : "Edit listing"} — StayNest`;

  /* Build the generated parts of the form */
  $("[data-types]").innerHTML = TYPES.map(
    ([t, desc]) =>
      `<label class="choice"><input type="radio" name="type" value="${t}"><span class="choice__body"><strong>${t}</strong><span>${desc}</span></span></label>`,
  ).join("");
  $("[data-counters]").innerHTML = COUNTERS.map(
    ([k, label]) => `
    <div class="counter">
      <span class="counter__label" id="c-${k}">${label}</span>
      <div class="counter__ctrl" role="group" aria-labelledby="c-${k}">
        <button class="counter__btn" type="button" data-count="${k}" data-dir="-1" aria-label="Fewer ${label.toLowerCase()}">−</button>
        <output data-out="${k}" aria-live="polite"></output>
        <button class="counter__btn" type="button" data-count="${k}" data-dir="1" aria-label="More ${label.toLowerCase()}">+</button>
      </div>
    </div>`,
  ).join("");
  $("[data-amenities]").innerHTML = Object.entries(SN.amenities)
    .map(
      ([k, v]) =>
        `<label class="check"><input type="checkbox" name="amenity" value="${k}"> ${v}</label>`,
    )
    .join("");
  $("[data-cities]").innerHTML = [...new Set(SN.samples.map((p) => p.city))]
    .map((c) => `<option value="${c}">`)
    .join("");

  /* Form <-> draft */
  function apply() {
    if (draft.type)
      $(`input[name="type"][value="${draft.type}"]`).checked = true;
    Object.entries(FIELDS).forEach(([k, sel]) => {
      $(sel).value = draft[k] ?? "";
    });
    $$('input[name="amenity"]').forEach((i) => {
      i.checked = draft.amenities.includes(i.value);
    });
    $("#w-stepfree").checked = !!draft.stepFree;
    form.elements.booking.value = draft.instant ? "instant" : "request";
    renderCounters();
    renderPhotos();
    updateCharCount();
  }
  function collect() {
    draft.type = form.elements.type.value || "";
    Object.entries(FIELDS).forEach(([k, sel]) => {
      draft[k] = $(sel).value.trim();
    });
    draft.amenities = $$('input[name="amenity"]:checked').map((i) => i.value);
    draft.stepFree = $("#w-stepfree").checked;
    draft.instant = form.elements.booking.value === "instant";
  }

  function renderCounters() {
    COUNTERS.forEach(([k, , min, max]) => {
      $(`[data-out="${k}"]`).textContent = draft[k];
      $(`[data-count="${k}"][data-dir="-1"]`).disabled = draft[k] <= min;
      $(`[data-count="${k}"][data-dir="1"]`).disabled = draft[k] >= max;
    });
  }
  $("[data-counters]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-count]");
    if (!b) return;
    const [, , min, max] = COUNTERS.find(([k]) => k === b.dataset.count);
    draft[b.dataset.count] = Math.min(
      max,
      Math.max(min, draft[b.dataset.count] + +b.dataset.dir),
    );
    dirty = true;
    renderCounters();
    updatePreview();
  });

  /* Live preview (same card guests see in search) */
  function updatePreview() {
    const p = SN.toProperty({
      ...draft,
      id: draft.id || "preview",
      title: draft.title || "Your listing title",
      city: draft.city || "City",
      country: draft.country || "Country",
      type: draft.type || "House",
      price: draft.price || "—",
      note: draft.note || "Your one-line teaser.",
      photos: draft.photos.length ? draft.photos : [PLACEHOLDER],
    });
    preview.innerHTML = SN.cardHTML(p, { reveal: false });
    $$("a", preview).forEach((a) => a.removeAttribute("href"));
  }

  function updateCharCount() {
    $("[data-desc-count]").textContent = `${$("#w-desc").value.length} / 1000`;
  }
  function updatePriceHint() {
    collect();
    const hint = $("[data-price-hint]");
    const same = SN.samples.filter(
      (p) => p.city.toLowerCase() === draft.city.toLowerCase(),
    );
    const range = same.length
      ? `Similar stays in ${draft.city} are €${Math.min(...same.map((p) => p.price))}–€${Math.max(...same.map((p) => p.price))} a night. `
      : "";
    const ok = !rules.price(draft.price);
    hint.textContent = ok
      ? `${range}Guests would pay about ${fmt(SN.quote({ price: +draft.price }, 1).total)} for one night including fees and taxes.`
      : `${range}Enter a whole number between €20 and €5,000.`;
  }

  /* Any edit marks the draft dirty and refreshes the preview */
  let timer;
  form.addEventListener("input", (e) => {
    dirty = true;
    $("[data-saved]").textContent = "";
    if (e.target.matches('input[name="type"]')) $("#type-err").textContent = "";
    if (
      e.target.getAttribute?.("aria-invalid") === "true" &&
      e.target.dataset.rule
    ) {
      collect();
      SN.checkField(e.target, rules);
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      collect();
      updatePreview();
      updateCharCount();
      if (step === 7) updatePriceHint();
    }, 120);
  });
  $$("[data-rule]", form).forEach((el) =>
    el.addEventListener("blur", () => {
      if (el.value) SN.checkField(el, rules);
    }),
  );

  /* Photos: resized in the browser and kept locally until Storage is connected */
  async function toDataUrl(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1100 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return canvas.toDataURL("image/jpeg", 0.75);
  }
  async function addPhotos(files) {
    const err = $("#photos-err");
    err.textContent = "";
    const room = MAX_PHOTOS - draft.photos.length;
    if (room <= 0) {
      err.textContent = `You can add up to ${MAX_PHOTOS} photos for now.`;
      return;
    }
    const issues = [];
    for (const file of [...files].slice(0, room)) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        issues.push(`${file.name} isn't a JPG, PNG or WebP image.`);
        continue;
      }
      if (file.size > 12 * 1024 * 1024) {
        issues.push(`${file.name} is larger than 12 MB.`);
        continue;
      }
      try {
        draft.photos.push(await toDataUrl(file));
      } catch {
        issues.push(`${file.name} couldn't be read.`);
      }
    }
    if (files.length > room)
      issues.push(`Only ${room} more fit, so the rest were skipped.`);
    err.textContent = issues.join(" ");
    dirty = true;
    renderPhotos();
    updatePreview();
  }
  function renderPhotos() {
    $("[data-photos]").innerHTML = draft.photos
      .map(
        (src, i) => `
      <li class="photo">
        <img src="${src}" alt="Photo ${i + 1}${i === 0 ? " (cover)" : ""}">
        ${i === 0 ? '<span class="photo__tag">Cover</span>' : ""}
        <div class="photo__actions">
          ${i > 0 ? `<button class="link-btn" type="button" data-photo="cover" data-i="${i}">Make cover</button>` : ""}
          <button class="link-btn" type="button" data-photo="remove" data-i="${i}">Remove</button>
        </div>
      </li>`,
      )
      .join("");
  }
  $("#w-photos").addEventListener("change", async (e) => {
    await addPhotos(e.target.files);
    e.target.value = "";
  });
  $("[data-photos]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-photo]");
    if (!b) return;
    const i = +b.dataset.i;
    if (b.dataset.photo === "remove") draft.photos.splice(i, 1);
    else draft.photos.unshift(...draft.photos.splice(i, 1));
    dirty = true;
    renderPhotos();
    updatePreview();
  });

  /* Persistence */
  function showError(msg) {
    errBox.textContent = msg;
    errBox.hidden = false;
  }
  function persist({ status } = {}) {
    collect();
    errBox.hidden = true;
    if (!draft.id) draft.id = L.newId(draft.title || draft.city || "listing");
    if (status) draft.status = status;
    const toSave = {
      ...draft,
      price: Number(draft.price) || draft.price,
      minNights: Number(draft.minNights) || 1,
    };
    if (!L.save(toSave)) {
      showError(
        "We couldn't save this. Your browser's storage may be full. Try removing a photo or two.",
      );
      return false;
    }
    dirty = false;
    return true;
  }

  /* Validation */
  function validateStep(n) {
    collect();
    let ok = SN.validateFields($(`[data-step="${n}"]`), rules);
    if (n === 1 && !draft.type) {
      $("#type-err").textContent = "Choose a property type to continue.";
      $('input[name="type"]').focus();
      ok = false;
    }
    if (n === 5 && !draft.photos.length) {
      $("#photos-err").textContent = "Add at least one photo to continue.";
      ok = false;
    }
    return ok;
  }
  function problems() {
    collect();
    const out = [];
    if (!draft.type) out.push([1, "Choose a property type."]);
    if (rules.country(draft.country) || rules.city(draft.city))
      out.push([2, "Add the country and city."]);
    if (!draft.photos.length) out.push([5, "Add at least one photo."]);
    if (rules.title(draft.title))
      out.push([6, "Give your listing a title (10 to 60 characters)."]);
    if (rules.desc(draft.description))
      out.push([6, "Write a description (50 to 1,000 characters)."]);
    if (rules.note(draft.note))
      out.push([6, "Shorten your teaser to 70 characters."]);
    if (rules.price(String(draft.price))) out.push([7, "Set a nightly price."]);
    if (rules.nights(String(draft.minNights)))
      out.push([8, "Set a minimum stay."]);
    return out;
  }

  /* Review */
  function renderReview() {
    const rows = [
      ["Type", draft.type || "—", 1],
      [
        "Location",
        [draft.area, draft.city, draft.country].filter(Boolean).join(", ") ||
          "—",
        2,
      ],
      [
        "Space",
        `${draft.guests} guests · ${draft.bedrooms} bedrooms · ${draft.beds} beds · ${draft.baths} baths`,
        3,
      ],
      [
        "Amenities",
        [
          ...draft.amenities.map((a) => SN.amenities[a]),
          ...(draft.stepFree ? ["Step-free access"] : []),
        ].join(", ") || "None selected",
        4,
      ],
      ["Photos", `${draft.photos.length} added`, 5],
      ["Title", draft.title || "—", 6],
      ["Price", draft.price ? `${fmt(+draft.price)} per night` : "—", 7],
      [
        "Booking",
        `${draft.instant ? "Instant booking" : "Request to book"} · minimum ${draft.minNights} night${draft.minNights === "1" ? "" : "s"}`,
        8,
      ],
    ];
    $("[data-review]").innerHTML = rows
      .map(
        ([k, v, s]) =>
          `<div class="summary-row"><dt>${k}</dt><dd>${esc(v)}</dd><dd><button class="link-btn" type="button" data-jump="${s}">Edit</button></dd></div>`,
      )
      .join("");

    const probs = problems();
    const box = $("[data-problems]");
    box.hidden = probs.length === 0;
    box.innerHTML = probs.length
      ? `<p><strong>Finish these before publishing:</strong></p><ul>${probs.map(([s, m]) => `<li>${m} <button class="link-btn" type="button" data-jump="${s}">Fix</button></li>`).join("")}</ul>`
      : "";
    $("[data-publish]").disabled = probs.length > 0;
    $("[data-publish]").textContent =
      draft.status === "draft" ? "Publish listing" : "Save changes";
  }
  $("[data-review]").addEventListener("click", (e) => {
    const j = e.target.closest("[data-jump]");
    if (j) go(+j.dataset.jump);
  });
  $("[data-problems]").addEventListener("click", (e) => {
    const j = e.target.closest("[data-jump]");
    if (j) go(+j.dataset.jump);
  });

  /* Steps */
  function go(n, { focus = true } = {}) {
    step = n;
    $$("[data-step]").forEach((s) => {
      s.hidden = +s.dataset.step !== n;
    });
    $("[data-count-text]").textContent =
      `Step ${n} of ${STEPS.length} · ${STEPS[n - 1]}`;
    const bar = $(".progress");
    bar.setAttribute("aria-valuenow", n);
    bar.style.setProperty("--p", (n / STEPS.length) * 100);
    const last = n === STEPS.length;
    $("[data-next]").hidden = last;
    $("[data-publish]").hidden = !last;
    $("[data-back-step]").hidden = n === 1;
    errBox.hidden = true;
    if (n === 7) updatePriceHint();
    if (last) {
      collect();
      renderReview();
    }
    if (focus) {
      $(`#ws${n}`).focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  $("[data-next]").addEventListener("click", () => {
    if (!validateStep(step)) return;
    if (draft.status === "draft") persist(); // progress is kept as you go; published listings only save on the last step
    go(step + 1);
  });
  $("[data-back-step]").addEventListener("click", () => go(step - 1));
  form.addEventListener("submit", (e) => e.preventDefault());

  $("[data-save]").addEventListener("click", () => {
    if (persist())
      $("[data-saved]").textContent =
        draft.status === "draft"
          ? "Draft saved. You can pick this up later from your overview."
          : "Changes saved.";
  });

  $("[data-publish]").addEventListener("click", () => {
    if (problems().length) {
      renderReview();
      return;
    }
    const wasDraft = draft.status === "draft";
    if (!persist({ status: wasDraft ? "published" : draft.status })) return;
    wizardEl.hidden = true;
    const done = $("[data-done]");
    done.hidden = false;
    $("[data-done-title]").textContent = wasDraft
      ? "Your listing is live."
      : "Changes saved.";
    $("[data-done-text]").textContent = wasDraft
      ? "Guests can now find it in search and on its own page."
      : "Your updates are saved.";
    const view = $("[data-done-view]");
    view.hidden = draft.status !== "published";
    view.href = `property.html?id=${draft.id}`;
    $("#done-title").focus();
    window.scrollTo({ top: 0 });
  });

  addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* Init */
  apply();
  updatePreview();
  go(1, { focus: false });
})();
