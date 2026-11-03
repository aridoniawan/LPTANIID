/* ============================================================
   LP TANI - User Dashboard
   ============================================================ */

const UserDash = {
  user: null,
  settings: null,
  selectedTier: "premium",
  selectedMethod: null,
  appliedPromo: null,

  async renderAll() {
    if (!requireAuth()) return;
    const [user, settings, pms, content] = await Promise.all([
      getCurrentUserData(),
      getSettings(),
      getPaymentMethods(true),
      getContent(),
    ]);
    if (!user) {
      Toast.show("Data user tidak ditemukan. Coba login ulang.", "error");
      return;
    }
    this.user = user;
    this.settings = settings || {};
    this.paymentMethods = pms;
    this.content = content || {};

    document.getElementById("user-greeting").textContent = `Halo, ${user.name || "Member"} 👋`;

    // Menu visibility
    const isPremium = user.membership === "premium";
    const isVip = user.membership === "vip";
    document.querySelector('[data-user-panel="mentoring"]').style.display = isVip ? "" : "none";
    document.querySelector('[data-user-panel="upgrade"]').style.display = isPremium ? "" : "none";

    this.renderOverview();
    this.renderJoin();
    this.renderPayment();
    this.renderMentoring();
    this.renderUpgrade();
  },

  showPanel(panel) {
    document.querySelectorAll("#user-menu button[data-user-panel]").forEach((b) => {
      b.classList.toggle("active", b.dataset.userPanel === panel);
    });
    document.querySelectorAll(".dash-panel[id^='user-panel-']").forEach((p) => p.classList.remove("active"));
    document.getElementById(`user-panel-${panel}`).classList.add("active");
  },

  /* ============ OVERVIEW ============ */
  renderOverview() {
    const u = this.user;
    const cards = document.getElementById("user-overview-cards");
    const isMember = u.membership && u.membership !== "none";
    const expiry = u.membershipExpiry;
    const daysLeft = Helpers.daysLeft(expiry);
    const expired = expiry && daysLeft !== null && daysLeft <= 0;

    const memberBadge = isMember
      ? u.membership === "vip"
        ? '<span class="badge badge-vip">👑 VIP</span>'
        : '<span class="badge badge-premium">🌱 PREMIUM</span>'
      : '<span class="badge badge-expired">Belum Member</span>';

    cards.innerHTML = `
      <div class="card">
        <div class="flex space-between"><h3>Status Member</h3>${memberBadge}</div>
        <p class="muted small mt-1">ID Discord: <b>${Helpers.esc(u.discordId || "-")}</b></p>
      </div>
      <div class="card">
        <h3>⏳ Durasi Akses Discord</h3>
        ${isMember && !expired
          ? `<p class="mt-1">Berakhir: <b>${Helpers.fmtDate(expiry)}</b></p>
             <p class="small muted">Sisa <b style="color:var(--neon-dark)">${daysLeft} hari</b> akses</p>
             <div class="quota-bar"><div class="quota-fill" style="width:100%"></div></div>`
          : expired
            ? `<p class="mt-1">Masa member kamu sudah <b style="color:var(--danger)">habis</b>.</p><p class="small muted">Silakan perpanjang dengan join member lagi.</p>`
            : `<p class="mt-1 muted">Kamu belum resmi jadi member.</p>`}
      </div>
      <div class="card">
        <h3>🎓 Jatah Mentoring</h3>
        <p class="mt-1">Terpakai: <b>${u.mentoringUsed || 0}</b> / <b>${u.mentoringQuota || 0}</b></p>
        <div class="quota-bar"><div class="quota-fill" style="width:${u.mentoringQuota ? ((u.mentoringUsed || 0) / u.mentoringQuota) * 100 : 0}%"></div></div>
        <p class="small muted mt-1">${u.membership === "vip" ? "Khusus member VIP: 5x mentoring 1-on-1 dengan pengajar." : "Upgrade ke VIP untuk mendapatkan 5x mentoring 1-on-1."}</p>
      </div>`;

    // Discord card
    const dc = document.getElementById("user-discord-card");
    if (isMember && !expired && this.settings.discordInviteLink) {
      dc.innerHTML = `
        <h3>💬 Join Discord</h3>
        <p class="muted mt-1">Pembayaran kamu sudah disetujui admin. Klik tombol di bawah untuk masuk ke server Discord LP Tani.</p>
        <div class="mt-2">
          <a class="btn btn-primary" href="${Helpers.esc(this.settings.discordInviteLink)}" target="_blank" rel="noopener">🚀 Join ke Discord</a>
        </div>`;
      dc.style.display = "block";
    } else if (isMember && expired) {
      dc.innerHTML = `<div class="info-box danger">⚠️ Masa member kamu sudah habis. Silakan perpanjang untuk mengakses Discord kembali.</div>`;
      dc.style.display = "block";
    } else {
      dc.innerHTML = `<div class="info-box">🔒 Tombol <b>Join to Discord</b> akan muncul setelah pembayaran kamu <b>disetujui admin</b>.</div>`;
      dc.style.display = "block";
    }
  },

  /* ============ JOIN MEMBER ============ */
  async renderJoin() {
    const u = this.user;
    const area = document.getElementById("user-join-status");
    const form = document.getElementById("user-join-form");
    const isMember = u.membership && u.membership !== "none";
    const daysLeft = Helpers.daysLeft(u.membershipExpiry);
    const expired = u.membershipExpiry && daysLeft !== null && daysLeft <= 0;
    const open = this.settings.openRegistration !== false;

    if (!open) {
      area.innerHTML = `<div class="info-box warn">⏸️ Pendaftaran member sedang ditutup sementara oleh admin.</div>`;
      form.classList.add("hidden");
      this.renderJoinTransactions();
      return;
    }
    if (isMember && !expired) {
      area.innerHTML = `<div class="info-box">✅ Kamu sudah terdaftar sebagai member <b>${u.membership.toUpperCase()}</b>.${u.membership === "premium" ? " Mau lebih maksimal? Upgrade ke <b>VIP</b> di menu Upgrade." : ""}</div>`;
      form.classList.add("hidden");
      this.renderJoinTransactions();
      return;
    }

    let txs = [];
    try {
      txs = await getUserTransactions(u.uid);
    } catch (e) {
      txs = [];
    }
    const pendingJoins = txs.filter((t) => t.type === "join" && t.status === "pending");
    const pendingNote = pendingJoins.length
      ? `<div class="info-box warn mb-1">⏳ Request join menunggu verifikasi: ${pendingJoins.map((t) => `<b>${(t.tier || "").toUpperCase()}</b> (ID ${t.id.slice(0, 8).toUpperCase()})`).join(", ")}. Upload bukti di menu <b>Konfirmasi Pembayaran</b>.</div>`
      : "";
    area.innerHTML = pendingNote + (expired
      ? `<div class="info-box warn">Masa member kamu sudah habis. Silakan join member lagi di bawah.</div>`
      : `<div class="info-box">Pilih paket member dan metode pembayaran, lalu konfirmasi pembayaran. Setelah admin approve, kamu bisa join Discord.</div>`);
    form.classList.remove("hidden");
    this.renderBenefits();
    this.renderTierCards();
    this.renderPaymentMethods();
    this.renderInvoice();
    this.renderJoinTransactions(txs);
  },

  renderBenefits() {
    const el = document.getElementById("user-join-benefits");
    if (!el) return;
    const premium = (this.content && Array.isArray(this.content.benefitsPremium) && this.content.benefitsPremium) || [];
    const vip = (this.content && Array.isArray(this.content.benefitsVIP) && this.content.benefitsVIP) || [];
    if (!premium.length && !vip.length) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = `
      <div class="card mb-2">
        <h3>🎁 Apa yang Kamu Dapatkan?</h3>
        <div class="grid-2 mt-1">
          <div>
            <p class="price-tier" style="font-size:0.9rem">🌱 PREMIUM</p>
            <ul class="price-features">${premium.map((b) => `<li>${Helpers.esc(b)}</li>`).join("")}</ul>
          </div>
          <div>
            <p class="price-tier" style="font-size:0.9rem">👑 VIP</p>
            <ul class="price-features">${vip.map((b) => `<li>${Helpers.esc(b)}</li>`).join("")}</ul>
          </div>
        </div>
      </div>`;
  },

  renderTierCards() {
    const wrap = document.getElementById("user-tier-cards");
    const s = this.settings;
    const pid = `ut-premium`;
    const vid = `ut-vip`;
    const premium = this._benefitList("premium");
    const vip = this._benefitList("vip");
    wrap.innerHTML = `
      <div class="card pricing-card ${this.selectedTier === "premium" ? "selected" : ""}" id="${pid}" onclick="UserDash.pickTier('premium')">
        <div class="price-tier">🌱 PREMIUM</div>
        <div class="price-amount">${Helpers.fmtIDR(s.premiumPrice)}</div>
        <ul class="price-features">${premium.map((b) => `<li>${Helpers.esc(b)}</li>`).join("")}</ul>
      </div>
      <div class="card pricing-card vip ${this.selectedTier === "vip" ? "selected" : ""}" id="${vid}" onclick="UserDash.pickTier('vip')">
        <div class="price-tier">👑 VIP</div>
        <div class="price-amount">${Helpers.fmtIDR(s.vipPrice)}</div>
        <ul class="price-features">${vip.map((b) => `<li>${Helpers.esc(b)}</li>`).join("")}</ul>
      </div>`;
  },

  _benefitList(tier) {
    const key = tier === "vip" ? "benefitsVIP" : "benefitsPremium";
    const list = this.content && Array.isArray(this.content[key]) && this.content[key].length ? this.content[key] : null;
    if (list) return list;
    return tier === "vip"
      ? ["Semua benefit Premium", "5x mentoring 1-on-1", "Prioritas tanya jawab"]
      : ["Akses Discord LP Tani", "Semua materi belajar", "Diskusi komunitas"];
  },

  pickTier(tier) {
    this.selectedTier = tier;
    this.renderTierCards();
    this.renderInvoice();
  },

  renderPaymentMethods() {
    const wrap = document.getElementById("user-payment-methods");
    if (!this.paymentMethods.length) {
      wrap.innerHTML = `<div class="info-box warn">Belum ada metode pembayaran. Hubungi admin.</div>`;
      return;
    }
    this.paymentMethods.forEach((p) => {
      if (!this.selectedMethod) this.selectedMethod = p.id;
    });
    wrap.innerHTML = this.paymentMethods
      .map(
        (p) => `
      <div class="card pricing-card ${this.selectedMethod === p.id ? "selected" : ""}" style="text-align:left" onclick="UserDash.pickMethod('${p.id}')">
        <div class="price-tier" style="font-size:1rem">🏦 ${Helpers.esc(p.bankName)}</div>
        <p class="muted small">a.n. <b>${Helpers.esc(p.accountName)}</b></p>
        <p class="small" style="letter-spacing:0.05em;font-weight:700">${Helpers.esc(p.accountNumber)}</p>
      </div>`
      )
      .join("");
  },

  pickMethod(id) {
    this.selectedMethod = id;
    this.renderPaymentMethods();
  },

  /* ============ PROMO / VOUCHER ============ */
  _discountInfo() {
    const base = this.selectedTier === "vip" ? Number(this.settings.vipPrice || 0) : Number(this.settings.premiumPrice || 0);
    const p = this.appliedPromo;
    let discount = 0;
    if (p) {
      const v = Number(p.value || 0);
      discount = p.type === "fixed" ? v : Math.round(base * (v / 100));
      if (discount > base) discount = base;
    }
    return { base, discount, total: base - discount, promo: p };
  },

  renderInvoice() {
    const el = document.getElementById("join-invoice");
    if (!el) return;
    const { base, discount, total, promo } = this._discountInfo();
    const tierLabel = this.selectedTier === "vip" ? "👑 VIP" : "🌱 Premium";
    el.innerHTML = `
      <div class="card invoice-box mt-1">
        <h3 class="mb-1">🧾 Invoice Pembayaran</h3>
        <div class="invoice-row"><span>Paket: <b>${tierLabel}</b></span><span>${Helpers.fmtIDR(base)}</span></div>
        ${promo ? `
          <div class="invoice-row">
            <span>🎟️ Diskon <b>${Helpers.esc(promo.code)}</b> (${promo.type === "fixed" ? Helpers.fmtIDR(promo.value) : Number(promo.value) + "%"})</span>
            <span style="color:var(--neon-dark)">−${Helpers.fmtIDR(discount)}</span>
          </div>
          <div class="invoice-row invoice-total"><span>Total yang Harus Dibayar</span><span>${Helpers.fmtIDR(total)}</span></div>
          <button class="btn btn-ghost btn-sm" type="button" onclick="UserDash.removePromo()">✖ Hapus Promo</button>`
        : `
          <div class="invoice-row invoice-total"><span>Total yang Harus Dibayar</span><span>${Helpers.fmtIDR(total)}</span></div>
          <p class="small muted">Punya kode promo? Isi di kolom atas untuk mendapat potongan harga.</p>`}
      </div>`;
  },

  _rekeningBox(method) {
    if (!method) return "";
    return `
   <div class="card mt-2" style="border-left:4px solid var(--neon-dark)">
     <h4 class="mb-1">🏦 Transfer ke Rekening</h4>
     <div class="invoice-row"><span>Bank</span><b>${Helpers.esc(method.bankName)}</b></div>
     <div class="invoice-row"><span>Atas Nama</span><b>${Helpers.esc(method.accountName)}</b></div>
     <div class="invoice-row"><span>No. Rekening</span><b style="letter-spacing:0.05em">${Helpers.esc(method.accountNumber)}</b></div>
     <button class="btn btn-outline btn-sm mt-2" type="button" id="copy-rek-btn">📋 Salin No. Rekening</button>
   </div>`;
  },

  _bindCopyRek(accNumber) {
    const cb = document.getElementById("copy-rek-btn");
    if (!cb) return;
    cb.onclick = () => this.copyText(accNumber);
  },

  copyText(text) {
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    };
    const success = () => Toast.show("Nomor rekening berhasil disalin! 📋", "success");
    const failToast = () => Toast.show("Gagal menyalin otomatis. Salin manual ya.", "info");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(success).catch(() => (fallback() ? success() : failToast()));
    } else if (fallback()) {
      success();
    } else {
      failToast();
    }
  },

  async applyPromo() {
    const input = document.getElementById("join-promo-code");
    const msgEl = document.getElementById("join-promo-msg");
    const code = (input.value || "").trim().toUpperCase();
    msgEl.style.display = "none";
    if (!code) {
      this.appliedPromo = null;
      Toast.show("Kolom promo kosong — membayar harga normal.", "info");
      this.renderInvoice();
      return;
    }
    let promo = null;
    try {
      promo = await getPromoByCode(code);
    } catch (e) {
      Toast.show("Gagal cek kode promo: " + e.message, "error");
      return;
    }
    if (!promo) {
      this.appliedPromo = null;
      msgEl.textContent = "❌ Kode promo tidak ditemukan.";
      msgEl.style.color = "var(--danger)";
      msgEl.style.display = "block";
      this.renderInvoice();
      return;
    }
    if (promo.active === false) {
      this.appliedPromo = null;
      msgEl.textContent = "❌ Kode promo sudah tidak aktif.";
      msgEl.style.color = "var(--danger)";
      msgEl.style.display = "block";
      this.renderInvoice();
      return;
    }
    if (Number(promo.usedCount || 0) >= Number(promo.usageLimit || 0)) {
      this.appliedPromo = null;
      msgEl.textContent = "❌ Kuota kode promo sudah habis.";
      msgEl.style.color = "var(--danger)";
      msgEl.style.display = "block";
      this.renderInvoice();
      return;
    }
    this.appliedPromo = promo;
    msgEl.textContent = `✅ Kode ${promo.code} aktif — lihat invoice di bawah.`;
    msgEl.style.color = "var(--neon-dark)";
    msgEl.style.display = "block";
    this.renderInvoice();
  },

  removePromo() {
    this.appliedPromo = null;
    const input = document.getElementById("join-promo-code");
    if (input) input.value = "";
    const msgEl = document.getElementById("join-promo-msg");
    if (msgEl) msgEl.style.display = "none";
    this.renderInvoice();
  },

  async submitJoin(e) {
    e.preventDefault();
    const errEl = document.getElementById("join-error");
    errEl.style.display = "none";
    const discordId = document.getElementById("join-discord-id").value.trim();
    const snk = document.getElementById("join-snk").checked;
    if (!discordId) {
      errEl.textContent = "ID Discord wajib diisi.";
      errEl.style.display = "block";
      return false;
    }
    if (!snk) {
      errEl.textContent = "Centang Syarat & Ketentuan dulu ya.";
      errEl.style.display = "block";
      return false;
    }
    if (!this.selectedMethod) {
      errEl.textContent = "Pilih metode pembayaran.";
      errEl.style.display = "block";
      return false;
    }
    const method = this.paymentMethods.find((p) => p.id === this.selectedMethod);

    // Maksimal 1x request join per paket; member aktif tidak bisa request join lagi
    const isMember = this.user.membership && this.user.membership !== "none";
    const daysLeft = Helpers.daysLeft(this.user.membershipExpiry);
    const memberExpired = this.user.membershipExpiry && daysLeft !== null && daysLeft <= 0;
    if (isMember && !memberExpired) {
      errEl.textContent = "Kamu sudah menjadi member. Tidak perlu request join lagi — bila ingin naik paket, gunakan menu Upgrade.";
      errEl.style.display = "block";
      return false;
    }
    let myTxs = [];
    try {
      myTxs = await getUserTransactions(this.user.uid);
    } catch (e) {
      myTxs = [];
    }
    const existingJoin = myTxs.find((t) => t.type === "join" && t.tier === this.selectedTier && t.status === "pending");
    if (existingJoin) {
      errEl.textContent = `Kamu sudah punya request join ${this.selectedTier.toUpperCase()} yang menunggu verifikasi (ID ${existingJoin.id.slice(0, 8).toUpperCase()}). Cek menu Konfirmasi Pembayaran.`;
      errEl.style.display = "block";
      return false;
    }

    // Re-validasi promo sebelum transaksi dibuat (mencegah kode kedaluwarsa/habis kuota)
    if (this.appliedPromo) {
      let fresh = null;
      try {
        fresh = await getPromoByCode(this.appliedPromo.code);
      } catch (e) {
        fresh = null;
      }
      if (!fresh || fresh.active === false || Number(fresh.usedCount || 0) >= Number(fresh.usageLimit || 0)) {
        errEl.textContent = "Kode promo tidak valid lagi (dihapus/nonaktif/kuota habis) atau gagal divalidasi. Hapus promo lalu coba lagi.";
        errEl.style.display = "block";
        return false;
      }
    }
    const info = this._discountInfo();
    const amount = info.total;

    const btn = document.getElementById("join-submit-btn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="border-color:rgba(0,0,0,0.25);border-top-color:#04210f"></span> Memproses...';
    try {
      const id = await createTransaction({
        userId: this.user.uid,
        userEmail: this.user.email,
        userName: this.user.name,
        type: "join",
        tier: this.selectedTier,
        amount,
        originalAmount: info.base,
        promoCode: info.promo ? info.promo.code : "",
        promoType: info.promo ? info.promo.type : "",
        promoValue: info.promo ? Number(info.promo.value) : 0,
        paymentMethodId: method.id,
        paymentMethodName: `${method.bankName} - ${method.accountName} - ${method.accountNumber}`,
        discordId,
      });
      await this.renderAll();
      this.showPanel("payment");
      Modal.open(
        `<h3>✅ Transaksi Berhasil Dibuat!</h3>
         <div class="info-box mt-2">ID Transaksi kamu: <b style="font-size:1.15rem;letter-spacing:0.08em">${id.slice(0, 8).toUpperCase()}</b></div>
         <div class="card invoice-box mt-2">
           <h3 class="mb-1">🧾 Invoice Pembayaran</h3>
           <div class="invoice-row"><span>Paket: <b>${this.selectedTier === "vip" ? "👑 VIP" : "🌱 Premium"}</b></span><span>${Helpers.fmtIDR(info.base)}</span></div>
           ${info.promo ? `<div class="invoice-row"><span>🎟️ Diskon <b>${Helpers.esc(info.promo.code)}</b></span><span style="color:var(--neon-dark)">−${Helpers.fmtIDR(info.discount)}</span></div>` : ""}
           <div class="invoice-row invoice-total"><span>Total yang Harus Dibayar</span><span>${Helpers.fmtIDR(info.total)}</span></div>
         </div>
         ${this._rekeningBox(method)}
         <p class="muted mt-2">Transfer sesuai total di invoice ke rekening di atas, lalu <b>upload bukti pembayaran</b>. Setelah admin menyetujui, tombol <b>Join Discord</b> akan aktif.</p>
         <div class="flex mt-2" style="justify-content:flex-end">
           <button class="btn btn-primary" id="join-success-upload">📤 Upload Bukti Sekarang</button>
           <button class="btn btn-ghost" onclick="Modal.close(); UserDash.showPanel('payment')">Nanti Dulu</button>
         </div>`,
        { sticky: true }
      );
      this._bindCopyRek(method.accountNumber);
      document.getElementById("join-success-upload").onclick = () => {
        Modal.close();
        this.openUploadProof(id);
      };
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "💰 Konfirmasi Pembayaran";
    }
    return false;
  },

  async renderJoinTransactions(existingTxs) {
    const wrap = document.getElementById("user-join-transactions");
    if (!this.user) return;
    const txs = existingTxs || (await getUserTransactions(this.user.uid));
    if (!txs.length) {
      wrap.innerHTML = "";
      return;
    }
    wrap.innerHTML = `<h3 class="mb-1">📋 Riwayat Transaksi Join</h3><div class="table-wrap"><table>
      <tr><th>ID Transaksi</th><th>Paket</th><th>Nominal</th><th>Status</th><th>Tanggal</th></tr>
      ${txs.filter((t) => t.type === "join").slice(0, 5).map((t) => `
        <tr>
          <td><b>${t.id.slice(0, 8).toUpperCase()}</b></td>
          <td>${t.tier === "vip" ? "👑 VIP" : "🌱 Premium"}</td>
          <td>${Helpers.fmtIDR(t.amount)}${t.promoCode ? `<div class="small" style="color:var(--neon-dark)">🎟️ ${Helpers.esc(t.promoCode)}</div>` : ""}</td>
          <td>${Helpers.statusBadge(t.status)}</td>
          <td>${Helpers.fmtDateTime(t.createdAt)}</td>
        </tr>`).join("")}
    </table></div>`;
  },

  /* ============ KONFIRMASI PEMBAYARAN ============ */
  async renderPayment() {
    if (!this.user) return;
    const area = document.getElementById("payment-status-area");
    const list = document.getElementById("payment-list");
    const txs = await getUserTransactions(this.user.uid);
    const active = txs.filter((t) => t.status === "pending" || t.status === "rejected");

    area.innerHTML = txs.length
      ? `<div class="info-box">Upload bukti pembayaran kamu di sini. Admin akan memverifikasi. Setelah <b>disetujui</b>, tombol join Discord akan aktif.</div>`
      : `<div class="info-box">Belum ada transaksi. Silakan <b>Join Member</b> dulu.</div>`;

    list.innerHTML = txs.length
      ? `<div class="table-wrap"><table>
          <tr><th>ID</th><th>Jenis</th><th>Paket</th><th>Nominal</th><th>Status</th><th>Bukti</th><th>Aksi</th></tr>
          ${txs.map((t) => `
            <tr>
              <td><b>${t.id.slice(0, 8).toUpperCase()}</b></td>
              <td>${t.type === "upgrade" ? "Upgrade VIP" : "Join"}</td>
              <td>${t.tier === "vip" ? "👑 VIP" : "🌱 Premium"}</td>
              <td>${Helpers.fmtIDR(t.amount)}${t.promoCode ? `<div class="small" style="color:var(--neon-dark)">🎟️ ${Helpers.esc(t.promoCode)}</div>` : ""}</td>
              <td>${Helpers.statusBadge(t.status)}${t.note ? `<div class="small muted mt-1">💬 ${Helpers.esc(t.note)}</div>` : ""}</td>
              <td>${t.proofUrl ? `<a href="${Helpers.esc(t.proofUrl)}" target="_blank" rel="noopener">Lihat</a>` : "-"}</td>
              <td>
                <button class="btn btn-ghost btn-sm" onclick="UserDash.viewInvoice('${t.id}')">🧾 Invoice</button>
                ${t.status === "pending"
                  ? `<button class="btn btn-outline btn-sm" onclick="UserDash.openUploadProof('${t.id}')">📤 Upload Bukti</button>`
                  : t.status === "rejected"
                    ? `<button class="btn btn-outline btn-sm" onclick="UserDash.openUploadProof('${t.id}')">📤 Upload Ulang</button>`
                    : `<span class="small muted">✅ Selesai</span>`}
              </td>
            </tr>`).join("")}
        </table></div>`
      : "";
  },

  async viewInvoice(txId) {
    const t = await getTransaction(txId);
    if (!t) {
      Toast.show("Transaksi tidak ditemukan.", "error");
      return;
    }
    const pms = await getPaymentMethods(true);
    const method = pms.find((p) => p.id === t.paymentMethodId) || null;
    const base = Number(t.originalAmount || t.amount || 0);
    const discount = Math.max(0, base - Number(t.amount || 0));
    const pkg = t.type === "upgrade" ? "⭐ Upgrade Premium → VIP" : t.tier === "vip" ? "👑 VIP" : "🌱 Premium";
    const hasRek = !!(method || t.paymentMethodName);
    const step1 = hasRek
      ? `Transfer tepat sebesar <b>${Helpers.fmtIDR(t.amount)}</b> ke rekening di atas.`
      : `Hubungi admin untuk info rekening tujuan, lalu transfer tepat sebesar <b>${Helpers.fmtIDR(t.amount)}</b>.`;
    Modal.open(
      `<h3>🧾 Invoice Transaksi</h3>
       <div class="info-box mt-2">ID Transaksi: <b style="letter-spacing:0.08em">${txId.slice(0, 8).toUpperCase()}</b> &nbsp;·&nbsp; ${Helpers.statusBadge(t.status)}</div>
       <div class="card invoice-box mt-2">
         <div class="invoice-row"><span>Paket: <b>${pkg}</b></span><span>${Helpers.fmtIDR(base)}</span></div>
         ${t.promoCode ? `<div class="invoice-row"><span>🎟️ Diskon <b>${Helpers.esc(t.promoCode)}</b>${t.promoType ? ` (${t.promoType === "fixed" ? Helpers.fmtIDR(t.promoValue) : Number(t.promoValue) + "%"})` : ""}</span><span style="color:var(--neon-dark)">−${Helpers.fmtIDR(discount)}</span></div>` : ""}
         <div class="invoice-row invoice-total"><span>Total yang Harus Dibayar</span><span>${Helpers.fmtIDR(t.amount)}</span></div>
       </div>
       ${method ? this._rekeningBox(method) : t.paymentMethodName ? `<div class="card mt-2"><p class="small">Rekening tujuan: <b>${Helpers.esc(t.paymentMethodName)}</b></p></div>` : ""}
       <div class="card mt-2">
         <h4 class="mb-1">📌 Cara Pembayaran</h4>
         <ol class="small" style="padding-left:1.2rem;line-height:1.7">
           <li>${step1}</li>
           <li>Simpan bukti transfer (screenshot / struk).</li>
           <li>Klik tombol <b>📤 Upload Bukti</b> di bawah untuk mengirim bukti.</li>
           <li>Admin memverifikasi (maks. 1x24 jam). Setelah disetujui, akses Discord & fitur member aktif.</li>
         </ol>
       </div>
       ${t.proofUrl ? `<div class="small mt-2">Bukti terupload: <a href="${Helpers.esc(t.proofUrl)}" target="_blank" rel="noopener">Lihat</a></div>` : ""}
       <div class="flex mt-2" style="justify-content:flex-end">
         ${t.status === "pending" || t.status === "rejected" ? `<button class="btn btn-primary" id="invoice-upload-btn">📤 Upload Bukti</button>` : ""}
         <button class="btn btn-ghost" onclick="Modal.close()">Tutup</button>
       </div>`,
      { sticky: true, maxWidth: "480px" }
    );
    if (method) this._bindCopyRek(method.accountNumber);
    const upBtn = document.getElementById("invoice-upload-btn");
    if (upBtn) upBtn.onclick = () => {
      Modal.close();
      this.openUploadProof(txId);
    };
  },

  openUploadProof(txId) {
    Modal.open(
      `<h3>📤 Upload Bukti Pembayaran</h3>
       <p class="muted small">Upload foto/screenshot bukti transfer (format JPG/PNG, maksimal 1,2 MB).</p>
       <div class="form-group mt-2">
         <input type="file" id="proof-file" accept="image/*" required />
       </div>
       <div class="error-text" id="proof-error"></div>
       <div class="flex mt-2" style="justify-content:flex-end">
         <button class="btn btn-ghost" onclick="Modal.close()">Batal</button>
         <button class="btn btn-primary" id="proof-upload-btn">Upload</button>
       </div>`,
      { sticky: true }
    );
    document.getElementById("proof-upload-btn").onclick = () => {
      const f = document.getElementById("proof-file").files[0];
      const errEl = document.getElementById("proof-error");
      if (!f) {
        errEl.textContent = "Pilih file bukti dulu.";
        errEl.style.display = "block";
        return;
      }
      if (f.size > 1.2 * 1024 * 1024) {
        errEl.textContent = "Maksimal ukuran gambar 1,2 MB.";
        errEl.style.display = "block";
        return;
      }
      Modal.confirm({
        title: "📤 Konfirmasi Upload Bukti",
        message: `File: <b>${Helpers.esc(f.name)}</b> (${Math.max(1, Math.round(f.size / 1024))} KB)<br/><br/>Bukti pembayaran akan dikirim ke admin untuk diverifikasi. Lanjutkan upload?`,
        okText: "Ya, Upload",
        onOk: async () => {
          Modal.open(
            `<div class="center" style="padding:1rem 0">
               <div class="spinner" style="width:36px;height:36px;border-width:4px;margin:0 auto 1rem"></div>
               <p class="muted">Mengupload bukti pembayaran...</p>
             </div>`,
            { sticky: true }
          );
          try {
            const up = await uploadFile(f, `proofs/${this.user.uid}`);
            await updateTransaction(txId, {
              proofUrl: up.url,
              proofMeta: { publicId: up.publicId, deleteToken: up.deleteToken },
              status: "pending",
              note: "",
            });
            Modal.open(
              `<h3>✅ Bukti Pembayaran Terupload!</h3>
               <p class="muted mt-1">Bukti kamu sudah masuk. Admin akan memverifikasi — biasanya dalam waktu singkat. Setelah <b>disetujui</b>, tombol <b>Join Discord</b> akan aktif di dashboard kamu.</p>
               <div class="flex mt-2" style="justify-content:flex-end">
                 <button class="btn btn-primary" onclick="Modal.close()">Mengerti</button>
               </div>`,
              { sticky: true }
            );
            Toast.show("Bukti pembayaran terupload! Menunggu verifikasi admin.", "success");
            await this.renderAll();
          } catch (e) {
            Toast.show("Gagal upload: " + e.message, "error");
            Modal.close();
          }
        },
      });
    };
  },

  /* ============ MENTORING (VIP) ============ */
  async renderMentoring() {
    const area = document.getElementById("mentoring-area");
    const u = this.user;
    if (u.membership !== "vip") {
      area.innerHTML = `<div class="info-box">Fitur mentoring khusus member <b>VIP</b>. Upgrade dulu ya!</div>`;
      return;
    }
    const mentorings = await getUserMentorings(u.uid);
    const quotaLeft = (u.mentoringQuota || 0) - (u.mentoringUsed || 0);
    const hasPending = mentorings.some((m) => ["waiting_schedule", "scheduled", "reschedule_requested", "rescheduled"].includes(m.status));

    let html = `
      <div class="card mb-2">
        <div class="flex space-between">
          <div><h3>Jatah Mentoring</h3>
          <p class="muted small mt-1">Sisa: <b style="color:var(--neon-dark);font-size:1.2rem">${quotaLeft}</b> dari ${u.mentoringQuota || 0}</p>
          <div class="quota-bar" style="max-width:240px"><div class="quota-fill" style="width:${u.mentoringQuota ? (quotaLeft / u.mentoringQuota) * 100 : 0}%"></div></div></div>
          <div class="center">
            <div class="stat-num">${mentorings.length}</div>
            <div class="stat-label">Total Request</div>
          </div>
        </div>
      </div>`;

    if (quotaLeft <= 0) {
      html += `<div class="info-box warn">Jatah mentoring kamu sudah habis.</div>`;
    } else if (hasPending) {
      html += `<div class="info-box">Kamu punya request mentoring yang masih berjalan. Selesaikan dulu sebelum request baru.</div>`;
    } else {
      html += `
        <div class="card mb-2">
          <h3>🎓 Request Mentoring 1-on-1</h3>
          <p class="muted small mt-1">Pengajar akan menentukan jadwal pertama. Kamu bisa approve atau reschedule (maksimal 1x). Jatah berkurang jika kamu dan pengajar sama-sama approve.</p>
          <div class="mt-2"><button class="btn btn-primary" onclick="UserDash.requestMentoring()">📩 Request Mentoring</button></div>
        </div>`;
    }

    if (mentorings.length) {
      html += `<h3 class="mb-1">📋 Riwayat Mentoring</h3>`;
      mentorings.forEach((m) => {
        html += `
        <div class="card mb-1">
          <div class="flex space-between">
            <div><b>${Helpers.fmtDateTime(m.createdAt)}</b> ${Helpers.statusBadge(m.status)}</div>
            ${m.quotaUsed ? '<span class="badge badge-approved">Jatah -1</span>' : ""}
          </div>
          ${m.proposedDate ? `<p class="mt-1">📅 Jadwal dari pengajar: <b>${Helpers.esc(m.proposedDate)}</b></p>` : ""}
          ${m.rescheduleReason ? `<p class="mt-1 small muted">💬 Alasan reschedule: ${Helpers.esc(m.rescheduleReason)}</p>` : ""}
          ${m.userNote ? `<p class="mt-1 small muted">📝 Catatan: ${Helpers.esc(m.userNote)}</p>` : ""}
          ${m.status === "scheduled" || m.status === "rescheduled"
            ? `<div class="flex mt-2">
                <button class="btn btn-primary btn-sm" onclick="UserDash.approveMentoring('${m.id}')">✅ Approve Jadwal</button>
                ${m.rescheduleCount < 1 ? `<button class="btn btn-outline btn-sm" onclick="UserDash.openReschedule('${m.id}')">🔄 Request Reschedule</button>` : ""}
              </div>`
            : ""}
        </div>`;
      });
    }
    area.innerHTML = html;
  },

  async requestMentoring() {
    Modal.open(
      `<h3>📩 Request Mentoring</h3>
       <p class="muted small">Ceritakan singkat apa yang ingin kamu pelajari/ditanyakan ke pengajar (opsional).</p>
       <div class="form-group mt-2"><textarea id="mentoring-note" placeholder="Contoh: ingin lebih paham cara memilih pool yang aman..."></textarea></div>
       <div class="error-text" id="mentoring-error"></div>
       <div class="flex mt-2" style="justify-content:flex-end">
         <button class="btn btn-ghost" onclick="Modal.close()">Batal</button>
         <button class="btn btn-primary" id="mentoring-send-btn">Kirim Request</button>
       </div>`,
      { sticky: true }
    );
    document.getElementById("mentoring-send-btn").onclick = async () => {
      const note = document.getElementById("mentoring-note").value.trim();
      await createMentoring({ userId: this.user.uid, userName: this.user.name, userEmail: this.user.email, userNote: note });
      Toast.show("Request mentoring terkirim! Pengajar akan menentukan jadwal.", "success");
      Modal.close();
      await this.renderMentoring();
    };
  },

  approveMentoring(id) {
    Modal.confirm({
      title: "✅ Approve Jadwal Mentoring",
      message: "Setuju dengan jadwal dari pengajar? Jika kamu approve, jatah mentoring berkurang 1 dan sesi akan dijadwalkan.",
      okText: "Ya, Approve",
      onOk: async () => {
        const m = await getMentoring(id);
        await updateMentoring(id, { userApproved: true, status: "done", doneAt: firebase.firestore.FieldValue.serverTimestamp(), quotaUsed: true });
        await dbUpdate(`users/${this.user.uid}`, { mentoringUsed: (this.user.mentoringUsed || 0) + 1 });
        Toast.show("Jadwal di-approve! Sesi mentoring dikonfirmasi. 🎉", "success");
        await this.renderAll();
      },
    });
  },

  openReschedule(id) {
    Modal.open(
      `<h3>🔄 Request Reschedule</h3>
       <p class="muted small">Kamu hanya bisa reschedule <b>1x</b>. Tulis alasan kenapa ingin ganti jadwal.</p>
       <div class="form-group mt-2"><textarea id="resched-reason" placeholder="Alasan reschedule..." required></textarea></div>
       <div class="error-text" id="resched-error"></div>
       <div class="flex mt-2" style="justify-content:flex-end">
         <button class="btn btn-ghost" onclick="Modal.close()">Batal</button>
         <button class="btn btn-primary" id="resched-btn">Kirim Request</button>
       </div>`,
      { sticky: true }
    );
    document.getElementById("resched-btn").onclick = async () => {
      const reason = document.getElementById("resched-reason").value.trim();
      const errEl = document.getElementById("resched-error");
      if (!reason) {
        errEl.textContent = "Alasan wajib diisi.";
        errEl.style.display = "block";
        return;
      }
      await updateMentoring(id, { status: "reschedule_requested", rescheduleReason: reason, rescheduleCount: 1 });
      Toast.show("Request reschedule terkirim ke pengajar.", "success");
      Modal.close();
      await this.renderMentoring();
    };
  },

  /* ============ UPGRADE VIP ============ */
  async renderUpgrade() {
    const area = document.getElementById("upgrade-area");
    const u = this.user;
    if (u.membership === "vip") {
      area.innerHTML = `<div class="info-box">✅ Kamu sudah <b>VIP</b>. Nikmati 5x mentoring 1-on-1 kamu!</div>`;
      return;
    }
    if (u.membership !== "premium") {
      area.innerHTML = `<div class="info-box">Upgrade ke VIP tersedia untuk member Premium. Join member dulu ya!</div>`;
      return;
    }
    const txs = await getUserTransactions(u.uid);
    const pendingUpgrade = txs.find((t) => t.type === "upgrade" && t.status === "pending");
    if (pendingUpgrade) {
      area.innerHTML = `<div class="info-box">⏳ Kamu punya request upgrade VIP yang sedang diproses. Cek menu <b>Konfirmasi Pembayaran</b>.</div>`;
      return;
    }
    area.innerHTML = `
      <div class="card">
        <h3>👑 Upgrade Premium → VIP</h3>
        <p class="muted mt-1">Biaya upgrade: <b style="color:var(--neon-dark);font-size:1.4rem">${Helpers.fmtIDR(Math.max(0, (this.settings.vipPrice || 0) - (this.settings.premiumPrice || 0)))}</b></p>
        <ul class="price-features mt-1">
          <li>5x mentoring 1-on-1 dengan pengajar</li>
          <li>Prioritas tanya jawab di Discord</li>
          <li>Review portfolio & strategi pribadi</li>
        </ul>
        <div class="mt-2">
          <button class="btn btn-primary" onclick="UserDash.requestUpgrade()">⭐ Request Upgrade VIP</button>
        </div>
      </div>`;
  },

  requestUpgrade() {
    const price = Math.max(0, (this.settings.vipPrice || 0) - (this.settings.premiumPrice || 0));
    const pms = this.paymentMethods;
    if (!pms.length) {
      Toast.show("Belum ada metode pembayaran. Hubungi admin.", "error");
      return;
    }
    if (!pms.find((p) => p.id === this.upgradeMethodId)) this.upgradeMethodId = pms[0].id;

    const render = () => {
      document.getElementById("modal-box").innerHTML = `
        <h3>⭐ Upgrade Premium → VIP</h3>
        <p class="muted mt-1">Biaya upgrade: <b style="color:var(--neon-dark);font-size:1.3rem">${Helpers.fmtIDR(price)}</b></p>
        <p class="small muted mt-1">Pilih metode pembayaran untuk transfer:</p>
        <div class="mt-1">
          ${pms.map((p) => `
            <div class="card pricing-card ${this.upgradeMethodId === p.id ? "selected" : ""}" style="text-align:left" onclick="UserDash.pickUpgradeMethod('${p.id}')">
              <div class="price-tier" style="font-size:1rem">🏦 ${Helpers.esc(p.bankName)}</div>
              <p class="muted small">a.n. <b>${Helpers.esc(p.accountName)}</b></p>
              <p class="small" style="letter-spacing:0.05em;font-weight:700">${Helpers.esc(p.accountNumber)}</p>
            </div>`).join("")}
        </div>
        <div class="error-text" id="upgrade-error"></div>
        <div class="flex mt-2" style="justify-content:flex-end">
          <button class="btn btn-ghost" onclick="Modal.close()">Batal</button>
          <button class="btn btn-primary" id="upgrade-create-btn">Buat Transaksi</button>
        </div>`;
      document.getElementById("upgrade-create-btn").onclick = async () => {
        const method = pms.find((p) => p.id === this.upgradeMethodId);
        const btn = document.getElementById("upgrade-create-btn");
        const errEl = document.getElementById("upgrade-error");
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="border-color:rgba(0,0,0,0.25);border-top-color:#04210f"></span> Memproses...';
        try {
          const id = await createTransaction({
            userId: this.user.uid,
            userEmail: this.user.email,
            userName: this.user.name,
            type: "upgrade",
            tier: "vip",
            amount: price,
            originalAmount: price,
            paymentMethodId: method.id,
            paymentMethodName: `${method.bankName} - ${method.accountName} - ${method.accountNumber}`,
            discordId: this.user.discordId || "",
          });
          await this.renderAll();
          Modal.open(
            `<h3>✅ Transaksi Upgrade Dibuat!</h3>
             <div class="info-box mt-2">ID Transaksi kamu: <b style="font-size:1.15rem;letter-spacing:0.08em">${id.slice(0, 8).toUpperCase()}</b></div>
             <div class="card invoice-box mt-2">
               <h3 class="mb-1">🧾 Invoice Pembayaran</h3>
               <div class="invoice-row"><span>Paket: <b>⭐ Upgrade Premium → VIP</b></span><span>${Helpers.fmtIDR(price)}</span></div>
               <div class="invoice-row invoice-total"><span>Total yang Harus Dibayar</span><span>${Helpers.fmtIDR(price)}</span></div>
             </div>
             ${this._rekeningBox(method)}
             <p class="muted mt-2">Transfer sesuai total di invoice ke rekening di atas, lalu <b>upload bukti pembayaran</b> di panel Konfirmasi Pembayaran.</p>
             <div class="flex mt-2" style="justify-content:flex-end">
               <button class="btn btn-primary" id="upgrade-success-upload">📤 Upload Bukti Sekarang</button>
               <button class="btn btn-ghost" onclick="Modal.close(); UserDash.showPanel('payment')">Nanti Dulu</button>
             </div>`,
            { sticky: true }
          );
          this._bindCopyRek(method.accountNumber);
          document.getElementById("upgrade-success-upload").onclick = () => {
            Modal.close();
            this.openUploadProof(id);
          };
        } catch (e) {
          errEl.textContent = e.message;
          errEl.style.display = "block";
          btn.disabled = false;
          btn.textContent = "Buat Transaksi";
        }
      };
    };

    Modal.open("", { sticky: true, maxWidth: "480px" });
    this._upgradeRender = render;
    render();
  },

  pickUpgradeMethod(id) {
    this.upgradeMethodId = id;
    if (this._upgradeRender) this._upgradeRender();
  },

  /* ============ CHANGE PASSWORD ============ */
  async changePassword(e) {
    e.preventDefault();
    const errEl = document.getElementById("pass-error");
    errEl.style.display = "none";
    const p1 = document.getElementById("new-pass").value;
    const p2 = document.getElementById("new-pass2").value;
    if (p1 !== p2) {
      errEl.textContent = "Password tidak sama.";
      errEl.style.display = "block";
      return false;
    }
    if (p1.length < 8) {
      errEl.textContent = "Minimal 8 karakter.";
      errEl.style.display = "block";
      return false;
    }
    try {
      await DBAuth().currentUser.updatePassword(p1);
      Toast.show("Password berhasil diganti! 🔑", "success");
      document.getElementById("new-pass").value = "";
      document.getElementById("new-pass2").value = "";
    } catch (err) {
      errEl.textContent = Auth.mapError(err);
      errEl.style.display = "block";
    }
    return false;
  },
};
