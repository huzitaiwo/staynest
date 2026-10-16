// js/hosting-messages.js (ES module) — the host's inbox, live
import { auth, db, isConfigured, onAuthStateChanged } from "./firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const inbox = $("[data-inbox]");
const convosEl = $("[data-convos]");
const logEl = $("[data-log]");
const form = $("[data-composer]");
const input = $("#msg-input");
const sendBtn = $("[data-send]");
const live = $("[data-live]");

const shortTime = (iso) => {
  if (!iso) return "";
  const dt = new Date(iso);
  return dt.toDateString() === new Date().toDateString()
    ? dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const longTime = (iso) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const unread = (c) =>
  c.lastFrom === "guest" && (c.lastAt || "") > (c.hostReadAt || "");

let uid = null;
let convs = [];
let selected = null;
let msgs = [];
let unsubMsgs = null;

if (!isConfigured || !auth || !db) {
  $("[data-empty-title]").textContent = "Messaging needs Firebase";
  $("[data-empty-text]").textContent =
    "Add your Firebase config in js/firebase-config.js and guests' messages will appear here.";
  $("[data-empty]").hidden = false;
} else {
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    uid = user.uid;
    onSnapshot(
      query(collection(db, "conversations"), where("hostId", "==", uid)),
      (snap) => {
        convs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""));
        render();
      },
      (err) => console.error("Inbox failed", err),
    );
  });
}

function renderList() {
  convosEl.innerHTML = convs
    .map(
      (c) => `
    <li><button class="convo" type="button" data-id="${esc(c.id)}" aria-current="${c.id === selected}">
      <span class="avatar avatar--sm" aria-hidden="true">${esc((c.guestName || "G").trim()[0].toUpperCase())}</span>
      <span class="convo__text">
        <span class="convo__name">${esc(c.guestName || "Guest")}${unread(c) ? ' <span class="visually-hidden">(unread)</span><span aria-hidden="true" class="convo__dot">●</span>' : ""}</span>
        <span class="convo__prop">${esc(c.title)}</span>
        <span class="convo__snip">${esc(c.lastText || "")}</span>
      </span>
      <span class="convo__time">${esc(shortTime(c.lastAt))}</span>
    </button></li>`,
    )
    .join("");
}

// Classes are reused from the guest inbox: ".msg--guest" is the "mine" style, so the host's own messages use it here
function renderThread() {
  const c = convs.find((x) => x.id === selected);
  if (!c) return;
  $("[data-t-avatar]").textContent = (c.guestName || "G")
    .trim()[0]
    .toUpperCase();
  $("[data-t-name]").textContent = c.guestName || "Guest";
  $("[data-t-meta]").innerHTML =
    `About <a href="property.html?id=${esc(c.propertyId)}">${esc(c.title)}</a>`;
  logEl.innerHTML = msgs
    .map(
      (m) =>
        `<div class="msg msg--${m.from === "host" ? "guest" : "host"}">${esc(m.text)}<time datetime="${esc(m.at)}">${esc(longTime(m.at))}</time></div>`,
    )
    .join("");
  logEl.scrollTop = logEl.scrollHeight;
}

function markRead(c) {
  if (c && unread(c))
    updateDoc(doc(db, "conversations", c.id), {
      hostReadAt: new Date().toISOString(),
    }).catch(() => {});
}

function select(id) {
  if (id !== selected) {
    unsubMsgs?.();
    selected = id;
    msgs = [];
    unsubMsgs = onSnapshot(
      query(collection(db, "conversations", id, "messages"), orderBy("at")),
      (snap) => {
        msgs = snap.docs.map((d) => d.data());
        renderThread();
      },
      (err) => console.error("Thread failed", err),
    );
  }
  renderList();
  renderThread();
  markRead(convs.find((c) => c.id === id));
  inbox.dataset.pane = "thread";
}

function render() {
  const has = convs.length > 0;
  inbox.hidden = !has;
  $("[data-empty]").hidden = has;
  if (!has) return;
  if (selected && !convs.some((c) => c.id === selected)) selected = null;
  if (!selected) {
    select(convs[0].id);
    inbox.dataset.pane = "list";
    return;
  }
  renderList();
  const c = convs.find((x) => x.id === selected);
  if (unread(c)) markRead(c); // a new guest message arrived while this chat is open
}

convosEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-id]");
  if (b) select(b.dataset.id);
});
$("[data-back]").addEventListener("click", () => {
  inbox.dataset.pane = "list";
});

input.addEventListener("input", () => {
  sendBtn.disabled = !input.value.trim();
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  const c = convs.find((x) => x.id === selected);
  if (!text || !c) return;
  const at = new Date().toISOString();
  sendBtn.disabled = true;
  try {
    await setDoc(
      doc(
        db,
        "conversations",
        c.id,
        "messages",
        `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      ),
      { from: "host", senderId: uid, text, at },
    );
    await updateDoc(doc(db, "conversations", c.id), {
      lastText: text.slice(0, 140),
      lastFrom: "host",
      lastAt: at,
      updatedAt: at,
      hostReadAt: at,
    });
    input.value = "";
    input.dispatchEvent(new Event("input"));
    live.textContent = "Reply sent.";
  } catch (err) {
    console.error(err);
    live.textContent = "Couldn't send that reply. Try again.";
    sendBtn.disabled = false;
  }
  input.focus();
});
