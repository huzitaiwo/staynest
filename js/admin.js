// js/admin.js (ES module)
const SN = window.StayNest;
const { fmt, plural } = SN;
const B = SN.bookings;
const L = SN.listings;
const R = SN.reviews;
const RP = SN.reports;

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const d = (s) =>
  s ? dateFmt.format(new Date(s.length === 10 ? `${s}T00:00:00` : s)) : "—";
const clip = (s, n = 70) => (s.length > n ? `${s.slice(0, n)}…` : s);

/* Firebase is optional: without it the Users tab explains what to do */
let fb = null;
try {
  const m = await import("./firebase.js");
  if (m.isConfigured && m.db) fb = m;
} catch (err) {
  console.error(err);
}

$("[data-notice]").textContent = fb
  ? "Users come from Firestore. Listings, reservations, reviews and reports are the ones saved in this browser until those move to Firestore too."
  : "Demo mode: Firebase isn't configured, so the Users tab is empty. Everything else shows data saved in this browser.";

const propertyOf = (id) => SN.allProperties.find((p) => p.id === id);
const panel = $("[data-panel]");
const live = $("[data-live]");
const tabsEl = $("[data-tabs]");

let users = [];
let usersState = fb ? "loading" : "demo";
let reportFilter = "open";

async function loadUsers() {
  if (!fb) return;
  try {
    const snap = await fb.getDocs(fb.collection(fb.db, "users"));
    users = snap.docs
      .map((x) => ({ uid: x.id, ...x.data() }))
      .sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0),
      );
    usersState = "ready";
  } catch (err) {
    console.error(err);
    usersState = "error";
  }
  render();
}

const TABS = [
  ["overview", "Overview", () => ""],
  ["users", "Users", () => (usersState === "ready" ? users.length : "")],
  ["listings", "Listings", () => L.hosted().length],
  ["reservations", "Reservations", () => B.read().length],
  ["reviews", "Reviews", () => R.read().length],
  ["reports", "Reports", () => RP.openCount()],
];
let active = TABS.some(([k]) => k === location.hash.slice(1))
  ? location.hash.slice(1)
  : "overview";

/* ---------- helpers ---------- */
const table = (cols, rows, empty) =>
  rows.length
    ? `<div class="table-wrap"><table class="data-table data-table--text">
      <thead><tr>${cols.map((c) => `<th scope="col">${c}</th>`).join("")}</tr></thead>
      <tbody>${rows.join("")}</tbody></table></div>`
    : `<div class="empty"><h3 class="empty__title">${empty}</h3></div>`;

const btn = (act, id, label, extra = "") =>
  `<button class="btn btn--outline btn--sm" type="button" data-act="${act}" data-id="${esc(id)}"${extra}>${label}</button>`;
const shareRow = (title, sub, pct, value) => `<li class="row share">
  <div><p class="row__title">${esc(title)}</p>${sub ? `<p class="row__sub">${esc(sub)}</p>` : ""}</div>
  <div class="share__bar" role="img" aria-label="${pct}%"><span style="width:${pct}%"></span></div>
  <p class="share__value">${value}</p></li>`;

function confirmAction(title, text, label) {
  const dlg = $("#confirm-dialog");
  $("[data-confirm-title]").textContent = title;
  $("[data-confirm-text]").textContent = text;
  $("[data-confirm-ok]").textContent = label;
  dlg.returnValue = "";
  return new Promise((resolve) => {
    dlg.addEventListener(
      "close",
      () => resolve(dlg.returnValue === "confirm"),
      { once: true },
    );
    dlg.showModal();
  });
}

/* ---------- panels ---------- */
function overview() {
  const all = B.read().filter((b) => propertyOf(b.id));
  const live_ = all.filter((b) => B.phase(b) !== "cancelled");
  let gmv = 0,
    fees = 0;
  const byCity = {};
  live_.forEach((b) => {
    const p = propertyOf(b.id);
    const q = SN.quote(p, SN.nights(b.checkin, b.checkout));
    gmv += q.total;
    fees += q.service;
    byCity[p.city] = (byCity[p.city] || 0) + q.total;
  });
  const items = L.hosted();
  const reviews = R.read().filter((r) => r.by === "guest");
  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.overall, 0) / reviews.length).toFixed(2)
    : "—";

  const kpis = [
    [
      "Users",
      usersState === "ready" ? String(users.length) : "—",
      fb ? "Firestore accounts" : "Needs Firebase",
    ],
    [
      "Listings",
      `${items.filter((i) => i.status === "published").length} / ${items.length}`,
      "Published / total",
    ],
    [
      "Reservations",
      String(live_.length),
      `${all.length - live_.length} cancelled`,
    ],
    ["Booked value", fmt(gmv), "Guest totals incl. fees"],
    ["Service fees", fmt(fees), "StayNest revenue"],
    [
      "Open reports",
      String(RP.openCount()),
      `${plural(reviews.length, "guest review")} · ${avg} avg`,
    ],
  ];

  const phases = ["upcoming", "current", "past", "cancelled"];
  const counts = phases.map((ph) => [
    ph,
    all.filter((b) => B.phase(b) === ph).length,
  ]);
  const totalB = all.length || 1;
  const cities = Object.entries(byCity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return `
    <div class="kpis">${kpis.map(([l, v, h]) => `<div class="kpi"><p class="kpi__label">${l}</p><p class="kpi__value">${esc(v)}</p><p class="kpi__hint">${esc(h)}</p></div>`).join("")}</div>
    <section class="dash-section" aria-labelledby="a-status"><h2 class="p-title" id="a-status">Reservations by status</h2>
      <ul class="rows share-list" role="list">${
        all.length
          ? counts
              .map(([ph, n]) =>
                shareRow(
                  {
                    upcoming: "Upcoming",
                    current: "Staying now",
                    past: "Completed",
                    cancelled: "Cancelled",
                  }[ph],
                  "",
                  Math.round((n / totalB) * 100),
                  String(n),
                ),
              )
              .join("")
          : '<li class="row"><p class="row__sub">No reservations yet.</p></li>'
      }</ul></section>
    <section class="dash-section" aria-labelledby="a-city"><h2 class="p-title" id="a-city">Booked value by city</h2>
      <ul class="rows share-list" role="list">${
        cities.length
          ? cities
              .map(([c, v]) =>
                shareRow(c, "", Math.round((v / gmv) * 100), fmt(v)),
              )
              .join("")
          : '<li class="row"><p class="row__sub">No bookings to analyse yet.</p></li>'
      }</ul></section>`;
}

function usersPanel() {
  if (usersState === "demo")
    return '<div class="empty"><h3 class="empty__title">Firebase isn\'t connected</h3><p class="empty__text">Add your config in <code>js/firebase-config.js</code> and this tab lists real accounts.</p></div>';
  if (usersState === "loading") return '<p class="row__sub">Loading users…</p>';
  if (usersState === "error")
    return '<div class="empty"><h3 class="empty__title">Couldn\'t load users</h3><p class="empty__text">Check that your Firestore rules include the admin read rule, then reload.</p></div>';
  const rows = users.map(
    (u) => `<tr>
    <th scope="row">${esc(u.name || "—")}</th>
    <td>${esc(u.email || "—")}</td>
    <td>${
      u.role === "admin"
        ? '<span class="status status--current">Admin</span>'
        : `<select class="select select--sm" data-role-uid="${esc(u.uid)}" aria-label="Role for ${esc(u.name || u.email)}">
          <option value="guest"${u.role === "guest" ? " selected" : ""}>Guest</option>
          <option value="host"${u.role === "host" ? " selected" : ""}>Host</option></select>`
    }</td>
    <td>${esc(d(u.createdAt?.toDate?.().toISOString()))}</td></tr>`,
  );
  return table(["Name", "Email", "Role", "Joined"], rows, "No users yet");
}

function listingsPanel() {
  const rows = L.hosted().map((i) => {
    const p = i.p;
    const cls =
      { published: "upcoming", draft: "past", unpublished: "current" }[
        i.status
      ] || "past";
    return `<tr>
      <th scope="row"><span class="cell-clip">${esc(p.title || "Untitled listing")}</span></th>
      <td>${esc([p.city, p.country].filter(Boolean).join(", ") || "—")}</td>
      <td>${p.price ? fmt(p.price) : "—"}</td>
      <td><span class="status status--${cls}">${esc(i.status)}</span></td>
      <td><div class="cell-actions">
        ${i.status === "published" ? `<a class="btn btn--outline btn--sm" href="property.html?id=${esc(i.id)}">View</a>` : ""}
        ${i.status === "published" ? btn("unpublish", i.id, "Unpublish") : i.status === "unpublished" || i.sample ? btn("publish", i.id, "Publish") : ""}
        ${i.sample ? "" : btn("delete-listing", i.id, "Delete")}
      </div></td></tr>`;
  });
  return table(
    ["Listing", "Location", "Per night", "Status", "Actions"],
    rows,
    "No listings",
  );
}

function reservationsPanel() {
  const LABEL = {
    upcoming: "Upcoming",
    current: "Staying now",
    past: "Completed",
    cancelled: "Cancelled",
  };
  const rows = B.read()
    .filter((b) => propertyOf(b.id))
    .map((b) => {
      const p = propertyOf(b.id);
      const ph = B.phase(b);
      const q = SN.quote(p, SN.nights(b.checkin, b.checkout));
      return `<tr>
      <th scope="row">${esc(b.ref)}</th>
      <td>${esc(b.name || "Guest")}</td>
      <td><span class="cell-clip">${esc(p.title)}</span></td>
      <td>${esc(d(b.checkin))} – ${esc(d(b.checkout))}</td>
      <td>${fmt(q.total)}</td>
      <td><span class="status status--${ph}">${LABEL[ph]}</span></td>
      <td>${ph === "upcoming" || ph === "current" ? btn("cancel-booking", b.ref, "Cancel") : ""}</td></tr>`;
    });
  return table(
    ["Reference", "Guest", "Stay", "Dates", "Total", "Status", "Actions"],
    rows,
    "No reservations",
  );
}

function reviewsPanel() {
  const rows = R.read().map((r) => {
    const p = propertyOf(r.propertyId);
    return `<tr>
      <th scope="row"><span class="cell-clip">${esc(p ? p.title : "—")}</span></th>
      <td>${r.by === "host" ? "Host → guest" : "Guest → stay"}</td>
      <td>${esc(r.author || "—")}</td>
      <td>★ ${r.overall.toFixed(1)}</td>
      <td><span class="cell-clip">${esc(clip(r.text))}</span></td>
      <td>${esc(d(r.date))}</td>
      <td>${btn("remove-review", r.id, "Remove")}</td></tr>`;
  });
  return table(
    ["Stay", "Type", "Author", "Rating", "Review", "Date", "Actions"],
    rows,
    "No reviews yet",
  );
}

function reportsPanel() {
  const all = RP.read();
  const list = all.filter((r) =>
    reportFilter === "open" ? r.status === "open" : r.status !== "open",
  );
  const chips = `<div class="chip-row" role="group" aria-label="Filter reports">
    <button class="chip" type="button" data-rfilter="open" aria-pressed="${reportFilter === "open"}">Open</button>
    <button class="chip" type="button" data-rfilter="closed" aria-pressed="${reportFilter === "closed"}">Closed</button></div>`;
  const cards = list
    .map((r) => {
      const review =
        r.type === "review" ? R.read().find((x) => x.id === r.targetId) : null;
      const p = r.type === "listing" ? propertyOf(r.targetId) : null;
      return `<li class="rv-card">
      <div class="rv-card__head">
        <p class="row__title">${r.type === "review" ? "Review" : "Listing"} · ${esc(r.reason)}</p>
        <p class="row__sub">${esc(d(r.date))} · <span class="status status--${r.status === "open" ? "current" : "past"}">${esc(r.status)}</span></p>
      </div>
      <p class="rv-card__text"><strong>${esc(r.type === "listing" ? (p ? p.title : r.label) : review ? clip(review.text, 120) : r.label ? `${r.label}…` : "Review removed")}</strong></p>
      ${r.details ? `<p class="row__sub">“${esc(r.details)}”</p>` : ""}
      <div class="cell-actions">
        ${r.type === "listing" && p ? `<a class="btn btn--outline btn--sm" href="property.html?id=${esc(p.id)}">View listing</a>` : ""}
        ${r.type === "listing" && p && L.statusOf(p.id) === "published" ? btn("report-unpublish", r.id, "Unpublish listing", ` data-target="${esc(r.targetId)}"`) : ""}
        ${review ? btn("report-remove-review", r.id, "Remove review", ` data-target="${esc(r.targetId)}"`) : ""}
        ${r.status === "open" ? btn("report-resolve", r.id, "Mark resolved") + btn("report-dismiss", r.id, "Dismiss") : btn("report-reopen", r.id, "Reopen")}
      </div></li>`;
    })
    .join("");
  return `${chips}${
    list.length
      ? `<ul class="rows rows--spaced" role="list">${cards}</ul>`
      : `<div class="empty"><h3 class="empty__title">${reportFilter === "open" ? "No open reports" : "No closed reports"}</h3></div>`
  }`;
}

const PANELS = {
  overview,
  users: usersPanel,
  listings: listingsPanel,
  reservations: reservationsPanel,
  reviews: reviewsPanel,
  reports: reportsPanel,
};

/* ---------- render + events ---------- */
function render({ focusTab = false } = {}) {
  tabsEl.innerHTML = TABS.map(([k, label, count]) => {
    const c = count();
    return `<button class="tab" type="button" role="tab" id="atab-${k}" aria-selected="${k === active}" aria-controls="admin-panel" tabindex="${k === active ? 0 : -1}" data-tab="${k}">${label}${c !== "" ? `<span class="tab__count">${c}</span>` : ""}</button>`;
  }).join("");
  panel.setAttribute("aria-labelledby", `atab-${active}`);
  panel.innerHTML = PANELS[active]();
  if (focusTab) $(`#atab-${active}`).focus();
}

function go(key, focusTab) {
  active = key;
  try {
    history.replaceState(null, "", `#${key}`);
  } catch {
    /* ignore */
  }
  render({ focusTab });
}

tabsEl.addEventListener("click", (e) => {
  const t = e.target.closest("[data-tab]");
  if (t) go(t.dataset.tab, true);
});
tabsEl.addEventListener("keydown", (e) => {
  const keys = TABS.map(([k]) => k);
  const i = keys.indexOf(active);
  const move = {
    ArrowRight: i + 1,
    ArrowLeft: i - 1,
    Home: 0,
    End: keys.length - 1,
  }[e.key];
  if (move === undefined) return;
  e.preventDefault();
  go(keys[(move + keys.length) % keys.length], true);
});

const done = (msg) => {
  render();
  live.textContent = msg;
};

panel.addEventListener("click", async (e) => {
  const f = e.target.closest("[data-rfilter]");
  if (f) {
    reportFilter = f.dataset.rfilter;
    render();
    return;
  }

  const b = e.target.closest("[data-act]");
  if (!b) return;
  const { act, id, target } = b.dataset;

  switch (act) {
    case "publish":
      L.setStatus(id, "published");
      done("Listing published");
      break;
    case "unpublish":
      L.setStatus(id, "unpublished");
      done("Listing unpublished");
      break;
    case "delete-listing":
      if (
        await confirmAction(
          "Delete this listing?",
          "This removes the listing from this browser. It can't be undone.",
          "Delete listing",
        )
      ) {
        L.remove(id);
        done("Listing deleted");
      }
      break;
    case "cancel-booking":
      if (
        await confirmAction(
          "Cancel this reservation?",
          `Reservation ${id} will be marked as cancelled and the dates become free.`,
          "Cancel reservation",
        )
      ) {
        B.update(id, {
          status: "cancelled",
          cancelledAt: new Date().toISOString(),
        });
        done("Reservation cancelled");
      }
      break;
    case "remove-review":
      if (
        await confirmAction(
          "Remove this review?",
          "It disappears from the stay page and the host's reviews.",
          "Remove review",
        )
      ) {
        R.remove(id);
        done("Review removed");
      }
      break;
    case "report-resolve":
      RP.setStatus(id, "resolved");
      done("Report resolved");
      break;
    case "report-dismiss":
      RP.setStatus(id, "dismissed");
      done("Report dismissed");
      break;
    case "report-reopen":
      RP.setStatus(id, "open");
      done("Report reopened");
      break;
    case "report-unpublish":
      L.setStatus(target, "unpublished");
      RP.setStatus(id, "resolved");
      done("Listing unpublished and report resolved");
      break;
    case "report-remove-review":
      if (
        await confirmAction(
          "Remove this review?",
          "It disappears from the stay page. The report will be marked resolved.",
          "Remove review",
        )
      ) {
        R.remove(target);
        RP.setStatus(id, "resolved");
        done("Review removed and report resolved");
      }
      break;
    default:
  }
});

panel.addEventListener("change", async (e) => {
  const sel = e.target.closest("[data-role-uid]");
  if (!sel || !fb) return;
  const uid = sel.dataset.roleUid;
  const user = users.find((u) => u.uid === uid);
  try {
    await fb.updateDoc(fb.doc(fb.db, "users", uid), { role: sel.value });
    user.role = sel.value;
    live.textContent = `${user.name || user.email} is now a ${sel.value}`;
  } catch (err) {
    console.error(err);
    sel.value = user.role;
    live.textContent = "Couldn't change that role. Check your Firestore rules.";
  }
});

render();
loadUsers();
