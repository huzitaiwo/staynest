import {
  auth,
  db,
  isConfigured,
  onAuthStateChanged,
  doc,
  getDoc,
  updateDoc,
} from "./firebase.js";

const cta = document.querySelector("[data-host-cta]");
const label = cta.querySelector("span");
const errEl = document.querySelector("[data-host-err]");
let user = null;
let role = null;

const isHost = () => role === "host" || role === "admin";
function setLabel() {
  label.textContent = !isConfigured
    ? "Open the host dashboard"
    : !user
      ? "Create a host account"
      : isHost()
        ? "Go to your dashboard"
        : "Start hosting";
}

if (auth) {
  onAuthStateChanged(auth, async (u) => {
    user = u;
    role = null;
    if (u) {
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        role = snap.exists() ? snap.data().role : "guest";
      } catch {
        role = "guest";
      }
    }
    setLabel();
  });
}
setLabel();

cta.addEventListener("click", async () => {
  errEl.hidden = true;
  if (!isConfigured) return location.assign("hosting.html"); // demo mode
  if (!user) return location.assign("signup.html?next=host.html");
  if (isHost()) return location.assign("hosting.html");

  cta.classList.add("is-loading");
  try {
    await updateDoc(doc(db, "users", user.uid), { role: "host" }); // rules only allow guest → host
    location.assign("hosting.html");
  } catch (err) {
    console.error(err);
    errEl.textContent =
      "We couldn't switch your account to hosting. Please try again.";
    errEl.hidden = false;
  } finally {
    cta.classList.remove("is-loading");
  }
});
