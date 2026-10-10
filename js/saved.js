(() => {
  "use strict";
  const SN = window.StayNest;
  const $ = (s, r = document) => r.querySelector(s);
  const grid = $("[data-grid]");
  const chipsEl = $("[data-chips]");
  const countEl = $("[data-count]");
  const emptyEl = $("[data-empty]");
  const live = $("[data-live]");
  let city = "All";

  const readIds = () => {
    try {
      const v = JSON.parse(localStorage.getItem("sn-saved"));
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
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

  function render() {
    // Newest saves first
    const items = readIds()
      .reverse()
      .map((id) => SN.properties.find((p) => p.id === id))
      .filter(Boolean);
    const cities = [...new Set(items.map((p) => p.city))];
    if (!cities.includes(city)) city = "All";
    const shown = city === "All" ? items : items.filter((p) => p.city === city);

    chipsEl.hidden = cities.length < 2;
    chipsEl.innerHTML = ["All", ...cities]
      .map(
        (c) =>
          `<button class="chip" type="button" aria-pressed="${c === city}" data-city="${esc(c)}">${esc(c)}</button>`,
      )
      .join("");

    grid.innerHTML = shown
      .map((p) => `<li>${SN.cardHTML(p, { reveal: false })}</li>`)
      .join("");
    SN.syncSaved(grid);

    grid.hidden = !shown.length;
    emptyEl.hidden = items.length > 0;
    countEl.hidden = !items.length;
    countEl.textContent = `${shown.length} saved ${shown.length === 1 ? "stay" : "stays"}${city === "All" ? "" : ` in ${city}`}`;
  }

  chipsEl.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-city]");
    if (!chip) return;
    city = chip.dataset.city;
    render();
    $(`[data-city="${CSS.escape(city)}"]`)?.focus();
  });

  // main.js has already toggled the heart; if it was un-saved, fade the card out.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-save]");
    if (!btn || btn.getAttribute("aria-pressed") !== "false") return;
    btn.closest("li")?.classList.add("is-leaving");
    live.textContent = "Removed from saved stays.";
    setTimeout(render, 220);
  });

  render();
})();
