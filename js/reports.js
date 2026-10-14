// js/reports.js — load on any page that has a [data-report] button, and on admin.html
(() => {
  "use strict";
  const SN = (window.StayNest = window.StayNest || {});
  const KEY = "sn-reports";

  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const write = (list) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  };

  const REASONS = {
    listing: [
      "Inaccurate or misleading",
      "Offensive or inappropriate",
      "Spam or scam",
      "Other",
    ],
    review: [
      "Offensive or inappropriate",
      "Not a real stay",
      "Contains personal information",
      "Other",
    ],
  };

  SN.reports = {
    REASONS,
    read,
    // Own reports plus (for admins) reports from other accounts
    all() {
      const own = read();
      const ids = new Set(own.map((r) => r.id));
      let remote = [];
      try {
        remote = JSON.parse(localStorage.getItem("sn-remote-reports")) || [];
      } catch {
        /* ignore */
      }
      return [...own, ...remote.filter((r) => !ids.has(r.id))];
    },
    add({ type, targetId, label, reason, details }) {
      const r = {
        id: `rp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        type,
        targetId,
        label: label || "",
        reason,
        details: details || "",
        status: "open",
        date: new Date().toISOString(),
      };
      return write([r, ...read()]);
    },
    setStatus(id, status) {
      if (read().some((r) => r.id === id))
        return write(read().map((r) => (r.id === id ? { ...r, status } : r)));
      return SN.reports.remoteStatus
        ? SN.reports.remoteStatus(id, status)
        : false;
    },
    openCount: () => SN.reports.all().filter((r) => r.status === "open").length,
  };

  /* Dialog (built once, only when a report button exists) */
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  let dialog = null;
  let target = null;

  function build() {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <dialog class="modal" id="report-dialog" aria-labelledby="report-title">
        <form data-report-form novalidate>
          <h2 class="modal__title" id="report-title">Report</h2>
          <p class="modal__text" data-report-sub></p>
          <div class="field">
            <label class="field__label" for="report-reason">Reason</label>
            <select class="select" id="report-reason" aria-describedby="report-err"></select>
          </div>
          <div class="field">
            <label class="field__label" for="report-details">Details (optional)</label>
            <textarea class="input" id="report-details" rows="3" maxlength="500"></textarea>
          </div>
          <p class="field__error" id="report-err" role="alert"></p>
          <div class="modal__actions">
            <button class="btn btn--outline btn--sm" type="button" data-report-cancel>Cancel</button>
            <button class="btn btn--primary btn--sm" type="submit">Send report</button>
          </div>
        </form>
      </dialog>`,
    );
    dialog = document.getElementById("report-dialog");
    const form = dialog.querySelector("form");
    const err = dialog.querySelector("#report-err");

    dialog
      .querySelector("[data-report-cancel]")
      .addEventListener("click", () => dialog.close());
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const reason = dialog.querySelector("#report-reason").value;
      if (!reason) {
        err.textContent = "Choose a reason.";
        return;
      }
      const ok = SN.reports.add({
        ...target,
        reason,
        details: dialog.querySelector("#report-details").value.trim(),
      });
      if (!ok) {
        err.textContent = "We couldn't save your report. Try again.";
        return;
      }
      dialog.close();
      const live = document.querySelector("[data-live]");
      if (live) live.textContent = "Thanks, your report was sent.";
      else alert("Thanks, your report was sent.");
    });
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-report]");
    if (!btn) return;
    if (!dialog) build();
    target = {
      type: btn.dataset.type,
      targetId: btn.dataset.id,
      label: btn.dataset.label || "",
    };
    dialog.querySelector("#report-title").textContent =
      target.type === "review" ? "Report this review" : "Report this listing";
    dialog.querySelector("[data-report-sub]").textContent =
      "Tell us what's wrong. Our team reviews every report.";
    dialog.querySelector("#report-reason").innerHTML =
      `<option value="">Select a reason</option>${REASONS[target.type].map((r) => `<option>${esc(r)}</option>`).join("")}`;
    dialog.querySelector("#report-details").value = "";
    dialog.querySelector("#report-err").textContent = "";
    dialog.showModal();
  });
})();
