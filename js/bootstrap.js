/* ============================================================
   LP TANI - Bootstrap: init Firebase, seed data, auth listener
   ============================================================ */

function initApp() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
  } catch (e) {
    console.error("Firebase init error:", e);
    Helpers.setLoading(false);
    Toast.show("Konfigurasi Firebase belum diisi dengan benar. Buka js/firebase-config.js", "error", 10000);
    return;
  }

  if (IS_PLACEHOLDER_CONFIG) {
    // Belum ada config asli: render landing pakai konten default, tanpa menunggu Firestore
    Landing.render().catch((e) => console.error(e));
    Toast.show("Info: Firebase belum dikonfigurasi (js/firebase-config.js). Website tampil dengan data contoh.", "info", 8000);
  } else {
    seedDefaults()
      .then(() => Landing.render())
      .catch((e) => {
        console.error("Seed error:", e);
        return Landing.render();
      });
  }

  initAuthListener();
}

function initAuthListener() {
  firebase.auth().onAuthStateChanged(async (user) => {
    Helpers.setLoading(true);
    // Watchdog: kalau Firestore lambat/bermasalah, jangan biarkan overlay menggantung
    const watchdog = setTimeout(() => Helpers.setLoading(false), 12000);
    try {
      if (!user) {
        renderNavAuth(false);
        if (Router.current === "user" || Router.current === "admin") Router.go("landing");
        return;
      }
      const data = await ensureUserDoc(user);
      renderNavAuth(true, data);
      if (data && data.role === "admin") {
        Router.go("admin");
        await AdminDash.refreshAll();
      } else {
        Router.go("user");
        await UserDash.renderAll();
      }
    } catch (e) {
      console.error(e);
      Toast.show("Gagal memuat data user: " + e.message, "error");
    } finally {
      clearTimeout(watchdog);
      Helpers.setLoading(false);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const h = window.location.hash;
  if (h === "#auth" || h === "#login" || h === "#register") {
    Router.go("auth");
    Auth.switchTab(h === "#register" ? "register" : "login");
  } else {
    Router.go("landing");
  }
  initApp();
});
