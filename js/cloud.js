// js/cloud.js — keeps the signed-in user's private data in Firestore. No-op until Firebase is configured.
import {
  auth,
  db,
  isConfigured,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
} from "./firebase.js";

const KEYS = [
  "sn-saved",
  "sn-bookings",
  "sn-messages",
  "sn-profile",
  "sn-blocked",
];
const META = "sn-cloud-meta"; // { [key]: { synced: ISO, dirty: bool } }
const LAST_UID = "sn-cloud-uid"; // which account this browser's data belongs to

if (isConfigured && auth && db) {
  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;
  const get = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const put = (k, v) => {
    try {
      nativeSet.call(localStorage, k, v);
    } catch {
      /* storage full or blocked */
    }
  };
  const drop = (k) => {
    try {
      nativeRemove.call(localStorage, k);
    } catch {
      /* ignore */
    }
  };
  const parse = (s, fb) => {
    try {
      const v = JSON.parse(s);
      return v ?? fb;
    } catch {
      return fb;
    }
  };
  const meta = () => parse(get(META), {});
  const saveMeta = (m) => put(META, JSON.stringify(m));
  const fallback = (k) => (k === "sn-profile" || k === "sn-blocked" ? {} : []);

  let uid = null;
  let applying = false;
  const timers = {};

  /* ---------- merge rules, used only when the same key changed in two places ---------- */
  const byKey = (a, b, keyOf, pick) => {
    const m = new Map();
    [...a, ...b].forEach((x) => {
      const k = keyOf(x);
      m.set(k, m.has(k) ? pick(m.get(k), x) : x);
    });
    return [...m.values()];
  };
  const MERGE = {
    "sn-saved": (r, l) => [...new Set([...r, ...l])],
    "sn-bookings": (r, l) =>
      byKey(
        r,
        l,
        (b) => b.ref,
        (a, b) =>
          a.status === "cancelled" ? a : b.status === "cancelled" ? b : a,
      ),
    "sn-messages": (r, l) =>
      byKey(
        r,
        l,
        (t) => t.id,
        (a, b) => ({
          ...a,
          ...b,
          messages: byKey(
            a.messages || [],
            b.messages || [],
            (m) => m.id,
            (x) => x,
          ).sort((x, y) => String(x.at).localeCompare(String(y.at))),
          updatedAt:
            (a.updatedAt || "") > (b.updatedAt || "")
              ? a.updatedAt
              : b.updatedAt,
        }),
      ),
    "sn-profile": (r, l) => ({ ...r, ...l }),
    "sn-blocked": (r, l) => {
      const out = { ...r };
      Object.entries(l).forEach(([id, ds]) => {
        out[id] = [...new Set([...(out[id] || []), ...ds])].sort();
      });
      return out;
    },
  };

  /* ---------- push ---------- */
  async function push(k) {
    if (!uid) return;
    const v = get(k) ?? JSON.stringify(fallback(k));
    const updatedAt = new Date().toISOString();
    await setDoc(doc(db, "users", uid, "data", k), { v, updatedAt });
    const m = meta();
    const stale = get(k) !== v && get(k) !== null; // edited again while we were saving
    m[k] = { synced: updatedAt, dirty: stale };
    saveMeta(m);
    if (stale) schedule(k);
  }
  function schedule(k) {
    clearTimeout(timers[k]);
    timers[k] = setTimeout(() => {
      delete timers[k];
      push(k).catch(console.error);
    }, 800);
  }

  // Any write to a synced key marks it as changed, whichever script made it
  Storage.prototype.setItem = function setItem(k, v) {
    nativeSet.call(this, k, v);
    if (this !== localStorage || applying || !KEYS.includes(k)) return;
    const m = meta();
    m[k] = { ...(m[k] || {}), dirty: true };
    saveMeta(m);
    if (uid) schedule(k);
  };
  addEventListener("pagehide", () =>
    Object.keys(timers).forEach((k) => {
      clearTimeout(timers[k]);
      push(k).catch(() => {});
    }),
  );

  /* ---------- pull + reconcile after sign-in ---------- */
  async function pull(user) {
    const remotes = await Promise.all(
      KEYS.map(async (k) => {
        const snap = await getDoc(doc(db, "users", user.uid, "data", k));
        return [k, snap.exists() ? snap.data() : null];
      }),
    );

    const m = meta();
    const toPush = [];
    let changed = false;
    applying = true;
    for (const [k, remote] of remotes) {
      const local = get(k);
      const mk = m[k];
      let next = null;

      if (!remote) {
        if (local) toPush.push(k);
      } else if (!local) {
        next = remote.v;
        m[k] = { synced: remote.updatedAt, dirty: false };
      } else if (!mk?.synced || (mk.dirty && remote.updatedAt > mk.synced)) {
        // never synced here, or changed on both sides: merge
        next = JSON.stringify(
          MERGE[k](parse(remote.v, fallback(k)), parse(local, fallback(k))),
        );
        toPush.push(k);
      } else if (mk.dirty) {
        toPush.push(k); // only changed here
      } else if (remote.updatedAt > mk.synced) {
        next = remote.v; // only changed elsewhere
        m[k] = { synced: remote.updatedAt, dirty: false };
      }

      if (next !== null && next !== local) {
        put(k, next);
        changed = true;
      }
    }
    applying = false;
    saveMeta(m);
    await Promise.all(toPush.map((k) => push(k)));
    return changed;
  }

  const wipe = () => {
    [...KEYS, "sn-listings", "sn-cloud-listing-ids"].forEach(drop);
    drop(META);
  };

  onAuthStateChanged(auth, async (user) => {
    const last = get(LAST_UID);
    if (!user) {
      uid = null;
      if (last) {
        wipe();
        drop(LAST_UID);
        location.reload();
      } // signed out: don't leave their data behind
      return;
    }
    if (last && last !== user.uid) wipe(); // a different account used this browser
    put(LAST_UID, user.uid);
    uid = user.uid;
    try {
      if (await pull(user)) reloadOnce(); // pages rendered before the pull, so refresh once
    } catch (err) {
      console.error("Cloud sync failed", err);
    }
  });
}

export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem("sn-cloud-reload") || 0);
    if (Date.now() - last < 15000) return;
    sessionStorage.setItem("sn-cloud-reload", String(Date.now()));
  } catch {
    return;
  }
  location.reload();
}
