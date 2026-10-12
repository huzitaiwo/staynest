// js/cloud-listings.js — publishes a host's listings to Firestore and lets everyone see published ones.
import { auth, db, isConfigured, onAuthStateChanged } from "./firebase.js";
import { reloadOnce } from "./cloud.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const SN = window.StayNest;

if (isConfigured && auth && db && SN?.keys) {
  const LKEY = SN.keys.listings; // 'sn-listings' (this host's own listings)
  const RKEY = "sn-remote-listings"; // published listings from other hosts (cover photo only)
  const IDS = "sn-cloud-listing-ids"; // ids already pushed, to tell "deleted elsewhere" from "never uploaded"

  const pad = (n) => String(n).padStart(2, "0");
  const parse = (s, fb) => {
    try {
      const v = JSON.parse(s);
      return v ?? fb;
    } catch {
      return fb;
    }
  };
  const readOwn = () => {
    const v = parse(localStorage.getItem(LKEY), []);
    return Array.isArray(v) ? v : [];
  };
  const readIds = () => parse(localStorage.getItem(IDS), []);
  const writeIds = (ids) => {
    try {
      localStorage.setItem(IDS, JSON.stringify([...new Set(ids)]));
    } catch {
      /* ignore */
    }
  };
  const addId = (id) => writeIds([...readIds(), id]);
  const removeId = (id) => writeIds(readIds().filter((x) => x !== id));

  const sigs = {}; // photo signature last stored remotely
  const counts = {}; // number of photo docs stored remotely
  const covers = {}; // cover thumbnail stored remotely
  const known = {}; // updatedAt last pushed or pulled
  let applying = false;

  let chain = Promise.resolve();
  const enqueue = (fn) => {
    chain = chain
      .then(fn)
      .catch((e) => console.error("Listing sync failed", e));
  };

  /* ---------- image helpers ---------- */
  const loadImg = (src) =>
    new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
  async function shrink(src, max, quality) {
    const img = await loadImg(src);
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  }
  async function fetchPhotos(id) {
    const snap = await getDocs(collection(db, "listings", id, "photos"));
    return snap.docs
      .map((d) => d.data())
      .sort((a, b) => a.i - b.i)
      .map((d) => d.src);
  }

  /* ---------- push / remove ---------- */
  async function pushListing(l) {
    const user = auth.currentUser;
    if (!user) return;
    const photos = l.photos || [];
    const sig = `${photos.length}:${photos.map((p) => p.length).join(",")}`;

    if (sigs[l.id] !== sig) {
      // photos changed (or never uploaded): re-upload them, then drop leftovers
      const full = [];
      for (const p of photos) full.push(await shrink(p, 1100, 0.72));
      covers[l.id] = photos[0] ? await shrink(photos[0], 560, 0.65) : "";
      for (let i = 0; i < full.length; i += 1) {
        await setDoc(doc(db, "listings", l.id, "photos", pad(i)), {
          ownerId: user.uid,
          i,
          src: full[i],
        });
      }
      for (let i = full.length; i < (counts[l.id] || 0); i += 1)
        await deleteDoc(doc(db, "listings", l.id, "photos", pad(i)));
    }

    const { photos: _omit, ...rest } = l;
    await setDoc(doc(db, "listings", l.id), {
      ownerId: user.uid,
      status: l.status || "draft",
      updatedAt: l.updatedAt || new Date().toISOString(),
      title: l.title || "",
      city: l.city || "",
      country: l.country || "",
      data: JSON.stringify(rest),
      cover: covers[l.id] || "",
      photoCount: photos.length,
      photoSig: sig,
    });
    sigs[l.id] = sig;
    counts[l.id] = photos.length;
    known[l.id] = l.updatedAt;
    addId(l.id);
  }

  async function removeListing(id) {
    for (let i = 0; i < (counts[id] || 0); i += 1)
      await deleteDoc(doc(db, "listings", id, "photos", pad(i)));
    await deleteDoc(doc(db, "listings", id));
    delete known[id];
    delete sigs[id];
    delete counts[id];
    delete covers[id];
    removeId(id);
  }

  // Called after any write to the host's own listings
  let flushTimer;
  function flushOwn() {
    if (!auth.currentUser) return;
    const list = readOwn();
    const have = new Set(list.map((l) => l.id));
    list.forEach((l) => {
      if (known[l.id] !== l.updatedAt) enqueue(() => pushListing(l));
    });
    Object.keys(known).forEach((id) => {
      if (!have.has(id)) enqueue(() => removeListing(id));
    });
  }

  const prevSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function setItem(k, v) {
    prevSet.call(this, k, v);
    if (this === localStorage && !applying && k === LKEY) {
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flushOwn, 1200);
    }
  };

  /* ---------- pull the host's own listings ---------- */
  async function pullOwn(uid) {
    const snap = await getDocs(
      query(collection(db, "listings"), where("ownerId", "==", uid)),
    );
    const remote = new Map(snap.docs.map((d) => [d.id, d.data()]));
    const ids = new Set(readIds());
    let next = readOwn();
    let changed = false;

    for (const [id, r] of remote) {
      sigs[id] = r.photoSig;
      counts[id] = r.photoCount || 0;
      covers[id] = r.cover;
      known[id] = r.updatedAt;
      const l = next.find((x) => x.id === id);
      if (!l || (r.updatedAt || "") > (l.updatedAt || "")) {
        const photos = await fetchPhotos(id);
        const full = {
          ...parse(r.data, {}),
          id,
          photos,
          status: r.status,
          updatedAt: r.updatedAt,
        };
        next = l ? next.map((x) => (x.id === id ? full : x)) : [full, ...next];
        changed = true;
        ids.add(id);
      }
    }
    for (const l of [...next]) {
      const r = remote.get(l.id);
      if (!r) {
        if (ids.has(l.id)) {
          next = next.filter((x) => x.id !== l.id);
          ids.delete(l.id);
          changed = true;
        } // deleted on another device
        else enqueue(() => pushListing(l)); // created here, not uploaded yet
      } else if ((l.updatedAt || "") > (r.updatedAt || "")) {
        enqueue(() => pushListing(l)); // edited here since the last sync
      }
    }
    writeIds([...ids, ...remote.keys()]);
    if (changed) {
      applying = true;
      try {
        localStorage.setItem(LKEY, JSON.stringify(next));
      } catch (e) {
        console.error("Storage full", e);
      }
      applying = false;
    }
    return changed;
  }

  /* ---------- pull everyone's published listings (cover photo only, to keep storage small) ---------- */
  async function pullPublic(uid) {
    const snap = await getDocs(
      query(collection(db, "listings"), where("status", "==", "published")),
    );
    const out = [];
    snap.docs.forEach((d) => {
      const r = d.data();
      if (r.ownerId === uid || !r.cover) return;
      const data = parse(r.data, null);
      if (!data) return;
      out.push({
        ...data,
        id: d.id,
        ownerId: r.ownerId,
        status: "published",
        photos: [r.cover],
        photoCount: r.photoCount || 1,
        updatedAt: r.updatedAt,
      });
    });
    out.sort((a, b) => a.id.localeCompare(b.id));
    const next = JSON.stringify(out.slice(0, 30));
    if (next === (localStorage.getItem(RKEY) || "[]")) return false;
    applying = true;
    try {
      localStorage.setItem(RKEY, next);
    } catch (e) {
      console.error("Storage full", e);
    }
    applying = false;
    return true;
  }

  // The property page calls this to load the full gallery of someone else's listing
  SN.cloudListings = { photos: fetchPhotos };
  window.dispatchEvent(new CustomEvent("sn:listings-ready"));

  onAuthStateChanged(auth, async (user) => {
    try {
      let changed = false;
      if (user) changed = await pullOwn(user.uid);
      changed = (await pullPublic(user?.uid)) || changed;
      if (changed) reloadOnce();
    } catch (err) {
      console.error("Listings sync failed", err);
    }
  });
}
