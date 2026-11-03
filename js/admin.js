/* ============================================================
   LP TANI - Admin Dashboard
   ============================================================ */

const AdminDash = {
  users: [],
  transactions: [],
  mentorings: [],
  settings: null,
  content: null,
  terms: [],
  pnl: [],
  paymentMethods: [],
  promos: [],
  activePanel: "overview",

  async refreshAll() {
    const [settings, content, terms, pnl, pms, promos] = await Promise.all([
      getSettings(),
      getContent(),
      getTerms(),
      getPnlMedia(),
      getPaymentMethods(),
      getPromos(),
    ]);
    this.settings = settings || {};
    this.content = content || {};
    this.terms = terms;
    this.pnl = pnl;
    this.paymentMethods = pms;
    this.promos = promos;
    await this.renderAll();
  },

  async renderAll() {
    this.renderPanel(this.activePanel);
  },

  showPanel(panel) {
    this.activePanel = panel;
    document.querySelectorAll("#admin-menu button[data-admin-panel]").forEach((b) => {
      b.classList.toggle("active", b.dataset.adminPanel === panel);
    });
    document.querySelectorAll(".dash-panel[id^='admin-panel-']").forEach((p) => p.classList.remove("active"));
    document.getElementById(`admin-panel-${panel}`).classList.add("active");
    this.renderPanel(panel);
  },

  async renderPanel(panel) {
    const renderers = {
      overview: () => this.renderOverview(),
      users: () => this.renderUsers(),
      transactions: () => this.renderTransactions(),
      mentoring: () => this.renderMentoring(),
      content: () => this.renderContent(),
      terms: () => this.renderTerms(),
      pnl: () => this.renderPnl(),
      "payment-methods": () => this.renderPaymentMethods(),
      promo: () => this.renderPromos(),
      settings: () => this.renderSettings(),
      password: () => this.renderPassword(),
    };
    if (renderers[panel]) await renderers[panel]();
  },

  /* ============ OVERVIEW ============ */
  async renderOverview() {
    const el = document.getElementById("admin-overview-content");
    const [users, txs, mentorings] = await Promise.all([
      dbQueryUsers(),
      getAllTransactions(),
      getAllMentorings(),
    ]);
    this.users = users;
    this.transactions = txs;
    this.mentorings = mentorings;
    const s = this.settings || {};

    const pendingTxs = txs.filter((t) => t.status === "pending").length;
    const members = this.users.filter((u) => u.membership && u.membership !== "none");
    const expired = members.filter((u) => {
      const d = Helpers.daysLeft(u.membershipExpiry);
      return d !== null && d <= 0;
    }).length;
    const needSchedule = mentorings.filter((m) => m.status === "waiting_schedule" || m.status === "reschedule_requested").length;

    el.innerHTML = `
      <div class="grid-4">
        <div class="card center"><div class="stat-num">${this.users.length}</div><div class="stat-label">Total User</div></div>
        <div class="card center"><div class="stat-num">${members.length}</div><div class="stat-label">Member Aktif</div></div>
        <div class="card center"><div class="stat-num" style="color:var(--warning)">${pendingTxs}</div><div class="stat-label">Pembayaran Pending</div></div>
        <div class="card center"><div class="stat-num">${needSchedule}</div><div class="stat-label">Mentoring Perlu Jadwal</div></div>
      </div>
      ${expired > 0 ? `<div class="info-box warn mt-2">⚠️ Ada <b>${expired}</b> member yang masa berlakunya habis. Buka menu <b>Manage User</b> untuk kick.</div>` : ""}
      <div class="card mt-2">
        <h3 class="mb-1">⚡ Status Pendaftaran</h3>
        <div class="flex">
          ${s.openRegistration !== false
            ? '<span class="badge badge-approved">🟢 OPEN — Member baru bisa daftar</span>'
            : '<span class="badge badge-rejected">🔴 CLOSE — Pendaftaran ditutup</span>'}
          <button class="btn btn-outline btn-sm" onclick="AdminDash.toggleRegistration()">${s.openRegistration !== false ? "Tutup Pendaftaran" : "Buka Pendaftaran"}</button>
        </div>
      </div>`;
  },

  async toggleRegistration() {
    const next = this.settings.openRegistration === false;
    await saveSettings({ openRegistration: next });
    this.settings = this.settings || {};
    this.settings.openRegistration = next;
    Toast.show(next ? "Pendaftaran member DIBUKA." : "Pendaftaran member DITUTUP.", "success");
    await this.renderOverview();
    await Landing.render();
  },

  /* ============ MANAGE USER ============ */
  async renderUsers() {
    const el = document.getElementById("admin-users-content");
    this.users = await dbQueryUsers();

    el.innerHTML = `
      <div class="flex mb-2">
        <input type="text" id="user-search" placeholder="🔍 Cari nama / email / discord ID..." oninput="AdminDash.filterUsers()" style="max-width:320px" />
      </div>
      <div class="table-wrap"><table id="users-table">
        <tr><th>User</th><th>Kontak</th><th>Membership</th><th>Masa Berlaku</th><th>Mentoring</th><th>Aksi</th></tr>
        ${this.users.map((u) => this.userRow(u)).join("")}
      </table></div>`;
  },

  userRow(u) {
    const isMember = u.membership && u.membership !== "none";
    const days = Helpers.daysLeft(u.membershipExpiry);
    const expired = u.membershipExpiry && days !== null && days <= 0;
    const badge = u.membership === "vip" ? '<span class="badge badge-vip">👑 VIP</span>'
      : u.membership === "premium" ? '<span class="badge badge-premium">🌱 Premium</span>'
      : '<span class="badge badge-expired">Belum Member</span>';
    return `
      <tr data-user-row data-search="${Helpers.esc((u.name + " " + u.email + " " + (u.discordId || "")).toLowerCase())}">
        <td><b>${Helpers.esc(u.name || "-")}</b><div class="small muted">${u.role === "admin" ? "⚙️ ADMIN" : ""}</div></td>
        <td class="small">${Helpers.esc(u.email)}<br/>${Helpers.esc(u.phone || "-")}<br/>DC: ${Helpers.esc(u.discordId || "-")}</td>
        <td>${badge}${expired ? ' <span class="badge badge-expired">Expired</span>' : ""}</td>
        <td class="small">${isMember && u.membershipExpiry ? `${Helpers.fmtDate(u.membershipExpiry)}<br/>${expired ? '<b style="color:var(--danger)">HABIS</b>' : "Sisa " + days + " hari"}` : "-"}</td>
        <td class="small">${u.mentoringUsed || 0} / ${u.mentoringQuota || 0}</td>
        <td style="white-space:nowrap">
          ${isMember && expired ? `<button class="btn btn-danger btn-sm" onclick="AdminDash.kickUser('${u.id}','${Helpers.esc(u.name || "")}')">👢 Kick</button>` : ""}
          <button class="btn btn-outline btn-sm" onclick="AdminDash.openEditUser('${u.id}')">✏️ Edit</button>
        </td>
      </tr>`;
  },

  filterUsers() {
    const q = document.getElementById("user-search").value.toLowerCase();
    document.querySelectorAll("#users-table tr[data-user-row]").forEach((r) => {
      r.style.display = r.dataset.search.includes(q) ? "" : "none";
    });
  },

  kickUser(id, name) {
    Modal.confirm({
      title: "👢 Kick Member",
      message: `Kick <b>${name}</b> karena masa berlaku member sudah habis? Akses Discord & mentoring akan dicabut.`,
      okText: "Kick Sekarang",
      danger: true,
      onOk: async () => {
        await dbUpdate(`users/${id}`, { membership: "none", membershipExpiry: null, mentoringQuota: 0 });
        Toast.show("Member berhasil di-kick.", "success");
        await this.renderUsers();
      },
    });
  },

  openEditUser(id) {
    const u = this.users.find((x) => x.id === id);
    if (!u) return;
    Modal.prompt({
      title: `✏️ Edit User: ${u.name || u.email}`,
      fields: [
        { label: "Membership", type: "select", value: u.membership || "none", options: [{ value: "none", label: "Tidak Ada" }, { value: "premium", label: "Premium" }, { value: "vip", label: "VIP" }] },
        { label: "Jatah Mentoring", type: "number", value: u.mentoringQuota || 0 },
        { label: "Mentoring Terpakai", type: "number", value: u.mentoringUsed || 0 },
        { label: "Masa Berlaku Sampai (YYYY-MM-DD)", type: "date", value: u.membershipExpiry ? Helpers.fmtDate(u.membershipExpiry) : "", required: false },
      ],
      onOk: async ([membership, quota, used, expiryStr], done, fail) => {
        try {
          const upd = { membership, mentoringQuota: Number(quota) || 0, mentoringUsed: Number(used) || 0 };
          if (expiryStr) {
            const d = new Date(expiryStr + "T23:59:59");
            upd.membershipExpiry = firebase.firestore.Timestamp.fromDate(d);
          }
          await dbUpdate(`users/${id}`, upd);
          Toast.show("Data user tersimpan.", "success");
          done();
          await this.renderUsers();
        } catch (e) {
          fail(e.message);
        }
      },
    });
  },

  /* ============ VERIFIKASI PEMBAYARAN ============ */
  async renderTransactions() {
    const el = document.getElementById("admin-transactions-content");
    this.transactions = await getAllTransactions();
    this.promos = await getPromos();
    const pending = this.transactions.filter((t) => t.status === "pending");

    el.innerHTML = `
      ${pending.length ? `<div class="info-box warn mb-2">⏳ Ada <b>${pending.length}</b> pembayaran menunggu verifikasi.</div>` : `<div class="info-box mb-2">✅ Tidak ada pembayaran pending.</div>`}
      <div class="table-wrap"><table>
        <tr><th>ID</th><th>User</th><th>Jenis</th><th>Paket</th><th>Nominal</th><th>Status</th><th>Bukti</th><th>Aksi</th></tr>
        ${this.transactions.map((t) => `
          <tr>
            <td class="small"><b>${t.id.slice(0, 8).toUpperCase()}</b><div>${Helpers.fmtDateTime(t.createdAt)}</div></td>
            <td class="small"><b>${Helpers.esc(t.userName || "-")}</b><br/>${Helpers.esc(t.userEmail || "")}<br/>DC: ${Helpers.esc(t.discordId || "-")}</td>
            <td>${t.type === "upgrade" ? "Upgrade VIP" : "Join"}</td>
            <td>${t.tier === "vip" ? "👑 VIP" : "🌱 Premium"}</td>
            <td><b>${Helpers.fmtIDR(t.amount)}</b>${t.promoCode ? `<div class="small" style="color:var(--neon-dark)">🎟️ ${Helpers.esc(t.promoCode)} (−${Helpers.fmtIDR(Math.max(0, Number(t.originalAmount || t.amount) - Number(t.amount)))})</div>` : ""}</td>
            <td>${Helpers.statusBadge(t.status)}${t.note ? `<div class="small muted mt-1">💬 ${Helpers.esc(t.note)}</div>` : ""}</td>
            <td>${t.proofUrl ? `<button class="btn btn-ghost btn-sm" onclick="AdminDash.viewProof('${t.id}')">🖼️ Lihat</button> <button class="btn btn-danger btn-sm" title="Hapus bukti dari web & Cloudinary" onclick="AdminDash.deleteProof('${t.id}')">🗑️</button>` : '<span class="small muted">Belum upload</span>'}</td>
            <td style="white-space:nowrap">
              ${t.status === "pending"
                ? `<button class="btn btn-primary btn-sm" onclick="AdminDash.approveTx('${t.id}')">✅ Approve</button>
                   <button class="btn btn-danger btn-sm" onclick="AdminDash.rejectTx('${t.id}')">❌ Tolak</button>`
                : ""}
            </td>
          </tr>`).join("")}
      </table></div>`;
  },

  viewProof(id) {
    const t = this.transactions.find((x) => x.id === id);
    if (!t || !t.proofUrl) {
      Toast.show("Belum ada bukti pembayaran.", "info");
      return;
    }
    Modal.open(
      `<h3>🖼️ Bukti Pembayaran</h3>
       <p class="small muted">${Helpers.esc(t.userName || "")} — ${t.type === "upgrade" ? "Upgrade VIP" : "Join"} ${t.tier} (${Helpers.fmtIDR(t.amount)})</p>
       <div class="mt-2"><img src="${Helpers.esc(t.proofUrl)}" style="width:100%;border-radius:10px" alt="Bukti pembayaran" /></div>
       <div class="flex mt-2" style="justify-content:space-between">
         <a class="btn btn-outline btn-sm" href="${Helpers.esc(t.proofUrl)}" target="_blank" rel="noopener" download>⬇️ Download Bukti</a>
         <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Tutup</button>
       </div>`,
      { maxWidth: "640px" }
    );
  },

  deleteProof(id) {
    const t = this.transactions.find((x) => x.id === id);
    if (!t) return;
    Modal.confirm({
      title: "🗑️ Hapus Bukti Pembayaran",
      message: `Hapus bukti pembayaran dari <b>${Helpers.esc(t.userName || t.userEmail)}</b>? Status transaksi tidak berubah — user bisa upload ulang bila perlu.`,
      okText: "Hapus Bukti",
      danger: true,
      onOk: async () => {
        const r = await deleteCloudinaryFile(t.proofMeta);
        await updateTransaction(id, { proofUrl: "", proofMeta: null });
        Toast.show(
          r.ok
            ? "Bukti dihapus (file juga dihapus dari Cloudinary)."
            : "Bukti dihapus dari web. File di Cloudinary tetap ada — hapus manual di Cloudinary Console (folder lptani/proofs).",
          "info",
          r.ok ? 4000 : 7000
        );
        await this.renderTransactions();
      },
    });
  },

  approveTx(id) {
    const t = this.transactions.find((x) => x.id === id);
    if (!t) return;
    const promoLine = t.promoCode
      ? `<br/><br/>🎟️ Promo: <b>${Helpers.esc(t.promoCode)}</b> — user membayar ${Helpers.fmtIDR(t.amount)} dari harga normal ${Helpers.fmtIDR(t.originalAmount || t.amount)}. Kuota promo bertambah terpakai saat approve.`
      : "";
    Modal.confirm({
      title: "✅ Approve Pembayaran",
      message: `Approve pembayaran <b>${t.type === "upgrade" ? "Upgrade VIP" : "Join " + t.tier}</b> dari <b>${Helpers.esc(t.userName || t.userEmail)}</b> (${Helpers.fmtIDR(t.amount)})?<br/><br/>User akan langsung mendapat akses join Discord${t.tier === "vip" ? " + jatah mentoring VIP" : ""}.${promoLine}`,
      okText: "Approve & Aktifkan",
      onOk: async () => {
        try {
          const durationDays = Number(
            t.tier === "vip"
              ? this.settings.vipDurationDays || 365
              : this.settings.premiumDurationDays || 180
          );
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + durationDays);

          const userSnap = await DBDb().doc(`users/${t.userId}`).get();
          const u = userSnap.exists ? userSnap.data() : null;
          const upd = { membership: t.tier, membershipExpiry: firebase.firestore.Timestamp.fromDate(expiry) };
          if (t.type === "join") {
            if (t.discordId) upd.discordId = t.discordId;
          }
          if (t.tier === "vip") {
            const quota = Number(this.settings.vipMentoringQuota || 5);
            const baseUsed = (u && t.type === "upgrade" ? u.mentoringUsed || 0 : 0);
            upd.mentoringQuota = quota;
            upd.mentoringUsed = baseUsed;
          }
          await dbUpdate(`users/${t.userId}`, upd);
          await updateTransaction(id, { status: "approved" });
          if (t.promoCode) {
            const promo = this.promos.find((x) => x.code === t.promoCode && x.active !== false);
            if (promo) await incrementPromoUsed(promo.id);
          }
          Toast.show("Pembayaran disetujui. User sekarang punya akses Discord!", "success");
          await this.renderTransactions();
        } catch (e) {
          Toast.show("Gagal: " + e.message, "error");
        }
      },
    });
  },

  rejectTx(id) {
    Modal.prompt({
      title: "❌ Tolak Pembayaran",
      fields: [{ label: "Alasan Penolakan (dikirim ke user)", type: "textarea", value: "Bukti pembayaran tidak valid / tidak terbaca. Silakan upload ulang." }],
      okText: "Tolak",
      onOk: async ([reason], done, fail) => {
        try {
          await updateTransaction(id, { status: "rejected", note: reason });
          Toast.show("Pembayaran ditolak dan user diberi tahu.", "info");
          done();
          await this.renderTransactions();
        } catch (e) {
          fail(e.message);
        }
      },
    });
  },

  /* ============ MANAGE MENTORING ============ */
  async renderMentoring() {
    const el = document.getElementById("admin-mentoring-content");
    this.mentorings = await getAllMentorings();
    const active = this.mentorings.filter((m) => ["waiting_schedule", "scheduled", "reschedule_requested", "rescheduled"].includes(m.status));

    el.innerHTML = `
      ${active.length ? `<div class="info-box warn mb-2">📅 <b>${active.length}</b> mentoring membutuhkan tindakan.</div>` : ""}
      <div class="table-wrap"><table>
        <tr><th>User</th><th>Status</th><th>Jadwal</th><th>Catatan</th><th>Approve</th><th>Aksi</th></tr>
        ${this.mentorings.map((m) => `
          <tr>
            <td class="small"><b>${Helpers.esc(m.userName || "-")}</b><br/>${Helpers.esc(m.userEmail || "")}</td>
            <td>${Helpers.statusBadge(m.status)}${m.rescheduleCount > 0 ? '<div class="small muted mt-1">🔄 Reschedule: ' + m.rescheduleCount + "/1</div>" : ""}</td>
            <td class="small">${m.proposedDate ? `<b>${Helpers.esc(m.proposedDate)}</b>` : "Belum ada"}</td>
            <td class="small" style="max-width:220px">${Helpers.esc(m.userNote || "-")}${m.rescheduleReason ? `<div class="mt-1" style="color:var(--warning)">💬 Alasan member: ${Helpers.esc(m.rescheduleReason)}</div>` : ""}${m.teacherReason ? `<div class="mt-1 muted">💬 Pesan admin: ${Helpers.esc(m.teacherReason)}</div>` : ""}</td>
            <td class="small">👤 User: ${m.userApproved ? "✅" : "⏳"}<br/>🧑‍🏫 Pengajar: ${m.teacherApproved ? "✅" : "⏳"}</td>
            <td style="white-space:nowrap">
              ${m.status === "waiting_schedule" || m.status === "reschedule_requested"
                ? `<button class="btn btn-primary btn-sm" onclick="AdminDash.setSchedule('${m.id}')">📅 Atur Jadwal</button>`
                : ""}
              ${m.status === "scheduled" || m.status === "rescheduled"
                ? `<button class="btn btn-outline btn-sm" onclick="AdminDash.teacherReschedule('${m.id}')">🔄 Reschedule</button>`
                : ""}
              <button class="btn btn-ghost btn-sm" onclick="AdminDash.deleteMentoring('${m.id}')">🗑️</button>
            </td>
          </tr>`).join("")}
      </table></div>`;
  },

  setSchedule(id) {
    const m = this.mentorings.find((x) => x.id === id);
    Modal.prompt({
      title: `📅 Atur Jadwal Mentoring — ${m ? Helpers.esc(m.userName) : ""}`,
      fields: [
        { label: "Tanggal & Jam Sesi", type: "datetime-local" },
        { label: `Pesan ke member${m && m.status === "reschedule_requested" ? " (kenapa jadwal diganti)" : ""}`, type: "textarea", value: "", required: false },
      ],
      okText: "Simpan Jadwal",
      onOk: async ([dt, msg], done, fail) => {
        try {
          const wasReschedule = m && m.status === "reschedule_requested";
          const newStatus = wasReschedule ? "rescheduled" : "scheduled";
          const upd = { proposedDate: dt, teacherApproved: true, status: newStatus };
          if (msg) upd.teacherReason = msg;
          if (wasReschedule) upd.rescheduleCount = (m.rescheduleCount || 0) + 0; // count sudah bertambah saat member request
          await updateMentoring(id, upd);
          Toast.show("Jadwal terkirim ke member. Menunggu approve member.", "success");
          done();
          await this.renderMentoring();
        } catch (e) {
          fail(e.message);
        }
      },
    });
  },

  teacherReschedule(id) {
    const m = this.mentorings.find((x) => x.id === id);
    Modal.prompt({
      title: "🔄 Reschedule Jadwal (Admin)",
      fields: [
        { label: "Jadwal Baru", type: "datetime-local" },
        { label: "Pesan kenapa admin reschedule", type: "textarea", value: "Mohon maaf, jadwal diganti karena ada kendala dari pengajar." },
      ],
      okText: "Simpan Reschedule",
      onOk: async ([dt, msg], done, fail) => {
        try {
          await updateMentoring(id, { proposedDate: dt, teacherReason: msg, status: "rescheduled", teacherApproved: true });
          Toast.show("Jadwal baru terkirim ke member.", "success");
          done();
          await this.renderMentoring();
        } catch (e) {
          fail(e.message);
        }
      },
    });
  },

  deleteMentoring(id) {
    Modal.confirm({
      title: "🗑️ Batalkan Mentoring",
      message: "Batalkan request mentoring ini? Jatah member tidak akan berkurang.",
      okText: "Batalkan",
      danger: true,
      onOk: async () => {
        await updateMentoring(id, { status: "cancelled" });
        Toast.show("Mentoring dibatalkan.", "info");
        await this.renderMentoring();
      },
    });
  },

  /* ============ CRUD CONTENT ============ */
  renderContent() {
    const el = document.getElementById("admin-content-content");
    const c = this.content || {};
    const F = (key, label, type = "text") => {
      const v = c[key];
      return [key, label, type, Array.isArray(v) ? v.join("\n") : v];
    };
    const groups = [
      ["🎬 Hero Section", [
        F("heroBadge", "Badge Hero"),
        F("heroTitle", "Judul Hero (boleh HTML)", "textarea"),
        F("heroSub", "Sub Judul Hero", "textarea"),
        F("heroBtn1", "Teks Tombol Utama (Daftar)"),
        F("heroBtn2", "Teks Tombol Kedua (Lihat Paket)"),
        F("heroStat2Value", "Nilai Stat 1"),
        F("heroStat2Label", "Label Stat 1"),
        F("heroStat3Value", "Nilai Stat 2"),
        F("heroStat3Label", "Label Stat 2"),
      ]],
      ["🏷️ Judul Section (boleh HTML)", [
        F("tentangTitle", "Judul 'Tentang LP'"),
        F("kenapaTitle", "Judul 'Kenapa Belajar'"),
        F("pengajarTitle", "Judul 'Pengajar'"),
        F("pengajarPnlHeading", "Judul Galeri PNL"),
        F("materiTitle", "Judul 'Materi'"),
        F("joinTitle", "Judul 'Join Member'"),
        F("legalTitle", "Judul 'Informasi Penting'"),
        F("legalTermsHeading", "Judul Daftar S&K (boleh HTML)"),
        F("kontakTitle", "Judul 'Kontak'"),
      ]],
      ["⚔️ Perbandingan Trading VS LP", [
        F("vsBadTitle", "Judul Kartu 'Trading Biasa'"),
        F("vsBadText", "Teks Kartu 'Trading Biasa'", "textarea"),
        F("vsBadge", "Teks Badge VS"),
        F("vsGoodTitle", "Judul Kartu 'Jadi LP'"),
        F("vsGoodText", "Teks Kartu 'Jadi LP'", "textarea"),
        F("mediaCaption", "Caption Media VS"),
      ]],
      ["💎 Kartu 'Kenapa Belajar' (4 Kartu)", [
        F("kenapa1Title", "Kartu 1 — Judul"),
        F("kenapa1Text", "Kartu 1 — Teks"),
        F("kenapa2Title", "Kartu 2 — Judul"),
        F("kenapa2Text", "Kartu 2 — Teks"),
        F("kenapa3Title", "Kartu 3 — Judul"),
        F("kenapa3Text", "Kartu 3 — Teks"),
        F("kenapa4Title", "Kartu 4 — Judul"),
        F("kenapa4Text", "Kartu 4 — Teks"),
      ]],
      ["📚 Kartu 'Materi' (6 Kartu)", [
        F("materi1Title", "Materi 1 — Judul"),
        F("materi1Text", "Materi 1 — Teks"),
        F("materi2Title", "Materi 2 — Judul"),
        F("materi2Text", "Materi 2 — Teks"),
        F("materi3Title", "Materi 3 — Judul"),
        F("materi3Text", "Materi 3 — Teks"),
        F("materi4Title", "Materi 4 — Judul"),
        F("materi4Text", "Materi 4 — Teks"),
        F("materi5Title", "Materi 5 — Judul"),
        F("materi5Text", "Materi 5 — Teks"),
        F("materi6Title", "Materi 6 — Judul"),
        F("materi6Text", "Materi 6 — Teks"),
      ]],
      ["📜 Informasi Penting (Kartu Legal)", [
        F("legalSyaratTitle", "S&K — Judul"),
        F("legalSyaratDesc", "S&K — Deskripsi"),
        F("legalRefundTitle", "Refund — Judul"),
        F("legalRefundDesc", "Refund — Deskripsi"),
        F("legalRisikoTitle", "Disclaimer Risiko — Judul"),
        F("legalRisikoDesc", "Disclaimer Risiko — Deskripsi"),
      ]],
      ["👨‍🌾 Pengajar", [
        F("pengajarSub", "Sub Judul Pengajar (boleh HTML)", "textarea"),
        F("pengajarName", "Nama Pengajar"),
        F("pengajarBio", "Bio Pengajar (boleh HTML)", "textarea"),
      ]],
      ["✍️ Deskripsi Section Lain", [
        F("tentangSub", "Deskripsi Tentang LP", "textarea"),
        F("kenapaSub", "Deskripsi Kenapa Harus Belajar", "textarea"),
        F("materiSub", "Deskripsi Materi"),
        F("joinSub", "Sub Judul Join Member", "textarea"),
        F("kontakSub", "Sub Judul Kontak"),
      ]],
      ["📞 Kontak & Footer", [
        F("kontakDiscordLabel", "Label Kontak Discord"),
        F("kontakDiscordUrl", "Link Discord"),
        F("kontakEmailLabel", "Label Kontak Email"),
        F("kontakEmailAddress", "Alamat Email"),
        F("kontakTelegramLabel", "Label Kontak Telegram"),
        F("kontakTelegramUrl", "Link Telegram"),
        F("footerTagline", "Teks Footer (tagline)", "textarea"),
        F("footerBottom", "Teks Copyright Footer"),
      ]],
      ["💸 Benefit Paket", [
        F("benefitsPremium", "Benefit Paket Premium (satu per baris)", "textarea"),
        F("benefitsVIP", "Benefit Paket VIP (satu per baris)", "textarea"),
      ]],
    ];
    const mediaRow = (key, label, accept, isVideo) => `
      <div class="flex mb-2" style="align-items:center;gap:0.8rem;flex-wrap:wrap">
        <div style="min-width:120px">
          <b>${label}</b>
          <div class="small muted">Upload langsung (bukan link URL)</div>
        </div>
        ${c[key]
          ? isVideo
            ? `<video src="${c[key]}" controls style="max-width:220px;max-height:64px;border:1px solid var(--border);border-radius:8px"></video>`
            : `<img src="${c[key]}" style="height:48px;border:1px solid var(--border);border-radius:8px;padding:2px;background:#fff" />`
          : `<span class="small muted">Belum ada media</span>`}
        <input type="file" id="c-media-${key}" accept="${accept}" />
        <button class="btn btn-outline btn-sm" onclick="AdminDash.uploadContentMedia('${key}')">⬆️ Upload</button>
        ${c[key] ? `<button class="btn btn-danger btn-sm" onclick="AdminDash.deleteContentMedia('${key}')">🗑️ Hapus</button>` : ""}
      </div>`;
    el.innerHTML = `
      <div class="card mb-2">
        <h3 class="mb-1">🖼️ Logo Website</h3>
        <div class="flex">
          ${c.logoUrl
            ? `<img id="logo-preview" src="${c.logoUrl}" style="height:48px;border:1px solid var(--border);border-radius:8px;padding:4px;background:#fff" />`
            : `<div class="muted small">Tanpa logo — navbar hanya menampilkan teks "LPTANI".</div>`}
          <input type="file" id="logo-file" accept="image/*" />
          <button class="btn btn-outline btn-sm" onclick="AdminDash.uploadLogo()">Upload Logo</button>
          ${c.logoUrl ? `<button class="btn btn-danger btn-sm" onclick="AdminDash.deleteLogo()">🗑️ Hapus Logo</button>` : ""}
        </div>
        <div class="hint mt-1">Fleksibel: bisa pakai logo gambar atau tanpa logo (teks saja). Upload untuk mengganti, hapus untuk kembali ke teks. Maksimal 1,2 MB.</div>
      </div>
      <div class="card mb-2">
        <h3 class="mb-2">🖼️ Gambar & Video Konten</h3>
        <div class="hint mb-2">Batas ukuran: gambar maksimal 1,2 MB, video maksimal 4,5 MB.</div>
        ${mediaRow("vsImageUrl", "Gambar Trading Manual (VS)", "image/*", false)}
        ${mediaRow("videoUrl", "Video LP (mp4)", "video/*", true)}
        <div class="hint">File tersimpan di Cloudinary. Tombol 🗑️ Hapus menghapus media dari website; file di Cloudinary perlu dihapus manual lewat Cloudinary Console → Media Library (folder lptani/content).</div>
      </div>
      <div class="card">
        <h3 class="mb-2">📝 Isi Konten Landing</h3>
        <form onsubmit="return AdminDash.saveContent(event)">
          ${groups.map(([title, rows]) => `
            <h4 class="mb-1" style="color:var(--accent)">${title}</h4>
            ${rows.map(([key, label, type, val]) => `
              <div class="form-group">
                <label>${label}</label>
                ${type === "textarea"
                  ? `<textarea id="c-${key}">${Helpers.esc(val || "")}</textarea>`
                  : `<input type="text" id="c-${key}" value="${Helpers.esc(val || "")}" />`}
              </div>`).join("")}
            <hr style="margin:1rem 0;border:none;border-top:1px dashed var(--border)" />`).join("")}
          <button class="btn btn-primary" type="submit">💾 Simpan Konten</button>
        </form>
      </div>`;
  },

  async uploadContentMedia(key) {
    const f = document.getElementById(`c-media-${key}`).files[0];
    if (!f) {
      Toast.show("Pilih file dulu.", "info");
      return;
    }
    const isVideo = key === "videoUrl";
    if (isVideo && !f.type.startsWith("video/")) {
      Toast.show("Pilih file video (MP4).", "error");
      return;
    }
    if (!isVideo && !f.type.startsWith("image/")) {
      Toast.show("Pilih file gambar (JPG/PNG).", "error");
      return;
    }
    const maxSize = isVideo ? 4.5 * 1024 * 1024 : 1.2 * 1024 * 1024;
    if (f.size > maxSize) {
      Toast.show(`Ukuran ${isVideo ? "video" : "gambar"} maksimal ${isVideo ? "4,5 MB" : "1,2 MB"}.`, "error");
      return;
    }
    try {
      Toast.show("Uploading...", "info", 3000);
      const up = await uploadFile(f, "content");
      const metaKey = key + "Meta";
      await saveContent({ [key]: up.url, [metaKey]: { publicId: up.publicId, deleteToken: up.deleteToken } });
      this.content[key] = up.url;
      this.content[metaKey] = { publicId: up.publicId, deleteToken: up.deleteToken };
      Toast.show("Media terupload!", "success");
      await this.renderContent();
      await Landing.render();
    } catch (e) {
      Toast.show("Gagal upload: " + e.message, "error");
    }
  },

  deleteContentMedia(key) {
    const labels = {
      vsImageUrl: "Gambar Trading Manual (VS)",
      videoUrl: "Video LP",
    };
    Modal.confirm({
      title: `🗑️ Hapus ${labels[key] || "Media"}`,
      message: "Media ini akan dihapus dari website. Lanjutkan?",
      okText: "Hapus",
      danger: true,
      onOk: async () => {
        try {
          const metaKey = key + "Meta";
          const r = await deleteCloudinaryFile(this.content[metaKey]);
          await saveContent({ [key]: "", [metaKey]: null });
          this.content[key] = "";
          this.content[metaKey] = null;
          Toast.show(
            r.ok
              ? "Media dihapus (file juga dihapus dari Cloudinary)."
              : "Media dihapus dari web. File di Cloudinary tetap ada — hapus manual di Cloudinary Console (folder lptani/content).",
            "info",
            r.ok ? 4000 : 7000
          );
          await this.renderContent();
          await Landing.render();
        } catch (e) {
          Toast.show("Gagal: " + e.message, "error");
        }
      },
    });
  },

  async uploadLogo() {
    const f = document.getElementById("logo-file").files[0];
    if (!f) {
      Toast.show("Pilih file logo dulu.", "info");
      return;
    }
    if (f.size > 1.2 * 1024 * 1024) {
      Toast.show("Ukuran gambar maksimal 1,2 MB.", "error");
      return;
    }
    try {
      const up = await uploadFile(f, "content");
      await saveContent({ logoUrl: up.url, logoMeta: { publicId: up.publicId, deleteToken: up.deleteToken } });
      this.content.logoUrl = up.url;
      this.content.logoMeta = { publicId: up.publicId, deleteToken: up.deleteToken };
      Toast.show("Logo terupload!", "success");
      await this.renderContent();
      await Landing.render();
    } catch (e) {
      Toast.show("Gagal upload: " + e.message, "error");
    }
  },

  deleteLogo() {
    Modal.confirm({
      title: "🗑️ Hapus Logo Website",
      message: "Logo akan dihapus dan navbar hanya menampilkan teks LPTANI. Website tetap jalan normal tanpa logo. Lanjutkan?",
      okText: "Hapus Logo",
      danger: true,
      onOk: async () => {
        try {
          const r = await deleteCloudinaryFile(this.content.logoMeta);
          await saveContent({ logoUrl: "", logoMeta: null });
          this.content.logoUrl = "";
          this.content.logoMeta = null;
          Toast.show(
            r.ok
              ? "Logo dihapus (file juga dihapus dari Cloudinary)."
              : "Logo dihapus dari web. File di Cloudinary tetap ada — hapus manual di Cloudinary Console (folder lptani/content).",
            "info",
            r.ok ? 4000 : 7000
          );
          await this.renderContent();
          await Landing.render();
        } catch (e) {
          Toast.show("Gagal: " + e.message, "error");
        }
      },
    });
  },

  async saveContent(e) {
    e.preventDefault();
    const ARRAY_KEYS = ["benefitsPremium", "benefitsVIP"];
    const keys = [
      "heroBadge", "heroTitle", "heroSub", "heroBtn1", "heroBtn2",
      "heroStat2Value", "heroStat2Label", "heroStat3Value", "heroStat3Label",
      "tentangTitle", "tentangSub",
      "vsBadTitle", "vsBadText", "vsBadge", "vsGoodTitle", "vsGoodText", "mediaCaption",
      "kenapaTitle", "kenapaSub", "kenapa1Title", "kenapa1Text", "kenapa2Title", "kenapa2Text",
      "kenapa3Title", "kenapa3Text", "kenapa4Title", "kenapa4Text",
      "pengajarTitle", "pengajarSub", "pengajarName", "pengajarBio", "pengajarPnlHeading",
      "materiTitle", "materiSub",
      "materi1Title", "materi1Text", "materi2Title", "materi2Text", "materi3Title", "materi3Text",
      "materi4Title", "materi4Text", "materi5Title", "materi5Text", "materi6Title", "materi6Text",
      "joinTitle", "joinSub", "benefitsPremium", "benefitsVIP",
      "legalTitle", "legalTermsHeading",
      "legalSyaratTitle", "legalSyaratDesc", "legalRefundTitle", "legalRefundDesc", "legalRisikoTitle", "legalRisikoDesc",
      "kontakTitle", "kontakSub",
      "kontakDiscordLabel", "kontakDiscordUrl", "kontakEmailLabel", "kontakEmailAddress",
      "kontakTelegramLabel", "kontakTelegramUrl",
      "footerTagline", "footerBottom",
    ];
    const data = {};
    keys.forEach((k) => {
      const el = document.getElementById(`c-${k}`);
      data[k] = el ? el.value : "";
    });
    // Benefit disimpan sebagai array (satu baris = satu benefit)
    ARRAY_KEYS.forEach((k) => {
      data[k] = (typeof data[k] === "string" ? data[k] : "").split("\n").map((s) => s.trim()).filter(Boolean);
    });
    await saveContent(data);
    this.content = { ...this.content, ...data };
    Toast.show("Konten tersimpan! Landing page terupdate.", "success");
    await Landing.render();
    return false;
  },

  /* ============ SYARAT & KETENTUAN ============ */
  async renderTerms() {
    const el = document.getElementById("admin-terms-content");
    this.terms = await getTerms();
    el.innerHTML = `
      <div class="flex mb-2">
        <button class="btn btn-primary btn-sm" onclick="AdminDash.addTermModal()">➕ Tambah Syarat</button>
      </div>
      ${this.terms.length
        ? this.terms.map((t, i) => `
          <div class="card mb-1">
            <div class="flex space-between">
              <h3>${i + 1}. ${Helpers.esc(t.title)}</h3>
              <div>
                <button class="btn btn-outline btn-sm" onclick="AdminDash.editTermModal('${t.id}')">✏️</button>
                ${i > 0 ? `<button class="btn btn-ghost btn-sm" onclick="AdminDash.moveTerm('${t.id}',-1)">⬆️</button>` : ""}
                ${i < this.terms.length - 1 ? `<button class="btn btn-ghost btn-sm" onclick="AdminDash.moveTerm('${t.id}',1)">⬇️</button>` : ""}
                <button class="btn btn-danger btn-sm" onclick="AdminDash.deleteTerm('${t.id}')">🗑️</button>
              </div>
            </div>
            <p class="muted mt-1" style="white-space:pre-line">${Helpers.esc(t.content)}</p>
          </div>`).join("")
        : `<div class="info-box">Belum ada syarat & ketentuan. Tambahkan di sini (akan tampil di landing page).</div>`}`;
  },

  addTermModal() {
    Modal.prompt({
      title: "➕ Tambah Syarat & Ketentuan",
      fields: [
        { label: "Judul", type: "text", value: "" },
        { label: "Isi", type: "textarea", value: "" },
      ],
      okText: "Simpan",
      onOk: async ([title, content], done, fail) => {
        try {
          await addTerm({ title, content, order: this.terms.length });
          Toast.show("Syarat ditambahkan.", "success");
          done();
          await this.renderTerms();
        } catch (e) {
          fail(e.message);
        }
      },
    });
  },

  editTermModal(id) {
    const t = this.terms.find((x) => x.id === id);
    Modal.prompt({
      title: "✏️ Edit Syarat",
      fields: [
        { label: "Judul", type: "text", value: t.title },
        { label: "Isi", type: "textarea", value: t.content },
      ],
      okText: "Simpan",
      onOk: async ([title, content], done, fail) => {
        try {
          await updateTerm(id, { title, content });
          Toast.show("Syarat tersimpan.", "success");
          done();
          await this.renderTerms();
        } catch (e) {
          fail(e.message);
        }
      },
    });
  },

  async moveTerm(id, dir) {
    const idx = this.terms.findIndex((x) => x.id === id);
    const other = this.terms[idx + dir];
    if (!other) return;
    await updateTerm(id, { order: other.order });
    await updateTerm(other.id, { order: this.terms[idx].order });
    await this.renderTerms();
  },

  deleteTerm(id) {
    Modal.confirm({
      title: "🗑️ Hapus Syarat",
      message: "Hapus syarat & ketentuan ini?",
      okText: "Hapus",
      danger: true,
      onOk: async () => {
        await deleteTerm(id);
        Toast.show("Syarat dihapus.", "info");
        await this.renderTerms();
      },
    });
  },

  /* ============ PNL IMAGE & VIDEO ============ */
  async renderPnl() {
    const el = document.getElementById("admin-pnl-content");
    this.pnl = await getPnlMedia();
    el.innerHTML = `
      <div class="card mb-2">
        <h3 class="mb-1">➕ Tambah PNL Image / Video</h3>
        <div class="grid-2">
          <div class="form-group">
            <label>Upload File (gambar/video)</label>
            <input type="file" id="pnl-file" accept="image/*,video/*" />
            <div class="hint">Batas ukuran: gambar 1,2 MB, video 4,5 MB.</div>
          </div>
          <div class="form-group">
            <label>Judul / Caption</label>
            <input type="text" id="pnl-title" placeholder="Contoh: PNL bulan ini" />
          </div>
        </div>
        <button class="btn btn-primary" onclick="AdminDash.uploadPnl()">Upload PNL</button>
      </div>
      <div class="pnl-gallery">
        ${this.pnl.map((m) => `
          <div class="pnl-item">
            ${m.type === "video"
              ? `<video controls preload="none"><source src="${m.url}" type="video/mp4" /></video>`
              : `<img class="pnl-thumb" src="${m.url}" alt="${Helpers.esc(m.title || "PNL")}" loading="lazy" data-lightbox data-caption="${Helpers.esc(m.title || "")}" />`}
            <div class="pnl-caption flex space-between">
              <span>${Helpers.esc(m.title || "Hasil PNL Asli Pengajar")}</span>
              <button class="btn btn-danger btn-sm" onclick="AdminDash.deletePnl('${m.id}')">🗑️</button>
            </div>
          </div>`).join("") || '<div class="info-box">Belum ada media PNL.</div>'}
      </div>`;
  },

  async uploadPnl() {
    const f = document.getElementById("pnl-file").files[0];
    if (!f) {
      Toast.show("Pilih file dulu.", "info");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      Toast.show("Maksimal 50MB.", "error");
      return;
    }
    const isVideo = f.type.startsWith("video/");
    const maxSize = isVideo ? 4.5 * 1024 * 1024 : 1.2 * 1024 * 1024;
    if (f.size > maxSize) {
      Toast.show(`Ukuran ${isVideo ? "video" : "gambar"} maksimal ${isVideo ? "4,5 MB" : "1,2 MB"}.`, "error");
      return;
    }
    try {
      Toast.show("Uploading... (video besar butuh waktu)", "info", 3000);
      const up = await uploadFile(f, "pnl");
      await addPnlMedia({
        url: up.url,
        meta: { publicId: up.publicId, deleteToken: up.deleteToken },
        title: document.getElementById("pnl-title").value.trim(),
        type: isVideo ? "video" : "image",
      });
      Toast.show("PNL media ditambahkan!", "success");
      await this.renderPnl();
      await Landing.render();
    } catch (e) {
      Toast.show("Gagal upload: " + e.message, "error");
    }
  },

  deletePnl(id) {
    const m = (this.pnl || []).find((x) => x.id === id);
    Modal.confirm({
      title: "🗑️ Hapus Media PNL",
      message: "Hapus media ini dari website?",
      okText: "Hapus",
      danger: true,
      onOk: async () => {
        const r = await deleteCloudinaryFile(m && m.meta);
        await deletePnlMedia(id);
        Toast.show(
          r.ok
            ? "Media dihapus (file juga dihapus dari Cloudinary)."
            : "Media dihapus dari web. File di Cloudinary tetap ada — hapus manual di Cloudinary Console (folder lptani/pnl).",
          "info",
          r.ok ? 4000 : 7000
        );
        await this.renderPnl();
        await Landing.render();
      },
    });
  },

  /* ============ METODE PEMBAYARAN ============ */
  async renderPaymentMethods() {
    const el = document.getElementById("admin-pm-content");
    this.paymentMethods = await getPaymentMethods();
    el.innerHTML = `
      <div class="card mb-2">
        <h3 class="mb-1">➕ Tambah Metode Pembayaran</h3>
        <div class="grid-3">
          <div class="form-group"><label>Nama Bank</label><input type="text" id="pm-bank" placeholder="BCA / Mandiri / DANA..." /></div>
          <div class="form-group"><label>Nama Penerima</label><input type="text" id="pm-name" placeholder="a.n. LP Tani" /></div>
          <div class="form-group"><label>Nomor Rekening</label><input type="text" id="pm-number" placeholder="1234567890" /></div>
        </div>
        <button class="btn btn-primary" onclick="AdminDash.addPm()">➕ Simpan</button>
      </div>
      <div class="grid-3">
        ${this.paymentMethods.map((p) => `
          <div class="card">
            <div class="flex space-between">
              <h3>🏦 ${Helpers.esc(p.bankName)}</h3>
              ${p.active !== false ? '<span class="badge badge-approved">Aktif</span>' : '<span class="badge badge-expired">Nonaktif</span>'}
            </div>
            <p class="mt-1">a.n. <b>${Helpers.esc(p.accountName)}</b></p>
            <p style="letter-spacing:0.05em;font-weight:700">${Helpers.esc(p.accountNumber)}</p>
            <div class="flex mt-2">
              <button class="btn btn-outline btn-sm" onclick="AdminDash.togglePm('${p.id}',${p.active === false})">${p.active === false ? "Aktifkan" : "Nonaktifkan"}</button>
              <button class="btn btn-danger btn-sm" onclick="AdminDash.deletePm('${p.id}')">🗑️</button>
            </div>
          </div>`).join("") || '<div class="info-box">Belum ada metode pembayaran.</div>'}
      </div>`;
  },

  addPm() {
    const bank = document.getElementById("pm-bank").value.trim();
    const name = document.getElementById("pm-name").value.trim();
    const number = document.getElementById("pm-number").value.trim();
    if (!bank || !name || !number) {
      Toast.show("Semua field wajib diisi.", "error");
      return;
    }
    addPaymentMethod({ bankName: bank, accountName: name, accountNumber: number }).then(async () => {
      Toast.show("Metode pembayaran ditambahkan.", "success");
      await this.renderPaymentMethods();
    });
  },

  async togglePm(id, activate) {
    await updatePaymentMethod(id, { active: activate });
    Toast.show(activate ? "Metode diaktifkan." : "Metode dinonaktifkan.", "info");
    await this.renderPaymentMethods();
  },

  deletePm(id) {
    Modal.confirm({
      title: "🗑️ Hapus Metode Pembayaran",
      message: "Hapus metode pembayaran ini?",
      okText: "Hapus",
      danger: true,
      onOk: async () => {
        await deletePaymentMethod(id);
        Toast.show("Metode dihapus.", "info");
        await this.renderPaymentMethods();
      },
    });
  },

  /* ============ PROMO / VOUCHER ============ */
  async renderPromos() {
    const el = document.getElementById("admin-promo-content");
    this.promos = await getPromos();
    el.innerHTML = `
      <div class="card mb-2">
        <h3 class="mb-1">➕ Tambah Kode Promo</h3>
        <div class="grid-2">
          <div class="form-group">
            <label>Kode Promo</label>
            <input type="text" id="promo-code" placeholder="Contoh: LPTANI10" style="text-transform:uppercase" />
            <div class="hint">User memasukkan kode ini di form Join Member (boleh kosong bagi user yang tidak pakai promo).</div>
          </div>
          <div class="form-group">
            <label>Tipe Diskon</label>
            <select id="promo-type">
              <option value="percent">Persen (%)</option>
              <option value="fixed">Potongan Tetap (Rp)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Nilai Diskon</label>
            <input type="number" id="promo-value" min="1" placeholder="10" />
            <div class="hint">Persen: 1–99. Potongan tetap: angka Rupiah (bila melebihi harga, total jadi Rp 0).</div>
          </div>
          <div class="form-group">
            <label>Limit Pemakaian</label>
            <input type="number" id="promo-limit" min="1" placeholder="50" />
            <div class="hint">Berapa kali kode ini boleh dipakai. Pemakaian terhitung saat admin <b>approve</b> pembayaran.</div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="AdminDash.addPromo()">➕ Simpan Promo</button>
      </div>
      <div class="grid-3">
        ${this.promos.map((p) => {
          const used = Number(p.usedCount || 0);
          const limit = Number(p.usageLimit || 0);
          const left = Math.max(0, limit - used);
          const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
          const habis = p.active !== false && limit > 0 && left <= 0;
          return `
          <div class="card">
            <div class="flex space-between">
              <h3 style="letter-spacing:0.05em">🎟️ ${Helpers.esc(p.code)}</h3>
              ${p.active !== false ? (habis ? '<span class="badge badge-rejected">Kuota Habis</span>' : '<span class="badge badge-approved">Aktif</span>') : '<span class="badge badge-expired">Nonaktif</span>'}
            </div>
            <p class="mt-1">Diskon: <b>${p.type === "fixed" ? Helpers.fmtIDR(p.value) : Number(p.value) + "%"}</b></p>
            <p class="small muted mt-1">Terpakai: <b>${used}</b> / ${limit}${p.active !== false && !habis ? ` (sisa <b style="color:var(--neon-dark)">${left}</b>)` : ""}</p>
            <div class="quota-bar"><div class="quota-fill" style="width:${pct}%"></div></div>
            <div class="flex mt-2">
              <button class="btn btn-outline btn-sm" onclick="AdminDash.togglePromo('${p.id}',${p.active === false})">${p.active === false ? "Aktifkan" : "Nonaktifkan"}</button>
              <button class="btn btn-outline btn-sm" onclick="AdminDash.editPromoModal('${p.id}')">✏️ Edit</button>
              <button class="btn btn-danger btn-sm" onclick="AdminDash.deletePromo('${p.id}')">🗑️</button>
            </div>
          </div>`;
        }).join("") || '<div class="info-box">Belum ada kode promo. Tambahkan di atas.</div>'}
      </div>`;
  },

  async addPromo() {
    const code = document.getElementById("promo-code").value.trim().toUpperCase();
    const type = document.getElementById("promo-type").value;
    const value = Number(document.getElementById("promo-value").value);
    const limit = Number(document.getElementById("promo-limit").value);
    if (!code || code.length < 3) {
      Toast.show("Kode promo wajib diisi, minimal 3 karakter.", "error");
      return;
    }
    if (!value || value <= 0) {
      Toast.show("Nilai diskon wajib diisi (lebih dari 0).", "error");
      return;
    }
    if (type === "percent" && value > 99) {
      Toast.show("Diskon persen maksimal 99%.", "error");
      return;
    }
    if (!limit || limit <= 0) {
      Toast.show("Limit pemakaian wajib diisi (minimal 1).", "error");
      return;
    }
    try {
      const dup = await getPromoByCode(code);
      if (dup) {
        Toast.show(`Kode ${code} sudah ada. Pakai kode lain.`, "error");
        return;
      }
      await addPromo({ code, type, value, usageLimit: limit });
      Toast.show("Kode promo ditambahkan!", "success");
      await this.renderPromos();
    } catch (e) {
      Toast.show("Gagal: " + e.message, "error");
    }
  },

  editPromoModal(id) {
    const p = this.promos.find((x) => x.id === id);
    if (!p) return;
    Modal.prompt({
      title: `✏️ Edit Promo ${Helpers.esc(p.code)}`,
      fields: [
        { label: "Kode Promo", type: "text", value: p.code },
        { label: "Tipe Diskon", type: "select", value: p.type, options: [{ value: "percent", label: "Persen (%)" }, { value: "fixed", label: "Potongan Tetap (Rp)" }] },
        { label: "Nilai Diskon", type: "number", value: p.value },
        { label: "Limit Pemakaian", type: "number", value: p.usageLimit },
      ],
      okText: "Simpan",
      onOk: async ([code, type, value, limit], done, fail) => {
        code = String(code || "").trim().toUpperCase();
        value = Number(value);
        limit = Number(limit);
        if (!code || code.length < 3) return fail("Kode minimal 3 karakter.");
        if (!value || value <= 0) return fail("Nilai diskon wajib (> 0).");
        if (type === "percent" && value > 99) return fail("Diskon persen maksimal 99%.");
        if (!limit || limit <= 0) return fail("Limit minimal 1.");
        try {
          const dup = await getPromoByCode(code);
          if (dup && dup.id !== id) return fail(`Kode ${code} sudah dipakai promo lain.`);
          await updatePromo(id, { code, type, value, usageLimit: limit });
          Toast.show("Promo tersimpan.", "success");
          done();
          await this.renderPromos();
        } catch (e) {
          fail(e.message);
        }
      },
    });
  },

  async togglePromo(id, activate) {
    await updatePromo(id, { active: activate });
    Toast.show(activate ? "Promo diaktifkan." : "Promo dinonaktifkan.", "info");
    await this.renderPromos();
  },

  deletePromo(id) {
    const p = this.promos.find((x) => x.id === id);
    Modal.confirm({
      title: "🗑️ Hapus Kode Promo",
      message: `Hapus kode promo <b>${p ? Helpers.esc(p.code) : ""}</b>? Transaksi yang sudah memakai kode ini tidak berubah.`,
      okText: "Hapus",
      danger: true,
      onOk: async () => {
        await deletePromo(id);
        Toast.show("Kode promo dihapus.", "info");
        await this.renderPromos();
      },
    });
  },

  /* ============ PENGATURAN ============ */
  renderSettings() {
    const el = document.getElementById("admin-settings-content");
    const s = this.settings || {};
    el.innerHTML = `
      <div class="card mb-2">
        <h3 class="mb-1">🌱 Join Member</h3>
        <div class="grid-2">
          <div class="form-group">
            <label>Status Pendaftaran</label>
            <div class="flex">
              ${s.openRegistration !== false ? '<span class="badge badge-approved">🟢 OPEN</span>' : '<span class="badge badge-rejected">🔴 CLOSE</span>'}
              <button class="btn btn-outline btn-sm" onclick="AdminDash.toggleRegistration()">${s.openRegistration !== false ? "Tutup" : "Buka"}</button>
            </div>
            <div class="hint">Saat CLOSE, user tidak bisa join member baru.</div>
          </div>
          <div class="form-group">
            <label>Durasi Member Premium (hari)</label>
            <input type="number" id="set-duration-premium" value="${s.premiumDurationDays || 180}" min="1" />
          </div>
          <div class="form-group">
            <label>Durasi Member VIP (hari)</label>
            <input type="number" id="set-duration-vip" value="${s.vipDurationDays || 365}" min="1" />
            <div class="hint">Untuk akses seumur hidup, isi angka besar mis. 36500.</div>
          </div>
        </div>
      </div>
      <div class="card mb-2">
        <h3 class="mb-1">💰 Harga Member</h3>
        <div class="grid-2">
          <div class="form-group"><label>Harga Premium (Rp)</label><input type="number" id="set-premium" value="${s.premiumPrice || 0}" min="0" /></div>
          <div class="form-group"><label>Harga VIP (Rp)</label><input type="number" id="set-vip" value="${s.vipPrice || 0}" min="0" /></div>
        </div>
      </div>
      <div class="card mb-2">
        <h3 class="mb-1">💬 Discord</h3>
        <div class="form-group">
          <label>Link Invite Discord (ditampilkan ke member yang sudah bayar)</label>
          <input type="text" id="set-discord" value="${Helpers.esc(s.discordInviteLink || "")}" placeholder="https://discord.gg/..." />
        </div>
      </div>
      <div class="card mb-2">
        <h3 class="mb-1">🎓 Mentoring VIP</h3>
        <div class="form-group">
          <label>Jumlah Jatah Mentoring untuk Member VIP</label>
          <input type="number" id="set-quota" value="${s.vipMentoringQuota || 5}" min="0" max="99" />
        </div>
      </div>
      <button class="btn btn-primary" onclick="AdminDash.saveSettings()">💾 Simpan Pengaturan</button>`;
  },

  async saveSettings() {
    const data = {
      premiumDurationDays: Number(document.getElementById("set-duration-premium").value) || 180,
      vipDurationDays: Number(document.getElementById("set-duration-vip").value) || 365,
      premiumPrice: Number(document.getElementById("set-premium").value) || 0,
      vipPrice: Number(document.getElementById("set-vip").value) || 0,
      discordInviteLink: document.getElementById("set-discord").value.trim(),
      vipMentoringQuota: Number(document.getElementById("set-quota").value) || 5,
    };
    await saveSettings(data);
    this.settings = { ...this.settings, ...data };
    Toast.show("Pengaturan tersimpan!", "success");
    await Landing.render();
  },

  /* ============ PASSWORD ADMIN ============ */
  renderPassword() {
    const el = document.getElementById("admin-password-content");
    const email = DBAuth().currentUser ? DBAuth().currentUser.email : "-";
    el.innerHTML = `
      <div class="info-box">Gmail akun admin: <b>${Helpers.esc(email)}</b></div>
      <div class="grid-2">
        <div class="card">
          <h3 class="mb-1">🔑 Ganti Password</h3>
          <p class="muted small mb-2">Ganti password akun admin tanpa perlu login ulang.</p>
          <form onsubmit="return AdminDash.changePassword(event)">
            <div class="form-group">
              <label>Password Baru <span class="req">*</span></label>
              <input type="password" id="admin-new-pass" minlength="8" required />
            </div>
            <div class="form-group">
              <label>Ulangi Password Baru <span class="req">*</span></label>
              <input type="password" id="admin-new-pass2" minlength="8" required />
            </div>
            <div class="error-text" id="admin-pass-error"></div>
            <button class="btn btn-primary" type="submit">Simpan Password Baru</button>
          </form>
        </div>
        <div class="card">
          <h3 class="mb-1">📧 Lupa Password</h3>
          <p class="muted small mb-2">Kirim link reset password ke Gmail admin. Cek inbox/spam setelah dikirim.</p>
          <div class="form-group">
            <label>Gmail Admin</label>
            <input type="email" id="admin-forgot-email" value="${Helpers.esc(email)}" required />
          </div>
          <div class="error-text" id="admin-forgot-error"></div>
          <button class="btn btn-outline" id="admin-forgot-btn" onclick="AdminDash.sendResetLink()">📩 Kirim Link Reset</button>
        </div>
      </div>`;
  },

  async changePassword(e) {
    e.preventDefault();
    const errEl = document.getElementById("admin-pass-error");
    errEl.style.display = "none";
    const p1 = document.getElementById("admin-new-pass").value;
    const p2 = document.getElementById("admin-new-pass2").value;
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
      Toast.show("Password admin berhasil diganti! 🔑", "success");
      document.getElementById("admin-new-pass").value = "";
      document.getElementById("admin-new-pass2").value = "";
    } catch (err) {
      errEl.textContent = Auth.mapError(err);
      errEl.style.display = "block";
    }
    return false;
  },

  async sendResetLink() {
    const email = document.getElementById("admin-forgot-email").value.trim().toLowerCase();
    const errEl = document.getElementById("admin-forgot-error");
    errEl.style.display = "none";
    const btn = document.getElementById("admin-forgot-btn");
    if (!email) {
      errEl.textContent = "Isi Gmail admin dulu.";
      errEl.style.display = "block";
      return;
    }
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Mengirim...';
    try {
      await DBAuth().sendPasswordResetEmail(email);
      Toast.show("Link reset password terkirim ke " + email + ". Cek inbox/spam.", "success", 7000);
    } catch (err) {
      errEl.textContent = Auth.mapError(err);
      errEl.style.display = "block";
    }
    btn.disabled = false;
    btn.textContent = "📩 Kirim Link Reset";
  },
};
