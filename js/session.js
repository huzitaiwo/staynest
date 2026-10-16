import "./cloud.js";
import "./cloud-listings.js";
import "./cloud-shared.js";
import "./cloud-messages.js";
import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
} from "./firebase.js";

const slots = {
  desktop: document.querySelector('[data-auth-slot="desktop"]'),
  mobile: document.querySelector('[data-auth-slot="mobile"]'),
};
const signedOut = {
  desktop: slots.desktop?.innerHTML,
  mobile: slots.mobile?.innerHTML,
};

async function addHostLink(user) {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const role = snap.exists() ? snap.data().role : "guest";
    if (auth.currentUser?.uid !== user.uid) return;
    const links = [];
    if (role === "host" || role === "admin")
      links.push(["hosting.html", "Hosting"]);
    if (role === "admin") links.push(["admin.html", "Admin"]);
    links.forEach(([href, label]) => {
      slots.desktop
        .querySelector(".user-menu__panel a")
        ?.insertAdjacentHTML("beforebegin", `<a href="${href}">${label}</a>`);
      slots.mobile.insertAdjacentHTML(
        "afterbegin",
        `<a class="panel-signin" href="${href}">${label}</a>`,
      );
    });
  } catch (err) {
    console.error(err);
  }
}

function render(user) {
  if (!slots.desktop || !slots.mobile) return;
  if (!user) {
    slots.desktop.innerHTML = signedOut.desktop;
    slots.mobile.innerHTML = signedOut.mobile;
    return;
  }
  const label = user.displayName || user.email || "Account";
  slots.desktop.innerHTML = `
    <details class="user-menu">
      <summary aria-label="Account menu"><span class="user-menu__avatar" aria-hidden="true"></span></summary>
      <div class="user-menu__panel">
        <p class="user-menu__name"></p>
        <a href="trips.html">Trips</a>
        <a href="saved.html">Saved</a>
        <a href="messages.html">Messages</a>
        <a href="account.html">Profile</a>
        <button type="button" data-signout>Sign out</button>
      </div>
    </details>`;
  slots.desktop.querySelector(".user-menu__avatar").textContent = label
    .trim()[0]
    .toUpperCase();
  slots.desktop.querySelector(".user-menu__name").textContent = label;

  slots.mobile.innerHTML = `
    <a class="panel-signin" href="trips.html">Trips</a>
    <a class="panel-signin" href="saved.html">Saved</a>
    <a class="panel-signin" href="messages.html">Messages</a>
    <a class="panel-signin" href="account.html">Profile</a>
    <button class="panel-signin" type="button" data-signout>Sign out</button>`;
  addHostLink(user);
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
