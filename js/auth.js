/* ============================================================
   LP TANI - Auth: Register, Login, Forgot Password, Logout
   ============================================================ */

const Auth = {
  switchTab(tab) {
    document.querySelectorAll("#auth-tabs .tab").forEach((t) => t.classList.remove("active"));
    document.querySelector(`#auth-tabs .tab[data-auth-tab="${tab}"]`).classList.add("active");
    document.getElementById("form-login").classList.toggle("hidden", tab !== "login");
    document.getElementById("form-register").classList.toggle("hidden", tab !== "register");
    document.getElementById("form-forgot").classList.toggle("hidden", tab !== "forgot");
    const sub = document.getElementById("auth-subtitle");
    if (tab === "register") sub.textContent = "Buat akun untuk bergabung dengan LP Tani";
    else if (tab === "forgot") sub.textContent = "Reset password akun kamu";
    else sub.textContent = "Login untuk lanjut ke dashboard member";
  },

  showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.display = msg ? "block" : "none";
  },

  setBtnLoading(id, loading) {
    const b = document.getElementById(id);
    if (loading) {
      b.dataset.orig = b.textContent;
      b.innerHTML = '<span class="spinner" style="border-color:rgba(0,0,0,0.25);border-top-color:#04210f"></span> Memproses...';
      b.disabled = true;
    } else {
      b.textContent = b.dataset.orig || b.textContent;
      b.disabled = false;
    }
  },

  async register(e) {
    e.preventDefault();
    this.showError("reg-error", "");
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim().toLowerCase();
    const phone = document.getElementById("reg-phone").value.trim();
    const pass = document.getElementById("reg-password").value;
    const pass2 = document.getElementById("reg-password2").value;

    if (pass !== pass2) {
      this.showError("reg-error", "Password tidak sama. Coba lagi.");
      return false;
    }
    if (!/^08\d{8,12}$/.test(phone)) {
      this.showError("reg-error", "Format No. HP salah. Gunakan format 08xxxxxxxxxx.");
      return false;
    }
    this.setBtnLoading("reg-btn", true);
    try {
      const cred = await DBAuth().createUserWithEmailAndPassword(email, pass);
      await ensureUserDoc(cred.user, { name, phone });
      Toast.show("Registrasi berhasil! Silakan login.", "success");
      this.switchTab("login");
      document.getElementById("login-email").value = email;
    } catch (err) {
      this.showError("reg-error", this.mapError(err));
    }
    this.setBtnLoading("reg-btn", false);
    return false;
  },

  async login(e) {
    e.preventDefault();
    this.showError("login-error", "");
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const pass = document.getElementById("login-password").value;
    this.setBtnLoading("login-btn", true);
    try {
      await DBAuth().signInWithEmailAndPassword(email, pass);
      Toast.show("Login berhasil! Selamat datang kembali 🌱", "success");
      this.setBtnLoading("login-btn", false);
      // onAuthStateChanged akan mengarahkan
    } catch (err) {
      this.showError("login-error", this.mapError(err));
      this.setBtnLoading("login-btn", false);
    }
    return false;
  },

  async forgot(e) {
    e.preventDefault();
    this.showError("forgot-error", "");
    const email = document.getElementById("forgot-email").value.trim().toLowerCase();
    this.setBtnLoading("forgot-btn", true);
    try {
      await DBAuth().sendPasswordResetEmail(email);
      Toast.show("Link reset password sudah dikirim ke email kamu. Cek inbox/spam Gmail kamu.", "success", 7000);
      this.switchTab("login");
    } catch (err) {
      this.showError("forgot-error", this.mapError(err));
    }
    this.setBtnLoading("forgot-btn", false);
    return false;
  },

  async logout() {
    try {
      await DBAuth().signOut();
      Toast.show("Kamu sudah logout.", "info");
    } catch (err) {
      console.error("Logout error:", err);
      Toast.show("Gagal logout: " + (err.message || "coba lagi"), "error");
    } finally {
      // Pastikan loading tidak menggantung walau listener bermasalah
      Helpers.setLoading(false);
      Router.go("landing");
    }
  },

  mapError(err) {
    const map = {
      "auth/invalid-email": "Format email tidak valid.",
      "auth/user-disabled": "Akun ini dinonaktifkan. Hubungi admin.",
      "auth/user-not-found": "Email tidak terdaftar. Registrasi dulu ya.",
      "auth/wrong-password": "Password salah. Coba lagi.",
      "auth/email-already-in-use": "Email sudah terdaftar. Silakan login atau gunakan email lain.",
      "auth/weak-password": "Password terlalu lemah. Minimal 8 karakter.",
      "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.",
      "auth/network-request-failed": "Koneksi gagal. Periksa internet kamu.",
      "auth/invalid-credential": "Email atau password salah.",
      "auth/requires-recent-login": "Untuk keamanan, silakan login ulang dulu, lalu ganti password.",
      "auth/api-key-not-valid": "Konfigurasi Firebase belum diisi dengan benar. Buka js/firebase-config.js.",
      "auth/operation-not-allowed": "Metode login ini belum diaktifkan di Firebase Console (Authentication → Email/Password).",
    };
    return map[err.code] || map[Object.keys(map).find((k) => (err.code || "").startsWith(k))] || err.message || "Terjadi kesalahan. Coba lagi.";
  },
};

function renderNavAuth(loggedIn, data) {
  const area = document.getElementById("nav-auth-area");
  if (!loggedIn) {
    area.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="Router.go('auth');Auth.switchTab('login')">Login</button>
      <button class="btn btn-primary btn-sm" onclick="Router.go('auth');Auth.switchTab('register')">Daftar</button>`;
    return;
  }
  const isAdmin = data && data.role === "admin";
  area.innerHTML = `
    <button class="btn btn-primary btn-sm" onclick="Router.go('${isAdmin ? "admin" : "user"}')">${isAdmin ? "⚙️ Admin Panel" : "👤 Dashboard"}</button>
    <button class="btn btn-ghost btn-sm" onclick="Auth.logout()">Logout</button>`;
}

function requireAuth() {
  if (!DBAuth().currentUser) {
    Toast.show("Silakan login dulu.", "info");
    Router.go("auth");
    Auth.switchTab("login");
    return false;
  }
  return true;
}
