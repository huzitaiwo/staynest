const reveal = () => document.documentElement.classList.remove("guarding");
const need = document.body.dataset.role; // e.g. "host"

try {
  const { auth, db, isConfigured, onAuthStateChanged, doc, getDoc } =
    await import("./firebase.js");
  if (!isConfigured || !auth) {
    reveal();
  } else {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        const page = location.pathname.split("/").pop() || "index.html";
        location.replace(`login.html?next=${encodeURIComponent(page)}`);
        return;
      }
      if (need) {
        let role = "guest";
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) role = snap.data().role;
        } catch (err) {
          console.error(err);
        }
        if (role !== need && role !== "admin") {
          location.replace("host.html");
          return;
        }
      }
      const first = (user.displayName || "").trim().split(" ")[0];
      const greeting = document.querySelector("[data-greeting]");
      if (greeting && first) greeting.textContent = `Hi, ${first}`;
      reveal();
    });
  }
} catch (err) {
  console.error(err);
  reveal();
}
