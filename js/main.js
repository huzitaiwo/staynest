/* Header: scrolled state + mobile menu */
const header = document.querySelector("[data-header]");
const toggle = header?.querySelector("[data-menu-toggle]");

const setMenu = (open) => {
  if (!header || !toggle) return;
  header.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
};

const onScroll = () =>
  header?.classList.toggle("is-scrolled", window.scrollY > 24);
onScroll();
addEventListener("scroll", onScroll, { passive: true });

toggle?.addEventListener("click", () =>
  setMenu(toggle.getAttribute("aria-expanded") !== "true"),
);
header
  ?.querySelectorAll(".site-header__panel a")
  .forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("click", (e) => {
  if (header?.classList.contains("is-open") && !header.contains(e.target))
    setMenu(false);
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && header?.classList.contains("is-open")) {
    setMenu(false);
    toggle.focus();
  }
});
matchMedia("(min-width: 900px)").addEventListener(
  "change",
  (e) => e.matches && setMenu(false),
);

/* Scroll reveal */
const revealEls = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-visible");
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );
  revealEls.forEach((el) => {
    const i = [...el.parentElement.children].indexOf(el);
    el.style.transitionDelay = `${Math.min(i, 4) * 90}ms`;
    io.observe(el);
  });
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

/* Save (heart) buttons, remembered in this browser. Works for cards added later. */
window.StayNest = window.StayNest || {};
const SAVED_KEY = "sn-saved";
const readSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY)) || [];
  } catch {
    return [];
  }
};
const writeSaved = (list) => {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch {}
};
const saved = new Set(readSaved());

window.StayNest.syncSaved = (root = document) =>
  root
    .querySelectorAll("[data-save]")
    .forEach((btn) =>
      btn.setAttribute("aria-pressed", String(saved.has(btn.dataset.save))),
    );
window.StayNest.syncSaved();

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-save]");
  if (!btn) return;
  const id = btn.dataset.save;
  saved.has(id) ? saved.delete(id) : saved.add(id);
  writeSaved([...saved]);
  btn.setAttribute("aria-pressed", String(saved.has(id)));
  btn.classList.remove("is-pop");
  void btn.offsetWidth;
  btn.classList.add("is-pop");
});

document.querySelectorAll("[data-save]").forEach((btn) => {
  const id = btn.dataset.save;
  btn.setAttribute("aria-pressed", String(saved.has(id)));
  btn.addEventListener("click", () => {
    saved.has(id) ? saved.delete(id) : saved.add(id);
    writeSaved([...saved]);
    btn.setAttribute("aria-pressed", String(saved.has(id)));
    btn.classList.remove("is-pop");
    void btn.offsetWidth;
    btn.classList.add("is-pop");
  });
});

/* Search dates: no past check-in, check-out after check-in */
const inEl = document.getElementById("s-in");
const outEl = document.getElementById("s-out");
if (inEl && outEl) {
  const today = new Date().toISOString().split("T")[0];
  inEl.min = outEl.min = today;
  inEl.addEventListener("change", () => {
    outEl.min = inEl.value || today;
    if (outEl.value && outEl.value < outEl.min) outEl.value = "";
  });
}

/* Footer dispatch signup (saved in this browser until a mailing service is connected) */
(() => {
  const KEY = "sn-dispatch";
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  };
  const write = (v) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  };
  let dialog = null;

  function build() {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <dialog class="modal" id="dispatch-dialog" aria-labelledby="dispatch-title">
        <form class="dispatch-form" data-dispatch-form novalidate>
          <h2 class="modal__title" id="dispatch-title">A considered dispatch</h2>
          <p class="modal__text" data-dispatch-text>An occasional note on places worth knowing. No noise.</p>
          <div class="field" data-dispatch-field>
            <label class="field__label" for="dispatch-email">Email</label>
            <input class="input" id="dispatch-email" type="email" autocomplete="email" placeholder="you@example.com" aria-describedby="dispatch-err">
            <p class="field__error" id="dispatch-err" role="alert"></p>
          </div>
          <div class="modal__actions">
            <button class="btn btn--outline btn--sm" type="button" data-dispatch-close>Close</button>
            <button class="btn btn--primary btn--sm" type="submit" data-dispatch-submit>Join the note</button>
          </div>
        </form>
      </dialog>`,
    );
    dialog = document.getElementById("dispatch-dialog");
    const form = dialog.querySelector("form");
    const email = dialog.querySelector("#dispatch-email");
    const err = dialog.querySelector("#dispatch-err");

    dialog
      .querySelector("[data-dispatch-close]")
      .addEventListener("click", () => dialog.close());
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = email.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        err.textContent = "Enter a valid email address.";
        email.focus();
        return;
      }
      err.textContent = "";
      const list = read();
      if (!list.includes(value)) write([...list, value]);
      dialog.querySelector("[data-dispatch-text]").textContent =
        "Thank you, you're on the list. This is a demo, so nothing is actually sent.";
      dialog.querySelector("[data-dispatch-field]").hidden = true;
      dialog.querySelector("[data-dispatch-submit]").hidden = true;
    });
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-dispatch]")) return;
    if (!dialog) build();
    dialog.querySelector("[data-dispatch-text]").textContent =
      "An occasional note on places worth knowing. No noise.";
    dialog.querySelector("[data-dispatch-field]").hidden = false;
    dialog.querySelector("[data-dispatch-submit]").hidden = false;
    dialog.querySelector("#dispatch-email").value = "";
    dialog.querySelector("#dispatch-err").textContent = "";
    dialog.showModal();
  });
})();
