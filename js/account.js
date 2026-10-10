import {
  auth,
  db,
  isConfigured,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "./firebase.js";

const SN = window.StayNest;
const $ = (s, r = document) => r.querySelector(s);

const LOCAL_KEY = "sn-profile";
const defaults = { name: "", phone: "", city: "", remind: true, news: false };
const form = $("[data-profile-form]");
const saveBtn = $("[data-save-profile]");
let user = null;
let role = "guest";

const readLocal = () => {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(LOCAL_KEY)) };
  } catch {
    return { ...defaults };
  }
};
const show = (el, msg) => {
  el.textContent = msg;
  el.hidden = false;
};

function fill(data) {
  $("#pf-name").value = data.name;
  $("#pf-phone").value = data.phone;
  $("#pf-city").value = data.city;
  $("#pf-remind").checked = data.remind;
  $("#pf-news").checked = data.news;
  $("#pf-email").value = user?.email || "";
  $("#pf-email").placeholder = user ? "" : "Sign in to see your email";

  const label = data.name || user?.email || "Your name";
  $("[data-avatar]").textContent = label.trim()[0].toUpperCase();
  $("[data-name]").textContent = label;
  const roleLabel =
    role === "host" ? "Host" : role === "admin" ? "Admin" : "Guest";
  $("[data-role]").textContent =
    `${roleLabel} account${isConfigured && user ? "" : " · demo mode"}`;
  $("[data-role-row]").textContent = roleLabel;
}

async function load() {
  let data = { ...defaults };
  if (isConfigured && user) {
    data.name = user.displayName || "";
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const s = snap.data();
        data = {
          ...data,
          name: s.name || data.name,
          phone: s.phone || "",
          city: s.city || "",
          remind: s.remind ?? true,
          news: s.news ?? false,
        };
        role = s.role || "guest";
      }
    } catch (err) {
      console.error(err);
    }
  } else {
    data = readLocal();
  }
  fill(data);
}

/* Validation feedback */
["#pf-name", "#pf-phone"].forEach((sel) => {
  const el = $(sel);
  el.addEventListener("blur", () => {
    if (el.value) SN.checkField(el);
  });
  el.addEventListener("input", () => {
    if (el.getAttribute("aria-invalid") === "true") SN.checkField(el);
  });
});

/* Save */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  $("[data-err]").hidden = true;
  $("[data-ok]").hidden = true;
  if (!SN.validateFields(form)) return;

  const data = {
    name: $("#pf-name").value.trim(),
    phone: $("#pf-phone").value.trim(),
    city: $("#pf-city").value.trim(),
    remind: $("#pf-remind").checked,
    news: $("#pf-news").checked,
  };

  saveBtn.classList.add("is-loading");
  saveBtn.setAttribute("aria-busy", "true");
  try {
    if (isConfigured && user) {
      await updateProfile(user, { displayName: data.name });
      const ref = doc(db, "users", user.uid);
      try {
        await updateDoc(ref, data);
      } catch (err) {
        if (err.code !== "not-found") throw err;
        await setDoc(ref, {
          name: data.name,
          email: user.email,
          role: "guest",
          createdAt: serverTimestamp(),
        });
        await updateDoc(ref, data);
      }
    } else {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    }
    fill(data);
    show($("[data-ok]"), "Your profile has been saved.");
  } catch (err) {
    console.error(err);
    show(
      $("[data-err]"),
      "We couldn't save your changes. Check your connection and try again.",
    );
  } finally {
    saveBtn.classList.remove("is-loading");
    saveBtn.removeAttribute("aria-busy");
  }
});

/* Account actions */
$("[data-reset]").addEventListener("click", async () => {
  $("[data-acct-err]").hidden = true;
  $("[data-acct-ok]").hidden = true;
  if (!isConfigured || !user?.email) {
    show(
      $("[data-acct-err]"),
      "Sign in with a connected account to change your password.",
    );
    return;
  }
  try {
    await sendPasswordResetEmail(auth, user.email);
    show($("[data-acct-ok]"), "We sent a password reset link to your email.");
  } catch (err) {
    console.error(err);
    show(
      $("[data-acct-err]"),
      "We couldn't send the link. Please try again in a moment.",
    );
  }
});

const signOutBtn = $("[data-signout-btn]");
if (!isConfigured) signOutBtn.hidden = true;
signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
  location.assign("index.html");
});

/* Init */
if (auth) {
  onAuthStateChanged(auth, (u) => {
    if (u) {
      user = u;
      load();
    }
  });
} else {
  load();
}
