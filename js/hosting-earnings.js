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
  const pad = (n) => String(n).padStart(2, "0");
  const NS = "http://www.w3.org/2000/svg";

  const W = 640,
    H = 300;
  const M = { l: 52, r: 8, t: 12, b: 30 };
  const IW = W - M.l - M.r;
  const IH = H - M.t - M.b;

  const hosted = SN.listings.hosted();
  const hostedIds = new Set(hosted.map((i) => i.id));
  const propertyOf = (id) => SN.allProperties.find((p) => p.id === id);

  const svg = $("[data-svg]");
  const tip = $("[data-tip]");
  const chart = $("[data-chart]");
  const select = $("[data-listing-filter]");
  let n = 6;
  let listingId = "all";

  select.innerHTML = `<option value="all">All listings</option>${hosted
    .map(
      (i) =>
        `<option value="${esc(i.id)}">${esc(i.p.title || "Untitled listing")}</option>`,
    )
    .join("")}`;

  const kfmt = (v) => (v >= 1000 ? `€${+(v / 1000).toFixed(1)}k` : `€${v}`);
  const niceStep = (raw) => {
    const pow = 10 ** Math.floor(Math.log10(raw));
    const f = raw / pow;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  };

  function roundTop(x, y, w, h, r) {
    if (h <= 0) return "";
    const rr = Math.min(r, h, w / 2);
    return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
  }

  function data() {
    const now = new Date();
    const months = Array.from({ length: n }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (n - 3) + i, 1);
      return {
        key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
        short: d.toLocaleDateString("en-GB", { month: "short" }),
        long: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        earned: 0,
        booked: 0,
        nights: 0,
      };
    });
    const byKey = Object.fromEntries(months.map((m) => [m.key, m]));
    const perListing = {};
    let total = 0,
      totalNights = 0;

    B.read()
      .filter((b) => hostedIds.has(b.id) && B.phase(b) !== "cancelled")
      .filter((b) => listingId === "all" || b.id === listingId)
      .forEach((b) => {
        const p = propertyOf(b.id);
        if (!p) return;
        const nights = SN.nights(b.checkin, b.checkout);
        const q = SN.quote(p, nights);
        const amount = q.subtotal + q.cleaning;
        const m = byKey[b.checkin.slice(0, 7)];
        if (!m) return;
        m[B.phase(b) === "past" ? "earned" : "booked"] += amount;
        m.nights += nights;
        perListing[b.id] = (perListing[b.id] || 0) + amount;
        total += amount;
        totalNights += nights;
      });
    return { months, perListing, total, totalNights };
  }

  const el = (name, attrs = {}) => {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  };

  function drawChart(months) {
    svg.replaceChildren();
    const max = Math.max(...months.map((m) => m.earned + m.booked), 0);
    const step = niceStep(Math.max(max, 40) / 4);
    const top = step * 4;
    const y = (v) => M.t + IH - (v / top) * IH;
    const band = IW / months.length;
    const bw = Math.min(36, band * 0.6);

    for (let i = 0; i <= 4; i += 1) {
      const v = step * i;
      svg.append(
        el("line", {
          class: "chart__grid",
          x1: M.l,
          x2: W - M.r,
          y1: y(v),
          y2: y(v),
        }),
        Object.assign(
          el("text", {
            class: "chart__tick",
            x: M.l - 8,
            y: y(v) + 4,
            "text-anchor": "end",
          }),
          { textContent: kfmt(v) },
        ),
      );
    }

    months.forEach((m, i) => {
      const cx = M.l + band * i + band / 2;
      const x = cx - bw / 2;
      const total = m.earned + m.booked;
      const hE = (m.earned / top) * IH;
      const hB = (m.booked / top) * IH;

      if (m.earned) {
        svg.append(
          el("path", {
            class: "chart__bar chart__bar--earned",
            d: m.booked
              ? `M${x},${M.t + IH}V${y(m.earned)}H${x + bw}V${M.t + IH}Z`
              : roundTop(x, y(m.earned), bw, hE, 4),
          }),
        );
      }
      if (m.booked) {
        const gap = m.earned ? 2 : 0;
        svg.append(
          el("path", {
            class: "chart__bar chart__bar--booked",
            d: roundTop(x, y(total), bw, hB - gap, 4),
          }),
        );
      }
      svg.append(
        Object.assign(
          el("text", {
            class: "chart__tick",
            x: cx,
            y: H - 8,
            "text-anchor": "middle",
          }),
          { textContent: m.short },
        ),
      );

      const hit = el("rect", {
        class: "chart__hit",
        x: M.l + band * i,
        y: M.t,
        width: band,
        height: IH,
        tabindex: 0,
        role: "img",
        "aria-label": `${m.long}: ${fmt(total)} in total, ${fmt(m.earned)} completed, ${fmt(m.booked)} upcoming, ${plural(m.nights, "night")}`,
      });
      const show = () => showTip(m, cx, y(total));
      hit.addEventListener("mouseenter", show);
      hit.addEventListener("focus", show);
      hit.addEventListener("mouseleave", hideTip);
      hit.addEventListener("blur", hideTip);
      svg.append(hit);
    });
  }

  function showTip(m, cx, yTop) {
    const pct = Math.min(88, Math.max(12, (cx / W) * 100));
    tip.innerHTML = `<strong>${esc(m.long)}</strong>
      <span>Total ${fmt(m.earned + m.booked)}</span>
      <span>Completed ${fmt(m.earned)}</span>
      <span>Upcoming ${fmt(m.booked)}</span>
      <span>${plural(m.nights, "night")}</span>`;
    tip.style.left = `${pct}%`;
    tip.style.top = `${(yTop / H) * 100}%`;
    tip.hidden = false;
  }
  const hideTip = () => {
    tip.hidden = true;
  };

  function render() {
    const { months, perListing, total, totalNights } = data();
    const best = months.reduce(
      (a, m) => (m.earned + m.booked > a.earned + a.booked ? m : a),
      months[0],
    );
    const kpis = [
      [
        "Total",
        fmt(total),
        `Next ${n === 6 ? "six" : "twelve"} months incl. upcoming`,
      ],
      ["Nights booked", String(totalNights), "In this period"],
      [
        "Average per night",
        totalNights ? fmt(Math.round(total / totalNights)) : "—",
        "Rate plus cleaning",
      ],
      [
        "Best month",
        total ? best.long : "—",
        total ? fmt(best.earned + best.booked) : "No bookings yet",
      ],
    ];
    $("[data-kpis]").innerHTML = kpis
      .map(
        ([l, v, h]) =>
          `<div class="kpi"><p class="kpi__label">${l}</p><p class="kpi__value">${esc(v)}</p><p class="kpi__hint">${esc(h)}</p></div>`,
      )
      .join("");

    const has = total > 0;
    $("[data-empty]").hidden = has;
    chart.hidden =
      !has || $('[data-view] [aria-pressed="true"]').dataset.v !== "chart";
    $("[data-table-wrap]").hidden =
      !has || $('[data-view] [aria-pressed="true"]').dataset.v !== "table";
    $(".chart-legend").hidden = !has;
    hideTip();
    if (has) drawChart(months);

    $("[data-tbody]").innerHTML = months
      .map(
        (m) => `<tr>
      <th scope="row">${esc(m.long)}</th><td>${m.nights}</td><td>${fmt(m.earned)}</td><td>${fmt(m.booked)}</td><td>${fmt(m.earned + m.booked)}</td></tr>`,
      )
      .join("");

    const rows = hosted
      .filter((i) => perListing[i.id])
      .sort((a, b) => perListing[b.id] - perListing[a.id])
      .map((i) => {
        const share = Math.round((perListing[i.id] / total) * 100);
        return `<li class="row share">
          <div><p class="row__title">${esc(i.p.title || "Untitled listing")}</p><p class="row__sub">${esc(i.p.city || "")}</p></div>
          <div class="share__bar" role="img" aria-label="${share}% of earnings"><span style="width:${share}%"></span></div>
          <p class="share__value">${fmt(perListing[i.id])} <small>${share}%</small></p>
        </li>`;
      })
      .join("");
    $("[data-by]").innerHTML =
      rows ||
      '<li class="row"><p class="row__sub">No earnings to show yet.</p></li>';
  }

  $("[data-range]").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-n]");
    if (!btn) return;
    n = +btn.dataset.n;
    document
      .querySelectorAll("[data-n]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    render();
  });
  $("[data-view]").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-v]");
    if (!btn) return;
    document
      .querySelectorAll("[data-v]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    render();
  });
  select.addEventListener("change", () => {
    listingId = select.value;
    render();
  });

  render();
})();
