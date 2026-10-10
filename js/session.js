import { auth, onAuthStateChanged, signOut } from "./firebase.js";

const slots = {
  desktop: document.querySelector('[data-auth-slot="desktop"]'),
  mobile: document.querySelector('[data-auth-slot="mobile"]'),
};
const signedOut = {
  desktop: slots.desktop?.innerHTML,
  mobile: slots.mobile?.innerHTML,
};

function render(user) {
  if (!slots.desktop || !slots.mobile) return;
  if (!user) {
    slots.desktop.innerHTML = signedOut.desktop;
    slots.mobile.innerHTML = signedOut.mobile;
    return;
  }
  const label = user.displayName || user.email || "Account";
  const initial = label.trim()[0].toUpperCase();

  slots.desktop.innerHTML = `
    <details class="user-menu">
      <summary aria-label="Account menu"><span class="user-menu__avatar" aria-hidden="true"></span></summary>
      <div class="user-menu__panel">
        <p class="user-menu__name"></p>
        <a href="trips.html">Trips</a>
        <a href="saved.html">Saved</a>
        <button type="button" data-signout>Sign out</button>
      </div>
    </details>`;
  slots.desktop.querySelector(".user-menu__avatar").textContent = initial;
  slots.desktop.querySelector(".user-menu__name").textContent = label;

  slots.mobile.innerHTML = `
    <a class="panel-signin" href="trips.html">Trips</a>
    <a class="panel-signin" href="saved.html">Saved</a>
    <button class="panel-signin" type="button" data-signout>Sign out</button>`;
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-signout]")) signOut(auth);
  const menu = document.querySelector(".user-menu[open]");
  if (menu && !menu.contains(e.target)) menu.removeAttribute("open");
});
document.addEventListener("keydown", (e) => {
  const menu = document.querySelector(".user-menu[open]");
  if (e.key === "Escape" && menu) {
    menu.removeAttribute("open");
    menu.querySelector("summary").focus();
  }
});

if (auth) onAuthStateChanged(auth, render);
