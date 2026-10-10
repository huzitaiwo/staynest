const reveal = () => document.documentElement.classList.remove("guarding");

try {
  const { auth, isConfigured, onAuthStateChanged } =
    await import("./firebase.js");
  if (!isConfigured || !auth) {
    reveal();
  } else {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        const page = location.pathname.split("/").pop() || "index.html";
        location.replace(`login.html?next=${encodeURIComponent(page)}`);
        return;
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
