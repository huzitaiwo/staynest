import {
  auth,
  db,
  isConfigured,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  doc,
  setDoc,
  serverTimestamp,
} from "./firebase.js";

const SN = window.StayNest;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const messages = {
  "auth/invalid-credential":
    "That email and password don't match. Check them and try again.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/email-already-in-use":
    "An account with this email already exists. Try signing in instead.",
  "auth/weak-password": "Choose a stronger password.",
  "auth/too-many-requests":
    "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed":
    "We couldn't reach the server. Check your connection and try again.",
  "auth/user-disabled": "This account has been disabled.",
};

// Only same-site page names are allowed, so ?next= can't redirect to another website.
const nextUrl = () => {
  const n = new URLSearchParams(location.search).get("next") || "";
  return /^[\w-]+\.html(\?[\w%=&.-]*)?$/i.test(n) ? n : "index.html";
};

let busy = false;

/* Keep ?next= when moving between sign in and sign up */
$$("[data-keep-next]").forEach((a) => {
  a.search = location.search;
});

/* Show / hide password */
$$("[data-toggle-password]").forEach((btn) =>
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.getAttribute("aria-controls"));
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.textContent = show ? "Hide" : "Show";
    btn.setAttribute("aria-pressed", String(show));
  }),
);

/* Live re-validation once a field has been flagged */
$$("[data-rule]").forEach((el) => {
  el.addEventListener("blur", () => {
    if (el.value || el.checked) SN.checkField(el);
  });
  el.addEventListener("input", () => {
    if (el.getAttribute("aria-invalid") === "true") SN.checkField(el);
  });
  el.addEventListener("change", () => {
    if (el.getAttribute("aria-invalid") === "true") SN.checkField(el);
  });
});

/* Form runner: validate, check config, show loading, map errors */
async function run(form, task) {
  if (busy) return;
  const card = form.closest(".auth__card");
  const errEl = $("[data-form-error]", card);
  const okEl = $("[data-form-success]", card);
  const btn = $("[data-submit]", form);
  errEl.hidden = true;
  if (okEl) okEl.hidden = true;

  if (!SN.validateFields(form)) return;
  if (!isConfigured) {
    errEl.textContent =
      "Firebase isn't configured yet. Add your project keys in js/firebase-config.js.";
    errEl.hidden = false;
    return;
  }

  busy = true;
  btn.classList.add("is-loading");
  btn.setAttribute("aria-busy", "true");
  try {
    await task({ card, okEl });
  } catch (err) {
    console.error(err);
    errEl.textContent =
      messages[err.code] || "Something went wrong. Please try again.";
    errEl.hidden = false;
  } finally {
    busy = false;
    btn.classList.remove("is-loading");
    btn.removeAttribute("aria-busy");
  }
}

/* Sign in */
const loginForm = $('[data-auth="login"]');
loginForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  run(loginForm, async () => {
    await setPersistence(
      auth,
      loginForm.elements.keep.checked
        ? browserLocalPersistence
        : browserSessionPersistence,
    );
    await signInWithEmailAndPassword(
      auth,
      $("#li-email").value.trim(),
      $("#li-password").value,
    );
    location.assign(nextUrl());
  });
});

/* Sign up */
const signupForm = $('[data-auth="signup"]');
signupForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  run(signupForm, async () => {
    const name = $("#su-name").value.trim();
    const email = $("#su-email").value.trim();
    const role = signupForm.elements.role.value === "host" ? "host" : "guest"; // admin is never self-assigned
    const cred = await createUserWithEmailAndPassword(
      auth,
      email,
      $("#su-password").value,
    );
    await updateProfile(cred.user, { displayName: name });
    try {
      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        email,
        role,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Profile not saved", err); // account exists; profile can be created on next sign in
    }
    location.assign(role === "host" ? "host.html" : nextUrl());
  });
});

/* Reset password */
const resetForm = $('[data-auth="reset"]');
resetForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  run(resetForm, async ({ okEl }) => {
    try {
      await sendPasswordResetEmail(auth, $("#rs-email").value.trim());
    } catch (err) {
      if (err.code !== "auth/user-not-found") throw err;
    }
    // Same message either way, so the form doesn't reveal which emails have accounts.
    okEl.textContent =
      "If an account exists for that email, a reset link is on its way.";
    okEl.hidden = false;
  });
});

/* Switch between sign in and reset */
function showView(name) {
  $$("[data-view]").forEach((v) => (v.hidden = v.dataset.view !== name));
  $(`[data-view="${name}"] input`)?.focus();
}
$("[data-show-reset]")?.addEventListener("click", () => {
  showView("reset");
  const email = $("#li-email").value;
  if (email) $("#rs-email").value = email;
});
$("[data-show-login]")?.addEventListener("click", () => showView("login"));

/* Already signed in? Skip the form. */
if (auth)
  onAuthStateChanged(auth, (user) => {
    if (user && !busy) location.replace(nextUrl());
  });
