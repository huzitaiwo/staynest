(() => {
  const SN = (window.StayNest = window.StayNest || {});

  SN.plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  SN.fmt = (n) => `€${n.toLocaleString("en-GB")}`;
  SN.nights = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

  SN.validateStay = (a, b, id) => {
    const today = new Date().toLocaleDateString("en-CA");
    const n = SN.nights(a, b);
    if (a < today) return "Check-in can't be in the past.";
    if (n < 1) return "Check-out must be after check-in.";
    if (n > 30) return "Stays are limited to 30 nights.";
    if (id && SN.availability?.conflict(id, a, b))
      return "Those dates aren't available. Try different dates.";
    return "";
  };

  // One place for the price maths, so the property page and checkout always agree.
  SN.quote = (p, n) => {
    const f = SN.fees;
    const subtotal = p.price * n;
    const cleaning = Math.round((p.price * f.cleaningRate) / 5) * 5;
    const service = Math.round(subtotal * f.serviceRate);
    const tax = Math.round((subtotal + cleaning + service) * f.taxRate);
    return {
      nights: n,
      subtotal,
      cleaning,
      service,
      tax,
      total: subtotal + cleaning + service + tax,
    };
  };
})();
