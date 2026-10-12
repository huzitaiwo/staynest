// js/help.js — filters the static FAQ by topic and search text
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const items = [...document.querySelectorAll("[data-faq] .faq__item")];
  const search = $("[data-faq-search]");
  const empty = $("[data-faq-empty]");
  const live = $("[data-live]");
  let topic = "all";

  function apply() {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    items.forEach((it) => {
      const match =
        (topic === "all" || it.dataset.topic === topic) &&
        (!q || it.textContent.toLowerCase().includes(q));
      it.hidden = !match;
      if (match) shown += 1;
    });
    $("[data-faq]").hidden = !shown;
    empty.hidden = shown > 0;
    live.textContent = `${shown} ${shown === 1 ? "answer" : "answers"} shown`;
  }

  $("[data-faq-topics]").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-topic]");
    if (!btn) return;
    topic = btn.dataset.topic;
    document
      .querySelectorAll("[data-faq-topics] [data-topic]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    apply();
  });
  search.addEventListener("input", apply);

  // Deep link: help.html?q=cancel
  const preset = new URLSearchParams(location.search).get("q");
  if (preset) {
    search.value = preset;
    apply();
  }
})();
