/* ============================================================
   LP TANI - Landing Page Renderer
   ============================================================ */

const Landing = {
  content: null,
  settings: null,

  async render() {
    let content = {}, settings = {}, pnl = [], terms = [];
    try {
      [content, settings, pnl, terms] = await Promise.all([
        getContent(),
        getSettings(),
        getPnlMedia(),
        getTerms(),
      ]);
    } catch (e) {
      console.error("Landing: gagal ambil data Firestore, pakai default:", e.message);
    }
    // Pertahankan konten yang sudah dimuat bila fetch gagal/empty, agar tidak flicker
    this.content = (content && Object.keys(content).length) ? content : (this.content || {});
    this.settings = (settings && Object.keys(settings).length) ? settings : (this.settings || {});
    if (!this.settings.premiumPrice) this.settings.premiumPrice = 250000;
    if (!this.settings.vipPrice) this.settings.vipPrice = 750000;
    if (this.settings.openRegistration === undefined) this.settings.openRegistration = true;

    const c = this.content;

    const setHtml = (id, val) => { if (val) { const el = document.getElementById(id); if (el) el.innerHTML = val; } };
    const setText = (id, val) => { if (val) { const el = document.getElementById(id); if (el) el.textContent = val; } };

    // Logo (fleksibel: bisa pakai gambar atau teks saja)
    const img = document.getElementById("nav-logo-img");
    if (img) {
      if (c.logoUrl) {
        img.src = c.logoUrl;
        img.style.display = "";
      } else {
        img.style.display = "none";
      }
    }

    // Hero
    if (c.heroTitle) document.getElementById("hero-title").innerHTML = c.heroTitle;
    if (c.heroSub) document.getElementById("hero-sub").textContent = c.heroSub;
    setText("hero-badge", c.heroBadge);
    setText("hero-btn-register", c.heroBtn1);
    setText("hero-btn-packages", c.heroBtn2);
    setText("stat-mentoring", c.heroStat2Value);
    setText("stat-mentoring-label", c.heroStat2Label);
    setText("stat-support", c.heroStat3Value);
    setText("stat-support-label", c.heroStat3Label);

    // Tentang
    setHtml("tentang-title", c.tentangTitle);
    if (c.tentangSub) document.getElementById("tentang-sub").textContent = c.tentangSub;
    if (c.kenapaSub) document.getElementById("kenapa-sub").textContent = c.kenapaSub;

    // Media VS + video
    if (c.vsImageUrl) {
      document.getElementById("media-vs").innerHTML = `<img src="${c.vsImageUrl}" alt="Trading jual beli manual" />`;
    }
    if (c.videoUrl) {
      document.getElementById("media-video").innerHTML = `<video autoplay muted loop playsinline controls preload="metadata"><source src="${c.videoUrl}" type="video/mp4" />Browser kamu tidak mendukung video.</video>`;
    } else {
      document.getElementById("media-video").innerHTML = `<img src="assets/lp-hero.png" alt="Video akan ditambahkan" />`;
    }
    if (c.mediaCaption) document.getElementById("media-caption").textContent = c.mediaCaption;

    // Kartu perbandingan Trading VS LP
    setText("vs-bad-title", c.vsBadTitle);
    setText("vs-bad-text", c.vsBadText);
    setText("vs-badge", c.vsBadge);
    setText("vs-good-title", c.vsGoodTitle);
    setText("vs-good-text", c.vsGoodText);

    // Kenapa Harus Belajar
    setHtml("kenapa-title", c.kenapaTitle);
    for (let i = 1; i <= 4; i++) {
      setText(`kenapa-${i}-title`, c[`kenapa${i}Title`]);
      setText(`kenapa-${i}-text`, c[`kenapa${i}Text`]);
    }

    // Pengajar
    setHtml("pengajar-title", c.pengajarTitle);
    setHtml("pengajar-sub", c.pengajarSub);
    setText("pengajar-name", c.pengajarName);
    setHtml("pengajar-bio", c.pengajarBio);
    setHtml("pengajar-pnl-heading", c.pengajarPnlHeading);

    // PNL gallery (hasil pengajar: tiap item ada caption, klik gambar untuk zoom)
    const gal = document.getElementById("pnl-gallery");
    if (gal) {
      gal.className = "pnl-gallery mt-2";
      if (pnl.length) {
        gal.innerHTML = pnl
          .map(
            (m) => `
          <div class="pnl-item reveal">
            ${m.type === "video"
              ? `<video controls preload="none"><source src="${m.url}" type="video/mp4" /></video>`
              : `<img class="pnl-thumb" src="${m.url}" alt="${Helpers.esc(m.title || "Hasil PNL Asli Pengajar")}" loading="lazy" data-lightbox data-caption="${Helpers.esc(m.title || "")}" />`}
            <div class="pnl-caption">${Helpers.esc(m.title || "Hasil PNL Asli Pengajar")}</div>
          </div>`
          )
          .join("");
        this.observeReveals(gal);
      } else {
        gal.innerHTML = "";
      }
    }

    // Materi
    setHtml("materi-title", c.materiTitle);
    setText("materi-sub", c.materiSub);
    for (let i = 1; i <= 6; i++) {
      setText(`materi-${i}-title`, c[`materi${i}Title`]);
      setText(`materi-${i}-text`, c[`materi${i}Text`]);
    }

    // Join section
    setHtml("join-title", c.joinTitle);
    if (c.joinSub) document.getElementById("join-sub").textContent = c.joinSub;

    // Informasi Penting (legal)
    setHtml("legal-title", c.legalTitle);
    ["syarat", "refund", "risiko"].forEach((k) => {
      const key = "legal" + k.charAt(0).toUpperCase() + k.slice(1);
      setText(`legal-${k}-title`, c[`${key}Title`]);
      setText(`legal-${k}-desc`, c[`${key}Desc`]);
    });

    // Terms
    const termsList = document.getElementById("terms-list");
    if (termsList && terms.length) {
      const heading = c.legalTermsHeading || "📜 <span class='gradient-text'>Syarat & Ketentuan Member</span>";
      termsList.innerHTML =
        `<h3 class="center mb-2 reveal">${heading}</h3>` +
        terms
          .map(
            (t) => `
          <div class="card reveal mb-1">
            <h3>${t.order !== undefined && t.order !== null ? t.order + 1 : ""}. ${Helpers.esc(t.title)}</h3>
            <p class="muted mt-1" style="white-space:pre-line">${Helpers.esc(t.content)}</p>
          </div>`
          )
          .join("");
      this.observeReveals(termsList);
    }

    // Kontak
    setHtml("kontak-title", c.kontakTitle);
    if (c.kontakSub) document.getElementById("kontak-sub").textContent = c.kontakSub;
    const kontakCfg = [
      { aId: "kontak-discord", label: c.kontakDiscordLabel, href: c.kontakDiscordUrl },
      { aId: "kontak-email", label: c.kontakEmailLabel, href: c.kontakEmailAddress ? "mailto:" + c.kontakEmailAddress : "" },
      { aId: "kontak-telegram", label: c.kontakTelegramLabel, href: c.kontakTelegramUrl },
    ];
    kontakCfg.forEach(({ aId, label, href }) => {
      const a = document.getElementById(aId);
      if (!a) return;
      if (label) a.textContent = label;
      if (href) a.href = href;
      a.style.display = label || href ? "" : "none";
    });

    // Footer
    setText("footer-tagline", c.footerTagline);
    setText("footer-bottom", c.footerBottom);
    const fk1 = document.getElementById("footer-kontak-1");
    if (fk1) {
      if (c.kontakDiscordLabel) fk1.textContent = c.kontakDiscordLabel;
      fk1.style.display = c.kontakDiscordLabel ? "" : "none";
    }
    const fk2 = document.getElementById("footer-kontak-2");
    if (fk2) {
      if (c.kontakEmailLabel) fk2.textContent = c.kontakEmailLabel;
      fk2.style.display = c.kontakEmailLabel ? "" : "none";
    }

    this.renderPricing();
    this.renderJoinStatus();
  },

  // Tandai elemen .reveal yang sudah masuk viewport sebagai visible; sisanya di-observe.
  // Bila viewport tidak tersedia (window tersembunyi), langsung tampilkan agar konten tidak pernah hilang.
  observeReveals(container) {
    if (!container) return;
    container.querySelectorAll(".reveal").forEach((el) => {
      if (el.classList.contains("visible")) return;
      const r = el.getBoundingClientRect();
      if (!window.innerHeight || (r.top < window.innerHeight && r.bottom > 0)) {
        el.classList.add("visible");
      } else if (revealObserver) {
        revealObserver.observe(el);
      }
    });
  },

  refreshReveals() {
    this.observeReveals(document.getElementById("view-landing"));
  },

  renderPricing() {
    const wrap = document.getElementById("pricing-cards");
    const s = this.settings;
    if (!wrap) return;
    const premiumPrice = Helpers.fmtIDR(s.premiumPrice || 250000);
    const vipPrice = Helpers.fmtIDR(s.vipPrice || 750000);
    const open = s.openRegistration !== false;
    const premiumId = `price-premium-${Date.now()}`;
    const vipId = `price-vip-${Date.now()}`;
    const premiumBenefits = this._benefitList("premium");
    const vipBenefits = this._benefitList("vip");

    wrap.innerHTML = `
      <div class="card pricing-card reveal" id="${premiumId}" onclick="Landing.selectTier('premium','${premiumId}','${vipId}')">
        <div class="price-tier">🌱 PREMIUM</div>
        <div class="price-amount">${premiumPrice}</div>
        <p class="muted small">sekali bayar / ${this._durationText("premium")}</p>
        <ul class="price-features">
          ${premiumBenefits.map((b) => `<li>${Helpers.esc(b)}</li>`).join("")}
        </ul>
      </div>
      <div class="card pricing-card vip reveal reveal-delay-1" id="${vipId}" onclick="Landing.selectTier('vip','${vipId}','${premiumId}')">
        <div class="price-tier">👑 VIP</div>
        <div class="price-amount">${vipPrice}</div>
        <p class="muted small">sekali bayar / ${this._durationText("vip")}</p>
        <ul class="price-features">
          ${vipBenefits.map((b) => `<li>${Helpers.esc(b)}</li>`).join("")}
        </ul>
      </div>`;
    this.observeReveals(wrap);

    const cta = document.getElementById("join-cta-area");
    if (cta) {
      if (open) {
        cta.innerHTML = `<button class="btn btn-primary" style="font-size:1.1rem;padding:1rem 2.4rem" onclick="Router.go('register')">🚀 Registrasi & Join Sekarang</button>`;
      } else {
        cta.innerHTML = `<div class="info-box warn" style="max-width:480px;margin:0 auto">⏸️ Pendaftaran member baru sedang <b>ditutup sementara</b>. Silakan kembali lagi nanti.</div>`;
      }
    }
    this.renderJoinStatus();
  },

  _durationText(tier) {
    const d = Number(
      tier === "vip"
        ? this.settings.vipDurationDays || 365
        : this.settings.premiumDurationDays || 180
    );
    return "akses Discord " + d + " hari";
  },

  _benefitList(tier) {
    const key = tier === "vip" ? "benefitsVIP" : "benefitsPremium";
    const list = this.content && Array.isArray(this.content[key]) && this.content[key].length
      ? this.content[key]
      : null;
    if (list) return list;
    return tier === "vip"
      ? ["Semua benefit Premium", "5x mentoring 1-on-1 dengan pengajar", "Prioritas tanya jawab", "Review portfolio & strategi pribadi"]
      : ["Akses server Discord LP Tani", "Semua materi belajar on-chain", "Diskusi & tanya jawab komunitas", "Update strategi dari pengajar"];
  },

  selectTier(tier, selId, otherId) {
    document.getElementById(selId).classList.add("selected");
    document.getElementById(otherId).classList.remove("selected");
    Landing.selectedTier = tier;
    const cta = document.getElementById("join-cta-area");
    if (cta && this.settings && this.settings.openRegistration !== false) {
      cta.innerHTML = `<button class="btn btn-primary" style="font-size:1.1rem;padding:1rem 2.4rem" onclick="Router.go('register')">🚀 Registrasi & Join Sebagai ${tier === "vip" ? "VIP" : "Premium"}</button>`;
    }
  },

  renderJoinStatus() {
    const area = document.getElementById("join-status-area");
    if (!area) return;
    const s = this.settings;
    if (s && s.openRegistration === false) {
      area.innerHTML = `<div class="info-box warn" style="max-width:480px;margin:0 auto 1.4rem">⏸️ Pendaftaran member baru sedang <b>ditutup sementara</b>.</div>`;
    } else {
      area.innerHTML = "";
    }
  },
};

let revealObserver;
document.addEventListener("DOMContentLoaded", () => {
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("visible");
          revealObserver.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12 }
  );
});
