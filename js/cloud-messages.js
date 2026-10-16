// js/cloud-messages.js — carries a guest's messages to the host and the host's replies back.
// Runs only on the guest Messages page.
import { auth, db, isConfigured, onAuthStateChanged } from "./firebase.js";
import * as cfg from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const SN = window.StayNest;

if (
  isConfigured &&
  auth &&
  db &&
  SN?.allProperties &&
  document.querySelector("[data-inbox]")
) {
  const KEY = "sn-messages";
  const IDS = "sn-cloud-msg-ids";
  const SAMPLE_HOST_UID = cfg.SAMPLE_HOST_UID || "";

  const parse = (s, fb) => {
    try {
      const v = JSON.parse(s);
      return v ?? fb;
    } catch {
      return fb;
    }
  };
  const readThreads = () => {
    const v = parse(localStorage.getItem(KEY), []);
    return Array.isArray(v) ? v : [];
  };
  let applying = false;
  let uid = null;
  const rawSet = (k, v) => {
    applying = true;
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      console.error("Storage full", e);
    }
    applying = false;
  };

  const pushed = new Set(parse(localStorage.getItem(IDS), []));
  const seen = {}; // conversation id -> last activity already pulled

  let chain = Promise.resolve();
  const enqueue = (fn) => {
    chain = chain
      .then(fn)
      .catch((e) => console.error("Message sync failed", e));
  };

  const hostIdOf = (propertyId) => {
    const p = SN.allProperties.find((x) => x.id === propertyId);
    if (!p) return "";
    if (p.remote) return p.ownerId || "";
    if (p.mine) return uid;
    return SAMPLE_HOST_UID;
  };

  /* ---------- guest → host ---------- */
  async function pushMessage(t, m) {
    const cid = `${t.propertyId}__${uid}`;
    const mref = doc(db, "conversations", cid, "messages", m.id);
    if ((await getDoc(mref).catch(() => null))?.exists()) {
      pushed.add(m.id);
      return;
    } // already uploaded from another device

    const p = SN.allProperties.find((x) => x.id === t.propertyId);
    const cref = doc(db, "conversations", cid);
    const last = {
      lastText: m.text.slice(0, 140),
      lastFrom: "guest",
      lastAt: m.at,
      updatedAt: m.at,
    };
    if ((await getDoc(cref)).exists()) {
      await updateDoc(cref, last);
    } else {
      await setDoc(cref, {
        propertyId: t.propertyId,
        title: p?.title || "",
        guestId: uid,
        hostId: hostIdOf(t.propertyId),
        guestName: auth.currentUser?.displayName || "Guest",
        ...last,
        guestReadAt: m.at,
        hostReadAt: "",
      });
    }
    await setDoc(mref, {
      from: "guest",
      senderId: uid,
      text: m.text,
      at: m.at,
    });
    pushed.add(m.id);
    try {
      localStorage.setItem(IDS, JSON.stringify([...pushed]));
    } catch {
      /* ignore */
    }
  }

  function flush() {
    if (!uid) return;
    readThreads().forEach((t) =>
      (t.messages || []).forEach((m) => {
        if (m.from === "guest" && !pushed.has(m.id))
          enqueue(() => pushMessage(t, m));
      }),
    );
  }

  /* ---------- host → guest ---------- */
  async function pull() {
    if (!uid) return;
    const snap = await getDocs(
      query(collection(db, "conversations"), where("guestId", "==", uid)),
    );
    let threads = readThreads();
    let changed = false;

    for (const d of snap.docs) {
      const c = d.data();
      if (seen[d.id] === c.lastAt) continue;
      const ms = await getDocs(
        query(
          collection(db, "conversations", d.id, "messages"),
          where("from", "==", "host"),
        ),
      );
      let t = threads.find((x) => x.propertyId === c.propertyId);
      if (!t) {
        t = {
          id: c.propertyId,
          propertyId: c.propertyId,
          messages: [],
          updatedAt: c.lastAt,
        };
        threads = [t, ...threads];
        changed = true;
      }
      ms.docs.forEach((md) => {
        if (t.messages.some((x) => x.id === md.id)) return;
        const m = md.data();
        t.messages.push({ id: md.id, from: "host", text: m.text, at: m.at });
        changed = true;
      });
      t.messages.sort((a, b) => String(a.at).localeCompare(String(b.at)));
      if ((c.lastAt || "") > (t.updatedAt || "")) t.updatedAt = c.lastAt;
      seen[d.id] = c.lastAt;
      if (c.lastFrom === "host")
        updateDoc(doc(db, "conversations", d.id), {
          guestReadAt: new Date().toISOString(),
        }).catch(() => {});
    }
    if (changed) {
      rawSet(KEY, threads);
      window.dispatchEvent(new Event("sn:messages-updated"));
    }
  }

  /* ---------- hooks ---------- */
  let timer;
  const prevSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function setItem(k, v) {
    prevSet.call(this, k, v);
    if (this === localStorage && !applying && k === KEY) {
      clearTimeout(timer);
      timer = setTimeout(flush, 600);
    }
  };

  onAuthStateChanged(auth, async (user) => {
    uid = user?.uid || null;
    if (!uid) return;
    try {
      await pull();
      flush();
    } catch (e) {
      console.error("Messages sync failed", e);
    }
    setInterval(() => {
      if (!document.hidden) pull().catch((e) => console.error(e));
    }, 15000); // check for replies
  });
}
