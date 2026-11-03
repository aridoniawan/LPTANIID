/* ============================================================
   LP TANI - Core App: Theme, Router, Toast, Modal, Helpers
   ============================================================ */

const Theme = {
  init() {
    const saved = localStorage.getItem("lptani-theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
    this.updateIcon();
  },
  toggle() {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("lptani-theme", next);
    this.updateIcon();
  },
  updateIcon() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    btn.textContent = dark ? "☀️" : "🌙";
  },
};

const Toast = {
  show(msg, type = "info", duration = 4000) {
    const c = document.getElementById("toast-container");
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    const icons = { success: "✅", error: "❌", info: "ℹ️" };
    el.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${msg}</span>`;
    c.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(120%)";
      el.style.transition = "all 0.4s";
      setTimeout(() => el.remove(), 450);
    }, duration);
  },
};

const Modal = {
  open(html, opts = {}) {
    const overlay = document.getElementById("modal-overlay");
    const box = document.getElementById("modal-box");
    box.innerHTML = html;
    if (opts.maxWidth) box.style.maxWidth = opts.maxWidth;
    else box.style.maxWidth = "560px";
    overlay.classList.add("open");
    overlay.onclick = (e) => {
      if (e.target === overlay && !opts.sticky) this.close();
    };
  },
  close() {
    document.getElementById("modal-overlay").classList.remove("open");
  },
  confirm({ title, message, okText = "Ya, Lanjutkan", danger = false, onOk }) {
    this.open(
      `<h3>${title}</h3>
       <p class="muted">${message}</p>
       <div class="flex mt-2" style="justify-content:flex-end">
         <button class="btn btn-ghost" onclick="Modal.close()">Batal</button>
         <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="modal-confirm-ok">${okText}</button>
       </div>`
    );
    document.getElementById("modal-confirm-ok").onclick = () => {
      this.close();
      onOk();
    };
  },
  prompt({ title, fields = [], okText = "Simpan", onOk }) {
    let html = `<h3>${title}</h3>`;
    fields.forEach((f, i) => {
      const req = f.required !== false ? '<span class="req">*</span>' : "";
      if (f.type === "textarea") {
        html += `<div class="form-group"><label>${f.label} ${req}</label><textarea id="modal-f-${i}" ${f.required !== false ? "required" : ""} placeholder="${f.placeholder || ""}">${f.value || ""}</textarea></div>`;
      } else if (f.type === "select") {
        const opts = (f.options || []).map((o) => {
          const v = typeof o === "object" ? o.value : o;
          const l = typeof o === "object" ? o.label : o;
          const sel = String(v) === String(f.value) ? "selected" : "";
          return `<option value="${v}" ${sel}>${l}</option>`;
        }).join("");
        html += `<div class="form-group"><label>${f.label} ${req}</label><select id="modal-f-${i}" ${f.required !== false ? "required" : ""}>${opts}</select></div>`;
      } else if (f.type === "datetime-local" || f.type === "date" || f.type === "time") {
        html += `<div class="form-group"><label>${f.label} ${req}</label><input type="${f.type}" id="modal-f-${i}" ${f.required !== false ? "required" : ""} value="${f.value || ""}" /></div>`;
      } else {
        html += `<div class="form-group"><label>${f.label} ${req}</label><input type="${f.type || "text"}" id="modal-f-${i}" ${f.required !== false ? "required" : ""} placeholder="${f.placeholder || ""}" value="${f.value || ""}" /></div>`;
      }
    });
    html += `<div class="error-text" id="modal-form-error"></div>
             <div class="flex mt-2" style="justify-content:flex-end">
               <button class="btn btn-ghost" onclick="Modal.close()">Batal</button>
               <button class="btn btn-primary" id="modal-form-ok">${okText}</button>
             </div>`;
    this.open(html, { sticky: true });
    document.getElementById("modal-form-ok").onclick = () => {
      const errEl = document.getElementById("modal-form-error");
      const values = [];
      for (let i = 0; i < fields.length; i++) {
        const el = document.getElementById(`modal-f-${i}`);
        if (!el) continue;
        if (f.type !== "checkbox" && el.checkValidity && !el.checkValidity()) {
          el.reportValidity();
          return;
        }
        values.push(f.type === "checkbox" ? el.checked : el.value);
      }
      errEl.style.display = "none";
      const okBtn = document.getElementById("modal-form-ok");
      okBtn.disabled = true;
      const done = () => { this.close(); };
      const fail = (m) => {
        okBtn.disabled = false;
        errEl.textContent = m;
        errEl.style.display = "block";
      };
      onOk(values, done, fail);
    };
  },
};

function toggleNavMenu() {
  document.getElementById("nav-links").classList.toggle("open");
}

const Lightbox = {
  open(src, caption) {
    const overlay = document.getElementById("lightbox-overlay");
    overlay.innerHTML = `
      <img src="${src}" alt="${Helpers.esc(caption || "PNL Pengajar")}" />
      ${caption ? `<div class="lightbox-caption">${Helpers.esc(caption)}</div>` : ""}
      <div class="lightbox-hint">Klik di mana saja atau tekan ESC untuk menutup</div>`;
    overlay.classList.add("open");
    overlay.onclick = () => this.close();
  },
  close() {
    const overlay = document.getElementById("lightbox-overlay");
    if (overlay) overlay.classList.remove("open");
  },
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    Lightbox.close();
    Modal.close();
  }
});

// Klik gambar ber-atribut data-lightbox → zoom (delegasi, aman dari karakter khusus)
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-lightbox]");
  if (t && t.tagName === "IMG") {
    e.preventDefault();
    Lightbox.open(t.src, t.dataset.caption || "");
  }
});

const Router = {
  current: "landing",
  go(view, section) {
    // Alias: tombol CTA memakai 'register'/'login' → tampilkan view auth + tab yang sesuai
    const authTab = { register: "register", login: "login" }[view] || null;
    const views = ["landing", "auth", "user", "admin"];
    if (!views.includes(view)) view = authTab ? "auth" : "landing";
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.getElementById(`view-${view}`).classList.add("active");
    this.current = view;
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (authTab) Auth.switchTab(authTab);
    if (view === "landing" && typeof Landing !== "undefined") {
      setTimeout(() => Landing.refreshReveals(), 100);
    }
    if (section) {
      setTimeout(() => {
        const el = document.getElementById(section);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  },
};

const Helpers = {
  esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },
  fmtIDR(n) {
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
  },
  fmtDate(ts) {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return "-";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  },
  fmtDateTime(ts) {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return "-";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) +
      " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  },
  daysLeft(ts) {
    if (!ts) return null;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return Math.max(0, Math.ceil((d - Date.now()) / 86400000));
  },
  statusBadge(s) {
    const map = {
      pending: '<span class="badge badge-pending">⏳ Menunggu Verifikasi</span>',
      approved: '<span class="badge badge-approved">✅ Disetujui</span>',
      rejected: '<span class="badge badge-rejected">❌ Ditolak</span>',
      waiting_schedule: '<span class="badge badge-pending">⏳ Menunggu Jadwal Pengajar</span>',
      scheduled: '<span class="badge badge-pending">📅 Menunggu Approve Member</span>',
      reschedule_requested: '<span class="badge badge-pending">🔄 Reschedule Diminta</span>',
      rescheduled: '<span class="badge badge-pending">📅 Jadwal Baru — Menunggu Approve</span>',
      done: '<span class="badge badge-approved">🎉 Selesai</span>',
      cancelled: '<span class="badge badge-expired">🚫 Dibatalkan</span>',
    };
    return map[s] || `<span class="badge badge-expired">${Helpers.esc(s)}</span>`;
  },
  setLoading(show) {
    document.getElementById("loading-overlay").classList.toggle("hidden", !show);
  },
};

/* ============ Global init ============ */
document.addEventListener("DOMContentLoaded", () => {
  Theme.init();

  // Cursor glow follow
  const glow = document.getElementById("cursor-glow");
  window.addEventListener("mousemove", (e) => {
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
  });

  // Reveal on scroll
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("visible");
          observer.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
});
