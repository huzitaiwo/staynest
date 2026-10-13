// js/cloud-shared.js — bookings, availability, reviews and reports shared between accounts.
import { auth, db, isConfigured, onAuthStateChanged } from "./firebase.js";
import { reloadOnce } from "./cloud.js";
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
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const SN = window.StayNest;

if (isConfigured && auth && db && SN?.bookings) {
  const SAMPLE_HOST_UID = cfg.SAMPLE_HOST_UID || "";
  const K = {
    bookings: "sn-bookings",
    blocked: "sn-blocked",
    reviews: "sn-reviews",
    reports: "sn-reports",
  };
  const C = {
    bookings: "sn-remote-bookings",
    busy: "sn-busy",
    blocked: "sn-blocked-remote",
    reviews: "sn-remote-reviews",
    reports: "sn-remote-reports",
    revIds: "sn-cloud-review-ids",
    repIds: "sn-cloud-report-ids",
  };

  const parse = (s, fb) => {
    try {
      const v = JSON.parse(s);
      return v ?? fb;
    } catch {
      return fb;
    }
  };
  const read = (k, fb) => parse(localStorage.getItem(k), fb);
  let applying = false;
  let ready = false;
  const rawSet = (k, v) => {
    applying = true;
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      console.error("Storage full", e);
    }
    applying = false;
  };
  const setCache = (k, v) => {
    const next = JSON.stringify(v);
    if (next === (localStorage.getItem(k) || (Array.isArray(v) ? "[]" : "{}")))
      return false;
    rawSet(k, v);
    return true;
  };
  const idSet = (k) => new Set(read(k, []));
  const saveIds = (k, set) => rawSet(k, [...set]);

  let chain = Promise.resolve();
  const enqueue = (fn) => {
    chain = chain.then(fn).catch((e) => console.error("Sync failed", e));
  };

  const hostIdOf = (listingId, uid) => {
    const p = SN.allProperties.find((x) => x.id === listingId);
    if (!p) return "";
    if (p.remote) return p.ownerId || "";
    if (p.mine) return uid;
    return SAMPLE_HOST_UID;
  };

  /* ---------- bookings (+ public "busy" dates) ---------- */
  const bsig = {};
  const sigOf = (b) =>
    `${b.status === "cancelled" ? "cancelled" : ""}|${b.checkin}|${b.checkout}`;

  async function pushBooking(b) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const hostId = hostIdOf(b.id, uid);
    const cancelled = b.status === "cancelled";
    await setDoc(doc(db, "bookings", b.ref), {
      ref: b.ref,
      listingId: b.id,
      guestId: uid,
      hostId,
      checkin: b.checkin,
      checkout: b.checkout,
      guests: Number(b.guests) || 1,
      name: b.name || "",
      status: cancelled ? "cancelled" : "confirmed",
      createdAt: b.paidAt || new Date().toISOString(),
      cancelledAt: b.cancelledAt || "",
    });
    if (cancelled) await deleteDoc(doc(db, "busy", b.ref)).catch(() => {});
    else
      await setDoc(doc(db, "busy", b.ref), {
        listingId: b.id,
        guestId: uid,
        hostId,
        from: b.checkin,
        to: b.checkout,
      });
    bsig[b.ref] = sigOf(b);
  }
  function flushBookings() {
    if (!auth.currentUser) return;
    read(K.bookings, []).forEach((b) => {
      if (bsig[b.ref] !== sigOf(b)) enqueue(() => pushBooking(b));
    });
  }

  const toLocalBooking = (d) => ({
    ref: d.ref,
    id: d.listingId,
    checkin: d.checkin,
    checkout: d.checkout,
    guests: d.guests,
    name: d.name,
    status: d.status === "cancelled" ? "cancelled" : undefined,
    paidAt: d.createdAt,
    cancelledAt: d.cancelledAt,
    guestId: d.guestId,
    remote: true,
  });

  // A host cancelling a reservation made by someone else
  SN.bookings.remotePatch = (ref, patch) => {
    setCache(
      C.bookings,
      read(C.bookings, []).map((b) => (b.ref === ref ? { ...b, ...patch } : b)),
    );
    if (patch.status === "cancelled") {
      enqueue(async () => {
        await updateDoc(doc(db, "bookings", ref), {
          status: "cancelled",
          cancelledAt: patch.cancelledAt || new Date().toISOString(),
        });
        await deleteDoc(doc(db, "busy", ref)).catch(() => {});
      });
    }
    return true;
  };

  /* ---------- blocked dates (host's own listings only) ---------- */
  const bkSig = {};
  function flushBlocked() {
    const uid = auth.currentUser?.uid;
    if (!uid || !SN.listings) return;
    Object.entries(read(K.blocked, {})).forEach(([id, dates]) => {
      if (!SN.listings.get(id)) return; // example stays aren't owned by an account
      const s = JSON.stringify(dates);
      if (bkSig[id] === s) return;
      enqueue(async () => {
        await setDoc(doc(db, "blocked", id), { ownerId: uid, dates });
        bkSig[id] = s;
      });
    });
  }

  /* ---------- reviews ---------- */
  const rknown = {};
  const toLocalReview = (r) => ({
    id: r.id,
    ref: r.ref,
    propertyId: r.propertyId,
    by: r.by,
    ratings: r.ratings,
    overall: r.overall,
    text: r.text,
    author: r.author,
    date: r.date,
    reply: r.reply || null,
  });

  async function pushReview(r) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await setDoc(doc(db, "reviews", r.id), {
      id: r.id,
      ref: r.ref,
      propertyId: r.propertyId,
      by: r.by,
      authorId: uid,
      hostId: r.by === "host" ? uid : hostIdOf(r.propertyId, uid),
      ratings: r.ratings,
      overall: r.overall,
      text: r.text,
      author: r.author || "",
      date: r.date,
      reply: r.reply || null,
    });
    const ids = idSet(C.revIds);
    ids.add(r.id);
    saveIds(C.revIds, ids);
    rknown[r.id] = r.reply?.date || "";
  }
  function flushReviews() {
    if (!auth.currentUser) return;
    const list = read(K.reviews, []);
    const sent = idSet(C.revIds);
    list.forEach((r) => {
      if (!sent.has(r.id)) enqueue(() => pushReview(r));
      else if ((r.reply?.date || "") !== (rknown[r.id] || "")) {
        enqueue(async () => {
          await updateDoc(doc(db, "reviews", r.id), { reply: r.reply || null });
          rknown[r.id] = r.reply?.date || "";
        });
      }
    });
    sent.forEach((id) => {
      if (list.some((r) => r.id === id)) return;
      sent.delete(id);
      saveIds(C.revIds, sent);
      enqueue(() => deleteDoc(doc(db, "reviews", id))); // the author removed it
    });
  }

  // A host replying to (or an admin removing) a review written by someone else
  SN.reviews.remoteReply = (id, text) => {
    const reply = { text, date: new Date().toISOString() };
    setCache(
      C.reviews,
      read(C.reviews, []).map((r) => (r.id === id ? { ...r, reply } : r)),
    );
    enqueue(() => updateDoc(doc(db, "reviews", id), { reply }));
    return true;
  };
  SN.reviews.remoteRemove = (id) => {
    setCache(
      C.reviews,
      read(C.reviews, []).filter((r) => r.id !== id),
    );
    enqueue(() => deleteDoc(doc(db, "reviews", id)));
    return true;
  };

  /* ---------- reports ---------- */
  const rpSig = {};
  async function pushReport(r) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await setDoc(doc(db, "reports", r.id), { ...r, reporterId: uid });
    const ids = idSet(C.repIds);
    ids.add(r.id);
    saveIds(C.repIds, ids);
    rpSig[r.id] = r.status;
  }
  function flushReports() {
    if (!auth.currentUser) return;
    const sent = idSet(C.repIds);
    read(K.reports, []).forEach((r) => {
      if (!sent.has(r.id)) enqueue(() => pushReport(r));
      else if (rpSig[r.id] !== undefined && rpSig[r.id] !== r.status) {
        enqueue(async () => {
          await updateDoc(doc(db, "reports", r.id), { status: r.status });
          rpSig[r.id] = r.status;
        });
      }
    });
  }
  SN.reports.remoteStatus = (id, status) => {
    setCache(
      C.reports,
      read(C.reports, []).map((r) => (r.id === id ? { ...r, status } : r)),
    );
    enqueue(() => updateDoc(doc(db, "reports", id), { status }));
    return true;
  };

  /* ---------- admin: change another host's listing status ---------- */
  SN.cloudShared = {
    async setListingStatus(id, status) {
      await updateDoc(doc(db, "listings", id), {
        status,
        updatedAt: new Date().toISOString(),
      });
      const list = read("sn-remote-listings", []);
      rawSet(
        "sn-remote-listings",
        status === "published" ? list : list.filter((l) => l.id !== id),
      );
      return true;
    },
  };

  /* ---------- write-through hooks ---------- */
  const HANDLERS = {
    [K.bookings]: flushBookings,
    [K.blocked]: flushBlocked,
    [K.reviews]: flushReviews,
    [K.reports]: flushReports,
  };
  const timers = {};
  const prevSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function setItem(k, v) {
    prevSet.call(this, k, v);
    if (this !== localStorage || applying || !ready || !HANDLERS[k]) return;
    clearTimeout(timers[k]);
    timers[k] = setTimeout(HANDLERS[k], 1000);
  };

  /* ---------- pull + reconcile ---------- */
  async function pullAll(user) {
    const uid = user?.uid || null;
    let changed = false;
    const step = async (name, fn) => {
      try {
        if (await fn()) changed = true;
      } catch (e) {
        console.error(`Sync (${name}) failed`, e);
      }
    };
    const today = new Date().toLocaleDateString("en-CA");

    // Public availability: read at the moment dates are checked, so no reload is needed
    await step("busy", async () => {
      const snap = await getDocs(
        query(collection(db, "busy"), where("to", ">=", today)),
      );
      const map = {};
      snap.docs.forEach((d) => {
        const r = d.data();
        (map[r.listingId] ||= []).push([r.from, r.to]);
      });
      setCache(C.busy, map);
    });
    await step("blocked", async () => {
      const snap = await getDocs(collection(db, "blocked"));
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = (d.data().dates || []).filter((x) => x >= today);
      });
      setCache(C.blocked, map);
    });
    await step("public reviews", async () => {
      const snap = await getDocs(
        query(collection(db, "reviews"), where("by", "==", "guest")),
      );
      return setCache(
        C.reviews,
        snap.docs
          .map((d) => toLocalReview(d.data()))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 200),
      );
    });

    if (uid) {
      let role = "guest";
      try {
        role = (await getDoc(doc(db, "users", uid))).data()?.role || "guest";
      } catch {
        /* keep guest */
      }

      await step("my bookings", async () => {
        const snap = await getDocs(
          query(collection(db, "bookings"), where("guestId", "==", uid)),
        );
        const remote = new Map(snap.docs.map((d) => [d.id, d.data()]));
        let touched = false;
        const next = read(K.bookings, []).map((b) => {
          const r = remote.get(b.ref);
          if (!r) return b;
          bsig[b.ref] =
            `${r.status === "cancelled" ? "cancelled" : ""}|${r.checkin}|${r.checkout}`;
          if (r.status === "cancelled" && b.status !== "cancelled") {
            touched = true;
            return {
              ...b,
              status: "cancelled",
              cancelledAt: r.cancelledAt || new Date().toISOString(),
            };
          } // the host cancelled it
          return b;
        });
        if (touched) rawSet(K.bookings, next);
        return touched;
      });

      await step("host bookings", async () => {
        if (role !== "host" && role !== "admin")
          return setCache(C.bookings, []);
        const snap =
          role === "admin"
            ? await getDocs(collection(db, "bookings"))
            : await getDocs(
                query(collection(db, "bookings"), where("hostId", "==", uid)),
              );
        return setCache(
          C.bookings,
          snap.docs
            .map((d) => toLocalBooking(d.data()))
            .filter((b) => b.guestId !== uid),
        );
      });

      await step("my reviews", async () => {
        const snap = await getDocs(
          query(collection(db, "reviews"), where("authorId", "==", uid)),
        );
        const remote = new Map(snap.docs.map((d) => [d.id, d.data()]));
        const sent = idSet(C.revIds);
        let local = read(K.reviews, []);
        let touched = false;
        remote.forEach((r, id) => {
          rknown[id] = r.reply?.date || "";
          const l = local.find((x) => x.id === id);
          if (!l) {
            local = [toLocalReview(r), ...local];
            touched = true;
          } // written on another device
          else if (r.reply && l.reply?.date !== r.reply.date) {
            l.reply = r.reply;
            touched = true;
          }
          sent.add(id);
        });
        local = local.filter((l) => {
          if (!remote.has(l.id) && sent.has(l.id)) {
            sent.delete(l.id);
            touched = true;
            return false;
          } // removed by an admin
          return true;
        });
        saveIds(C.revIds, sent);
        if (touched) rawSet(K.reviews, local);
        return touched;
      });

      await step("reports", async () => {
        const sent = idSet(C.repIds);
        read(K.reports, []).forEach((r) => {
          if (sent.has(r.id)) rpSig[r.id] = r.status;
        });
        if (role !== "admin") return setCache(C.reports, []);
        const snap = await getDocs(collection(db, "reports"));
        return setCache(
          C.reports,
          snap.docs.map((d) => {
            const r = d.data();
            return {
              id: r.id,
              type: r.type,
              targetId: r.targetId,
              label: r.label,
              reason: r.reason,
              details: r.details,
              status: r.status,
              date: r.date,
            };
          }),
        );
      });
    }

    ready = true;
    flushBookings();
    flushBlocked();
    flushReviews();
    flushReports();
    if (changed) reloadOnce();
  }

  onAuthStateChanged(auth, (user) => {
    pullAll(user).catch((e) => console.error("Shared sync failed", e));
  });
}
