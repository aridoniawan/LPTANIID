/* ============================================================
   LP TANI - Data Layer (Firestore + Cloudinary upload)
   ============================================================ */

let _firebaseReady = false;

async function initFirebase() {
  if (_firebaseReady) return true;
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    _firebaseReady = true;
    return true;
  } catch (e) {
    console.error("Firebase init error:", e);
    Helpers.setLoading(false);
    Toast.show("Konfigurasi Firebase belum diisi. Buka js/firebase-config.js", "error", 8000);
    return false;
  }
}

const DBAuth = () => firebase.auth();
const DBDb = () => firebase.firestore();

/* ============ Generic helpers ============ */
async function dbGet(path) {
  const snap = await DBDb().doc(path).get();
  return snap.exists ? snap.data() : null;
}
async function dbSet(path, data, merge = true) {
  await DBDb().doc(path).set(data, { merge });
}
async function dbUpdate(path, data) {
  await DBDb().doc(path).update(data);
}
async function dbDelete(path) {
  await DBDb().doc(path).delete();
}
async function dbAdd(collection, data) {
  const ref = await DBDb().collection(collection).add(data);
  return ref.id;
}

/* ============ Settings ============ */
async function getSettings() {
  return await dbGet("settings/global");
}
async function saveSettings(data) {
  await dbSet("settings/global", data);
}

/* ============ Users ============ */
async function ensureUserDoc(user, extra = {}) {
  const path = `users/${user.uid}`;
  const existing = await dbGet(path);
  if (!existing) {
    await dbSet(
      path,
      {
        uid: user.uid,
        email: user.email,
        name: extra.name || user.displayName || "",
        phone: extra.phone || "",
        role: "user",
        membership: "none",
        membershipExpiry: null,
        discordId: "",
        mentoringQuota: 0,
        mentoringUsed: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      false
    );
  } else {
    const upd = {};
    if (extra.name) upd.name = extra.name;
    if (extra.phone) upd.phone = extra.phone;
    if (Object.keys(upd).length) await dbUpdate(path, upd);
  }
  return await dbGet(path);
}
async function getCurrentUserData() {
  const u = DBAuth().currentUser;
  if (!u) return null;
  return await dbGet(`users/${u.uid}`);
}

/* ============ Transactions ============ */
async function createTransaction(data) {
  const d = {
    ...data,
    status: "pending",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  return await dbAdd("transactions", d);
}
async function getUserTransactions(uid) {
  const snap = await DBDb().collection("transactions").where("userId", "==", uid).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => _ts(b.createdAt) - _ts(a.createdAt));
}
async function getTransaction(id) {
  return await dbGet(`transactions/${id}`);
}
async function updateTransaction(id, data) {
  await dbUpdate(`transactions/${id}`, {
    ...data,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
async function getAllTransactions() {
  const snap = await DBDb().collection("transactions").orderBy("createdAt", "desc").limit(300).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function dbQueryUsers() {
  const snap = await DBDb().collection("users").orderBy("createdAt", "desc").limit(500).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ============ Payment Methods ============ */
async function getPaymentMethods(activeOnly = false) {
  let q = DBDb().collection("paymentMethods").orderBy("createdAt", "asc");
  const snap = await q.get();
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (activeOnly) list = list.filter((p) => p.active !== false);
  return list;
}
async function addPaymentMethod(data) {
  await DBDb().collection("paymentMethods").add({
    ...data,
    active: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
async function updatePaymentMethod(id, data) {
  await dbUpdate(`paymentMethods/${id}`, data);
}
async function deletePaymentMethod(id) {
  await dbDelete(`paymentMethods/${id}`);
}

/* ============ Promos / Voucher ============ */
async function getPromos() {
  const snap = await DBDb().collection("promos").orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function getPromoByCode(code) {
  const snap = await DBDb().collection("promos").where("code", "==", String(code || "").trim().toUpperCase()).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}
async function addPromo(data) {
  await DBDb().collection("promos").add({
    ...data,
    code: String(data.code || "").trim().toUpperCase(),
    usedCount: 0,
    active: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
async function updatePromo(id, data) {
  const d = { ...data };
  if (d.code) d.code = String(d.code).trim().toUpperCase();
  await dbUpdate(`promos/${id}`, d);
}
async function deletePromo(id) {
  await dbDelete(`promos/${id}`);
}
async function incrementPromoUsed(id) {
  await dbUpdate(`promos/${id}`, { usedCount: firebase.firestore.FieldValue.increment(1) });
}

/* ============ Mentoring ============ */
async function createMentoring(data) {
  return await DBDb().collection("mentorings").add({
    ...data,
    status: "waiting_schedule",
    userApproved: false,
    teacherApproved: false,
    rescheduleCount: 0,
    rescheduleReason: "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
async function getUserMentorings(uid) {
  const snap = await DBDb().collection("mentorings").where("userId", "==", uid).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => _ts(b.createdAt) - _ts(a.createdAt));
}

function _ts(ts) {
  if (!ts) return 0;
  return ts.toMillis ? ts.toMillis() : new Date(ts).getTime() || 0;
}
async function getAllMentorings() {
  const snap = await DBDb().collection("mentorings").orderBy("createdAt", "desc").limit(300).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function getMentoring(id) {
  return await dbGet(`mentorings/${id}`);
}
async function updateMentoring(id, data) {
  await dbUpdate(`mentorings/${id}`, data);
}
async function deleteMentoring(id) {
  await dbDelete(`mentorings/${id}`);
}

/* ============ Content ============ */
async function getContent() {
  return await dbGet("contents/site");
}
async function saveContent(data) {
  await dbSet("contents/site", data);
}

/* ============ Terms ============ */
async function getTerms() {
  const snap = await DBDb().collection("terms").orderBy("order", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function addTerm(data) {
  await DBDb().collection("terms").add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
}
async function updateTerm(id, data) {
  await dbUpdate(`terms/${id}`, data);
}
async function deleteTerm(id) {
  await dbDelete(`terms/${id}`);
}

/* ============ PNL Media ============ */
async function getPnlMedia() {
  // ASC: media yang pertama di-insert tampil paling awal di web
  const snap = await DBDb().collection("pnlMedia").orderBy("createdAt", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function addPnlMedia(data) {
  await DBDb().collection("pnlMedia").add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
}
async function deletePnlMedia(id) {
  await dbDelete(`pnlMedia/${id}`);
}

/* ============ Upload (Cloudinary unsigned) ============ */
const MAX_IMAGE_SIZE = 1.2 * 1024 * 1024; // 1,2 MB
const MAX_VIDEO_SIZE = 4.5 * 1024 * 1024; // 4,5 MB

async function uploadFile(file, folder) {
  if (file.type.startsWith("video/") && file.size > MAX_VIDEO_SIZE) {
    throw new Error("Ukuran video maksimal 4,5 MB.");
  }
  if (file.type.startsWith("image/") && file.size > MAX_IMAGE_SIZE) {
    throw new Error("Ukuran gambar maksimal 1,2 MB.");
  }
  const resourceType = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : "auto";
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  fd.append("folder", `lptani/${folder}`);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: fd,
  });
  const json = await res.json();
  if (!res.ok || !json.secure_url) {
    throw new Error(json.error && json.error.message ? json.error.message : "Upload gagal");
  }
  // publicId + deleteToken untuk hapus file nanti. Catatan: dengan upload UNSIGNED,
  // Cloudinary tidak mengembalikan delete_token (parameter return_delete_token ditolak).
  // deleteToken akan terisi bila suatu saat upload diganti ke signed (butuh fungsi server).
  return { url: json.secure_url, publicId: json.public_id || null, deleteToken: json.delete_token || null };
}

/* ============ Delete Cloudinary (token valid 10 menit; unsigned upload tidak dapat token) ============ */
async function deleteCloudinaryFile(meta) {
  if (!meta || !meta.publicId || !meta.deleteToken) {
    return { ok: false, reason: "expired" };
  }
  try {
    const fd = new FormData();
    fd.append("public_id", meta.publicId);
    fd.append("token", meta.deleteToken);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/delete_by_token`, {
      method: "POST",
      body: fd,
    });
    const json = await res.json();
    if (json.result === "ok") return { ok: true, reason: "" };
    return { ok: false, reason: "expired" };
  } catch (e) {
    return { ok: false, reason: "expired" };
  }
}

/* ============ Defaults / Seed ============ */
const DEFAULT_CONTENT = {
  logoUrl: "assets/logo.png",
  heroBadge: "🌱 Komunitas Belajar On-Chain #1",
  heroTitle: "Belajar Jadi <span class='gradient-text'>Liquidity Provider</span> di Robinhood",
  heroSub: "Belajar full di Discord bersama pengajar berpengalaman. Mulai dari nol sampai paham cara kerja Liquidity Pool on-chain di jaringan Robinhood — bahkan saat salah entry pun tetap untung.",
  heroBtn1: "🚀 Daftar Sekarang",
  heroBtn2: "Lihat Paket Member",
  heroStat2Value: "5x",
  heroStat2Label: "Mentoring VIP",
  heroStat3Value: "24/7",
  heroStat3Label: "Support Discord",
  tentangTitle: "Apa itu <span class='gradient-text'>Liquidity Provider</span>?",
  tentangSub: "Liquidity Provider (LP) adalah orang yang menyediakan likuiditas ke pool on-chain dan mendapatkan fee dari setiap transaksi. Berbeda dengan trading biasa yang hanya untung saat harga naik.",
  vsBadTitle: "Trading Biasa (Jual Beli Manual)",
  vsBadText: "Harus bisa tebak arah pasar. Salah entry = rugi. Stres pantau chart 24 jam, emosi naik turun, dan sering kena stop loss.",
  vsBadge: "VS",
  vsGoodTitle: "Jadi Liquidity Provider",
  vsGoodText: "Dapat fee dari setiap transaksi di pool. Bahkan saat harga bergerak melawan posisi, fee yang terkumpul bisa menutupi kerugian — salah entry pun tetap untung.",
  vsImageUrl: "assets/trading-manual.png",
  videoUrl: "",
  mediaCaption: "Perbandingan: trading manual vs menjadi Liquidity Provider — salah entry pun tetap untung.",
  kenapaTitle: "Kenapa Harus <span class='gradient-text'>Belajar Jadi LP?</span>",
  kenapaSub: "Jangan asal masuk pool tanpa ilmu. Tanpa pemahaman, kamu bisa rugi karena impermanent loss atau salah pilih pool.",
  kenapa1Title: "Passive Income",
  kenapa1Text: "Fee masuk otomatis dari setiap transaksi di pool — tanpa pantau chart 24 jam.",
  kenapa2Title: "Kelola Risiko",
  kenapa2Text: "Pahami impermanent loss & cara memilih pool yang aman.",
  kenapa3Title: "Ilmu Terstruktur",
  kenapa3Text: "Materi lengkap dari nol sampai mahir, dibimbing pengajar aktif.",
  kenapa4Title: "Komunitas Discord",
  kenapa4Text: "Diskusi & tanya jawab langsung di server Discord LP Tani.",
  pengajarTitle: "Kenalan dengan <span class='gradient-text'>Pengajar</span>",
  pengajarSub: "Belajar langsung dari praktisi dengan winrate <b>96–100%</b> di setiap sesi Liquidity Provider di Robinhood. Bukan janji — tapi bukti.",
  pengajarName: "🌾 LP Tani Team",
  pengajarBio: "Pengajar aktif di jaringan Robinhood dengan rekam jejak luar biasa: <b>winrate 96–100%</b> selama menjadi Liquidity Provider on-chain. Semua hasil nyata dan bisa kamu buktikan sendiri — lihat langsung bukti PNL asli pengajar di bawah ini.",
  pengajarPnlHeading: "📸 Bukti Hasil PNL Asli Pengajar",
  materiTitle: "Materi yang <span class='gradient-text'>Akan Diajarkan</span>",
  materiSub: "Kurikulum lengkap dari dasar sampai strategi lanjutan.",
  materi1Title: "Dasar Blockchain & On-Chain",
  materi1Text: "Pahami cara kerja jaringan, wallet, dan transaksi on-chain.",
  materi2Title: "Mengenal Jaringan Robinhood",
  materi2Text: "Ekosistem, token, dan peluang LP di jaringan Robinhood.",
  materi3Title: "Liquidity Pool & Fee",
  materi3Text: "Cara kerja pool, fee transaksi, dan bagaimana LP mendapat untung.",
  materi4Title: "Impermanent Loss",
  materi4Text: "Memahami dan mengelola risiko terbesar seorang LP.",
  materi5Title: "Strategi Entry & Exit",
  materi5Text: "Kapan masuk pool, kapan keluar, dan strategi compounding.",
  materi6Title: "Praktik Langsung",
  materi6Text: "Praktik bareng di Discord dengan bimbingan pengajar.",
  joinTitle: "Gabung Jadi <span class='gradient-text'>Member LP Tani</span>",
  joinSub: "Pilih paket yang sesuai kebutuhanmu. Semua pembelajaran dilakukan di Discord.",
  benefitsPremium: [
    "Akses server Discord LP Tani",
    "Semua materi belajar on-chain",
    "Diskusi & tanya jawab komunitas",
    "Update strategi dari pengajar",
  ],
  benefitsVIP: [
    "Semua benefit Premium",
    "5x mentoring 1-on-1 dengan pengajar",
    "Prioritas tanya jawab",
    "Review portfolio & strategi pribadi",
  ],
  legalTitle: "Informasi <span class='gradient-text'>Penting</span>",
  legalTermsHeading: "📜 <span class='gradient-text'>Syarat & Ketentuan Member</span>",
  legalSyaratTitle: "Syarat & Ketentuan",
  legalSyaratDesc: "Baca aturan lengkap sebelum bergabung menjadi member.",
  legalRefundTitle: "Kebijakan Refund",
  legalRefundDesc: "Pahami kebijakan pengembalian dana kami.",
  legalRisikoTitle: "Disclaimer Risiko",
  legalRisikoDesc: "Semua aktivitas on-chain memiliki risiko. Pahami sebelum bertransaksi.",
  kontakTitle: "Hubungi <span class='gradient-text'>Kami</span>",
  kontakSub: "Ada pertanyaan? Tim LP Tani siap membantu.",
  kontakDiscordLabel: "💬 Discord LP Tani",
  kontakDiscordUrl: "https://discord.gg/lptani",
  kontakEmailLabel: "✉️ admin@lptani.id",
  kontakEmailAddress: "admin@lptani.id",
  kontakTelegramLabel: "📱 Telegram",
  kontakTelegramUrl: "https://t.me/lptani",
  footerTagline: "Komunitas belajar menjadi Liquidity Provider on-chain di jaringan Robinhood. Belajar full di Discord.",
  footerBottom: "© 2026 LP Tani. All rights reserved. Not financial advice.",
};

async function seedDefaults() {
  const s = await getSettings();
  if (!s) {
    await saveSettings({
      openRegistration: true,
      premiumPrice: 250000,
      vipPrice: 750000,
      discordInviteLink: "https://discord.gg/",
      vipMentoringQuota: 5,
      premiumDurationDays: 180,
      vipDurationDays: 365,
    });
  } else {
    // Migrasi: durasi per-tier (sebelumnya satu nilai membershipDurationDays untuk semua)
    const updates = {};
    if (s.premiumDurationDays === undefined) updates.premiumDurationDays = Number(s.membershipDurationDays || 180);
    if (s.vipDurationDays === undefined) updates.vipDurationDays = 365;
    if (Object.keys(updates).length) await saveSettings(updates);
  }
  const c = await getContent();
  if (!c) {
    await saveContent(DEFAULT_CONTENT);
  } else {
    // Migrasi: isi key baru yang belum ada; nilai lama tidak pernah ditimpa
    const updates = {};
    for (const [k, v] of Object.entries(DEFAULT_CONTENT)) {
      if (c[k] === undefined) updates[k] = v;
    }
    if (!Array.isArray(c.benefitsPremium)) updates.benefitsPremium = DEFAULT_CONTENT.benefitsPremium;
    if (!Array.isArray(c.benefitsVIP)) updates.benefitsVIP = DEFAULT_CONTENT.benefitsVIP;
    if (Object.keys(updates).length) await saveContent(updates);
  }
  const pm = await getPaymentMethods();
  if (pm.length === 0) {
    await addPaymentMethod({ bankName: "BCA", accountName: "LP Tani", accountNumber: "0000000000" });
    await addPaymentMethod({ bankName: "Mandiri", accountName: "LP Tani", accountNumber: "0000000000" });
  }
}

/* ============ Safety net: query offline/belum ada config tidak menggantung ============ */
const IS_PLACEHOLDER_CONFIG = (FIREBASE_CONFIG.apiKey || "").indexOf("GANTI") !== -1;
const _LIST_FNS = ["getPaymentMethods", "getTerms", "getPnlMedia", "getPromos", "getUserTransactions", "getAllTransactions", "getUserMentorings", "getAllMentorings", "dbQueryUsers"];
const _DOC_FNS = ["getSettings", "getContent", "getCurrentUserData"];

_LIST_FNS.forEach((name) => {
  const orig = window[name];
  window[name] = (...args) =>
    IS_PLACEHOLDER_CONFIG
      ? Promise.resolve([])
      : Promise.race([
          Promise.resolve(orig(...args)).catch(() => []),
          new Promise((r) => setTimeout(() => r([]), 8000)),
        ]);
});
_DOC_FNS.forEach((name) => {
  const orig = window[name];
  window[name] = (...args) =>
    IS_PLACEHOLDER_CONFIG
      ? Promise.resolve(null)
      : Promise.race([
          Promise.resolve(orig(...args)).catch(() => null),
          new Promise((r) => setTimeout(() => r(null), 8000)),
        ]);
});
