# 🌱 LP Tani — Website Membership Liquidity Provider (Robinhood)

Website registrasi member untuk komunitas belajar **Liquidity Provider on-chain di jaringan Robinhood**. Pembelajaran full di Discord. Stack: **HTML + CSS + Vanilla JS + Firebase (Spark/free) + Cloudinary (free)** — bisa deploy di Firebase Hosting / server statis low-spek.

## Fitur

**Landing Page**
- Hero marketing + tombol registrasi, penjelasan LP (jual beli manual VS LP "salah entry pun tetap untung"), kenapa harus belajar, profil pengajar + galeri PNL, materi, pricing Premium/VIP, syarat & ketentuan, halaman legal internal (S&K, Kebijakan Refund, Disclaimer Risiko), kontak, dark mode, scrollbar custom, animasi smooth.

**User**
- Registrasi nama + email (Gmail) + No HP, login, lupa password via email
- Join member: input ID Discord, pilih Premium/VIP (harga dinamis), pilih metode pembayaran, centang S&K
- Konfirmasi pembayaran: upload foto bukti, lihat status transaksi (pending/approved/rejected)
- Tombol **Join to Discord** muncul otomatis setelah pembayaran di-approve admin
- Lihat durasi akses Discord + jatah mentoring
- Upgrade Premium → VIP (bayar selisih harga)
- VIP: request mentoring 1-on-1 (jatah 5x), approve jadwal pengajar, request reschedule (maks 1x). Jatah berkurang hanya jika deal (keduanya approve)
- Ganti password

**Admin** (role diubah manual di Firestore: `users/{uid}` → `role: "admin"`)
- Ringkasan + tombol buka/tutup pendaftaran member
- Manage user: cari, edit membership/quota/expiry, **kick user expired**
- Verifikasi pembayaran: lihat bukti (foto), **download bukti**, approve (auto aktifkan membership + jatah mentoring VIP + expiry), tolak dengan alasan
- Manage mentoring: atur jadwal pertama, reschedule + insert pesan alasan, batalkan
- CRUD konten landing + **upload logo**
- CRUD syarat & ketentuan (tampil di landing)
- CRUD PNL image & video (upload file)
- CRUD metode pembayaran (nama bank, nama penerima, nomor rekening)
- Pengaturan: harga premium/VIP, link invite Discord, durasi member, jatah mentoring VIP

## Setup

### Firebase (Auth + Firestore) — gratis plan Spark

1. **Buat project Firebase** di https://console.firebase.google.com
   - Aktifkan **Authentication → Sign-in method → Email/Password**
   - Aktifkan **Firestore Database** (production mode)
2. **Salin config web app**: Project Settings → Your apps → Web app (`</>`)
3. **Isi** `js/firebase-config.js` dengan config tersebut
4. **Deploy rules**: di console Firebase → Firestore → Rules, paste isi `firestore.rules` lalu Publish. (Atau via CLI: `firebase deploy --only firestore:rules`)
5. **Jadikan diri admin**: registrasi akun di web, lalu di console Firebase → Firestore → collection `users` → dokumen UID kamu → tambah field `role` = `"admin"`

### Cloudinary (upload bukti bayar, logo, media PNL) — gratis

> Firebase Storage sejak Okt 2025 hanya tersedia di plan Blaze (butuh kartu), jadi upload memakai Cloudinary free plan.

1. Daftar gratis di https://cloudinary.com (bisa pakai Google)
2. Catat **Cloud name** (di dashboard)
3. Console → Settings → Upload → **Add Upload Preset**:
   - Name: bebas (mis. `lptani_unsigned`)
   - Signing mode: **Unsigned**
4. Isi `CLOUDINARY_CONFIG` di `js/firebase-config.js` dengan cloud name + nama preset tersebut

## Menjalankan Lokal (sekali klik)

Klik dua kali **`start.bat`** → server jalan di http://localhost:5500 dan browser terbuka otomatis. Tidak perlu npm install (server.js tanpa dependency, butuh Node.js saja). Tutup jendela untuk menghentikan server.

## Deploy

```bash
npm install -g firebase-tools
firebase login
# .firebaserc sudah diisi project id "lp-tani"
firebase deploy
```

Atau upload semua file ke hosting statis mana pun (Netlify, Vercel, cPanel). Situs berjalan 100% client-side.

## Struktur Data (Firestore)

| Collection | Isi |
|---|---|
| `users/{uid}` | name, email, phone, role, membership (`none/premium/vip`), membershipExpiry, discordId, mentoringQuota, mentoringUsed |
| `transactions/{id}` | userId, type (`join/upgrade`), tier, amount, status (`pending/approved/rejected`), proofUrl, note |
| `paymentMethods/{id}` | bankName, accountName, accountNumber, active |
| `settings/global` | openRegistration, premiumPrice, vipPrice, discordInviteLink, vipMentoringQuota, membershipDurationDays |
| `contents/site` | semua teks landing + logoUrl + url media |
| `terms/{id}` | title, content, order |
| `pnlMedia/{id}` | type (`image/video`), url, title |
| `mentorings/{id}` | userId, status, proposedDate, userApproved, teacherApproved, rescheduleCount, rescheduleReason, quotaUsed |

## Alur Mentoring VIP

1. User VIP request → `waiting_schedule`
2. Admin atur jadwal (datetime) → `scheduled`, menunggu approve user
3. User **approve** → selesai, jatah -1. User **reschedule (1x)** → admin atur jadwal baru (+ pesan alasan) → user approve → selesai, jatah -1. Tidak deal = jatah tidak berkurang.
