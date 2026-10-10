/* One source for the icon sprite, header and footer. Every page reuses these. */
const SPRITE = `
<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">
  <symbol id="i-logo" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#c85b3c"/><path d="M10.5 22v-5.5a5.5 5.5 0 0 1 11 0V22Z" fill="#26221f"/></symbol>
  <symbol id="i-pin" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></symbol>
  <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></symbol>
  <symbol id="i-heart" viewBox="0 0 24 24"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/></symbol>
  <symbol id="i-arrow-up-right" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></symbol>
  <symbol id="i-arrow-down" viewBox="0 0 24 24"><path d="M12 5v14M19 12l-7 7-7-7"/></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 8h16M4 16h16"/></symbol>
  <symbol id="i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></symbol>
  <symbol id="i-compass" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/></symbol>
  <symbol id="i-sparkle" viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></symbol>
  <symbol id="i-instagram" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></symbol>
  <symbol id="i-linkedin" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6ZM2 9h4v12H2zM4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/></symbol>
  <symbol id="i-star" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></symbol>
  <symbol id="i-sliders" viewBox="0 0 24 24"><path d="M3 6h10M19 6h2M3 12h4M13 12h8M3 18h13M20 18h1"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></symbol>
  <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></symbol>
  <symbol id="i-map" viewBox="0 0 24 24"><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2Z"/><path d="M9 4v14M15 6v14"/></symbol>
</svg>`;

const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const wordmark = `<a class="wordmark" href="index.html" aria-label="StayNest home"><svg class="wordmark__mark" aria-hidden="true"><use href="#i-logo"/></svg><span>StayNest</span></a>`;

const NAV = [
  { href: "index.html#edit", label: "Discover" },
  { href: "index.html#places", label: "Places" },
  { href: "index.html#approach", label: "Our approach" },
];

const headerHTML = `
<header class="site-header" data-header>
  <div class="container">
    <div class="site-header__pill">
      <div class="site-header__bar">
        ${wordmark}
        <nav class="nav" aria-label="Primary">
          <ul class="nav__list" role="list">
            ${NAV.map((n) => `<li><a class="nav__link" href="${n.href}">${n.label}</a></li>`).join("")}
          </ul>
        </nav>
        <div class="site-header__actions">
          <a class="nav__link" href="login.html">Sign in</a>
          <a class="btn btn--light btn--sm" href="host.html">Become a host</a>
        </div>
        <button class="menu-toggle" type="button" data-menu-toggle aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu">
          ${icon("menu", "icon--open")}${icon("close", "icon--close")}
        </button>
      </div>
      <div class="site-header__panel" id="mobile-nav">
        <div class="site-header__panel-inner">
          <div class="site-header__panel-body">
            <nav aria-label="Mobile">
              <ul class="panel-list" role="list">
                ${NAV.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join("")}
              </ul>
            </nav>
            <a class="btn btn--light" href="host.html">Become a host</a>
            <a class="panel-signin" href="login.html">Sign in</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>`;

const footerHTML = `
<footer class="site-footer">
  <div class="container">
    <div class="footer__grid">
      <div class="footer__brand">
        ${wordmark}
        <p class="footer__tag">Considered places for the way you want to travel—unhurried, curious, and entirely your own.</p>
      </div>
      <nav class="footer__col" aria-labelledby="f-explore">
        <h2 class="footer__title" id="f-explore">Explore</h2>
        <ul><li><a href="index.html#places">Places</a></li><li><a href="search.html?sort=new">New arrivals</a></li><li><a href="notes.html">Travel notes</a></li></ul>
      </nav>
      <nav class="footer__col" aria-labelledby="f-staynest">
        <h2 class="footer__title" id="f-staynest">StayNest</h2>
        <ul><li><a href="index.html#approach">Our approach</a></li><li><a href="trust.html">Trust &amp; safety</a></li><li><a href="help.html">Help centre</a></li></ul>
      </nav>
      <div class="footer__col">
        <h2 class="footer__title">A considered dispatch</h2>
        <p>A little address book for places worth knowing.</p>
        <button class="btn btn--outline-light btn--sm" type="button" data-dispatch>Join the note ${icon("arrow-up-right")}</button>
      </div>
    </div>
    <div class="footer__bottom">
      <p>© <span data-year></span> StayNest. Designed and built by Handsome.</p>
      <ul class="footer__social" role="list">
        <li><a href="#" aria-label="StayNest on Instagram">${icon("instagram")}</a></li>
        <li><a href="#" aria-label="StayNest on LinkedIn">${icon("linkedin")}</a></li>
      </ul>
    </div>
  </div>
</footer>`;

const searchHTML = `
<form class="search" role="search" aria-label="Search stays" action="search.html" novalidate>
  <div class="search__field search__field--where">
    ${icon("pin")}
    <div class="search__control">
      <label for="s-where">Where</label>
      <input id="s-where" name="where" type="text" placeholder="Search destinations" autocomplete="off">
    </div>
  </div>
  <div class="search__field">
    ${icon("calendar")}
    <div class="search__control">
      <label for="s-in">Check in</label>
      <input id="s-in" name="checkin" type="date" required>
      <span class="search__ph" aria-hidden="true">Add dates</span>
    </div>
  </div>
  <div class="search__field">
    ${icon("calendar")}
    <div class="search__control">
      <label for="s-out">Check out</label>
      <input id="s-out" name="checkout" type="date" required>
      <span class="search__ph" aria-hidden="true">Add dates</span>
    </div>
  </div>
  <div class="search__field">
    ${icon("user")}
    <div class="search__control">
      <label for="s-guests">Guests</label>
      <select id="s-guests" name="guests" required>
        <option value="" selected>Add guests</option>
        <option value="1">1 guest</option>
        <option value="2">2 guests</option>
        <option value="3">3 guests</option>
        <option value="4">4 guests</option>
        <option value="5">5 guests</option>
        <option value="6">6+ guests</option>
      </select>
    </div>
  </div>
  <button class="btn btn--primary search__submit" type="submit">
    ${icon("search")}
    <span>Search<span class="search__more"> stays</span></span>
  </button>
</form>`;

document.body.insertAdjacentHTML("afterbegin", SPRITE);
const headerSlot = document.querySelector('[data-component="header"]');
headerSlot?.insertAdjacentHTML("afterbegin", headerHTML);
if (headerSlot?.hasAttribute("data-solid"))
  headerSlot.querySelector(".site-header")?.classList.add("is-solid");
document
  .querySelector('[data-component="search"]')
  ?.insertAdjacentHTML("afterbegin", searchHTML);
document
  .querySelector('[data-component="footer"]')
  ?.insertAdjacentHTML("afterbegin", footerHTML);
document
  .querySelectorAll("[data-year]")
  .forEach((el) => (el.textContent = new Date().getFullYear()));
