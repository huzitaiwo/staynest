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

/* Save (heart) buttons, remembered in this browser */
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
