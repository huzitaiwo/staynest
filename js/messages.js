(() => {
  "use strict";
  const SN = window.StayNest;
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

  const KEY = "sn-messages";
  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const write = (v) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {}
  };

  const inbox = $("[data-inbox]");
  const convosEl = $("[data-convos]");
  const logEl = $("[data-log]");
  const startersEl = $("[data-starters]");
  const form = $("[data-composer]");
  const input = $("#msg-input");
  const sendBtn = $("[data-send]");
  const live = $("[data-live]");

  const STARTERS = [
    "Is early check-in possible?",
    "What's nearby?",
    "Can you tell me about parking?",
    "Is the space suitable for children?",
  ];

  let threads = read(); // { id, propertyId, messages: [{ id, from, text, at }], updatedAt }
  let draft = null; // a new conversation that isn't saved until the first message is sent
  let selected = null;

  /* Start a conversation from ?property=id */
  const paramId = new URLSearchParams(location.search).get("property");
  if (
    paramId &&
    SN.allProperties.some((p) => p.id === paramId) &&
    !threads.some((t) => t.propertyId === paramId)
  ) {
    draft = {
      id: paramId,
      propertyId: paramId,
      messages: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const all = () =>
    [...(draft ? [draft] : []), ...threads].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  const propertyOf = (t) => SN.properties.find((p) => p.id === t.propertyId);

  const shortTime = (iso) => {
    const dt = new Date(iso);
    return dt.toDateString() === new Date().toDateString()
      ? dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  const longTime = (iso) =>
    new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  function renderList() {
    convosEl.innerHTML = all()
      .map((t) => {
        const p = propertyOf(t);
        if (!p) return "";
        const last = t.messages[t.messages.length - 1];
        return `<li><button class="convo" type="button" data-id="${esc(t.id)}" aria-current="${t.id === selected}">
        <span class="avatar avatar--sm" aria-hidden="true">${SN.host.initial}</span>
        <span class="convo__text"><span class="convo__name">${SN.host.name}</span><span class="convo__prop">${p.title}</span><span class="convo__snip">${last ? esc(last.text) : "Start the conversation"}</span></span>
        <span class="convo__time">${last ? shortTime(last.at) : ""}</span>
      </button></li>`;
      })
      .join("");
  }

  function renderThread() {
    const t = all().find((x) => x.id === selected);
    const p = t && propertyOf(t);
    if (!p) return;
    $("[data-t-avatar]").textContent = SN.host.initial;
    $("[data-t-name]").textContent = SN.host.name;
    $("[data-t-meta]").innerHTML =
      `About <a href="property.html?id=${p.id}">${p.title}</a> · Typically replies ${SN.host.responseTime}`;

    logEl.innerHTML = t.messages.length
      ? t.messages
          .map(
            (m) =>
              `<div class="msg msg--${m.from}">${esc(m.text)}<time datetime="${esc(m.at)}">${longTime(m.at)}</time></div>`,
          )
          .join("")
      : `<p class="thread__empty">Say hello to ${SN.host.name}. Ask about the space, the area or your dates.</p>`;
    logEl.scrollTop = logEl.scrollHeight;

    startersEl.hidden = t.messages.length > 0;
    startersEl.innerHTML = STARTERS.map(
      (s) =>
        `<button class="chip" type="button" data-starter="${esc(s)}">${esc(s)}</button>`,
    ).join("");
  }

  function select(id, { pane = true } = {}) {
    selected = id;
    renderList();
    renderThread();
    if (pane) inbox.dataset.pane = "thread";
  }

  function render() {
    const has = all().some((t) => propertyOf(t));
    inbox.hidden = !has;
    $("[data-empty]").hidden = has;
    if (!has) return;
    selected = selected || all()[0].id;
    select(selected, { pane: Boolean(paramId) }); // on small screens: thread if arriving from "Contact host", list otherwise
  }

  /* Events */
  convosEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (b) select(b.dataset.id);
  });
  $("[data-back]").addEventListener("click", () => {
    inbox.dataset.pane = "list";
  });
  startersEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-starter]");
    if (!b) return;
    input.value = b.dataset.starter;
    input.dispatchEvent(new Event("input"));
    input.focus();
  });

  input.addEventListener("input", () => {
    sendBtn.disabled = !input.value.trim();
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const t = all().find((x) => x.id === selected);
    if (!t) return;
    const now = new Date().toISOString();
    t.messages.push({
      id: `${Date.now()}-${t.messages.length}`,
      from: "guest",
      text,
      at: now,
    });
    t.updatedAt = now;
    if (t === draft) {
      threads = [draft, ...threads];
      draft = null;
    }
    write(threads);

    input.value = "";
    input.dispatchEvent(new Event("input"));
    renderList();
    renderThread();
    live.textContent = "Message sent.";
    input.focus();
  });

  render();
})();
