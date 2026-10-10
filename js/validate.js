(() => {
  const SN = (window.StayNest = window.StayNest || {});

  SN.rules = {
    name: (v) => (v.trim().length >= 2 ? "" : "Enter your full name."),
    email: (v) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
        ? ""
        : "Enter a valid email address.",
    phone: (v) =>
      !v.trim() || /^[+\d][\d\s()-]{6,18}$/.test(v.trim())
        ? ""
        : "Enter a valid phone number, or leave this blank.",
    password: (v) =>
      v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v)
        ? ""
        : "Use at least 8 characters, with a letter and a number.",
    required: (v) => (v ? "" : "This field is required."),
    terms: (v) => (v ? "" : "Please accept to continue."),
  };

  // Validates one field marked with data-rule and shows its message in #<id>-err.
  SN.checkField = (el, rules = SN.rules) => {
    const value = el.type === "checkbox" ? el.checked : el.value;
    const msg = rules[el.dataset.rule](value);
    el.setAttribute("aria-invalid", String(Boolean(msg)));
    const err = document.getElementById(`${el.id}-err`);
    if (err) err.textContent = msg;
    return !msg;
  };

  // Validates every data-rule field inside root and focuses the first problem.
  SN.validateFields = (root, rules = SN.rules) => {
    const bad = [...root.querySelectorAll("[data-rule]")].filter(
      (el) => !SN.checkField(el, rules),
    );
    bad[0]?.focus();
    return bad.length === 0;
  };
})();
