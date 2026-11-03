// ============================================================
// LP TANI - Firebase Configuration
// Project: lp-tani (https://console.firebase.google.com/project/lp-tani)
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBaUY7y2jgt6FBMy5UYgJzKmigjjoFNa_c",
  authDomain: "lp-tani.firebaseapp.com",
  projectId: "lp-tani",
  storageBucket: "lp-tani.firebasestorage.app",
  messagingSenderId: "890948530871",
  appId: "1:890948530871:web:3f4cea75a98ef92a989332",
  measurementId: "G-FBFZV003HC",
};

// Fitur yang digunakan
const FIREBASE_FEATURES = {
  auth: true,      // Login / Register / Lupa password (Gmail)
  firestore: true, // Database
  storage: false,  // Firebase Storage tidak dipakai (butuh Blaze) — upload via Cloudinary
};

// ============================================================
// Cloudinary (gratis) — upload bukti pembayaran, logo, media PNL
// ============================================================
const CLOUDINARY_CONFIG = {
  cloudName: "wq1bpshm",
  uploadPreset: "lptani_unsigned",
};
