(() => {
  const SN = (window.StayNest = window.StayNest || {});
  const K = SN.keys;

  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(K.listings));
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const write = (v) => {
    try {
      localStorage.setItem(K.listings, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  }; // false = storage full
  const readState = () => {
    try {
      return JSON.parse(localStorage.getItem(K.state)) || {};
    } catch {
      return {};
    }
  };
  const writeState = (v) => {
    try {
      localStorage.setItem(K.state, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  };
  const isSample = (id) => SN.samples.some((p) => p.id === id);

  SN.listings = {
    mine: read,
    get: (id) => read().find((l) => l.id === id),
    save(listing) {
      const list = read();
      const next = { ...listing, updatedAt: new Date().toISOString() };
      const i = list.findIndex((l) => l.id === listing.id);
      if (i >= 0) list[i] = next;
      else list.unshift(next);
      return write(list);
    },
    remove: (id) => write(read().filter((l) => l.id !== id)),
    isSample,
    statusOf(id) {
      if (isSample(id)) return readState()[id] || "published";
      return SN.listings.get(id)?.status || "draft";
    },
    setStatus(id, status) {
      if (isSample(id)) {
        const s = readState();
        if (status === "published") delete s[id];
        else s[id] = status;
        return writeState(s);
      }
      const l = SN.listings.get(id);
      return l ? SN.listings.save({ ...l, status }) : false;
    },
    newId(seed) {
      const slug =
        String(seed)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 30) || "listing";
      return `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    },
  };
})();
