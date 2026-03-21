// src/pages/LoginPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api/authApi";
import { useAdminAuthStore } from "../store/adminAuthStore";

export default function LoginPage() {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPw, setRegConfirmPw] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const setAuth = useAdminAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  // Restore remembered email
  useEffect(() => {
    const saved = localStorage.getItem("hm_remember_email");
    if (saved) {
      setLoginEmail(saved);
      setRemember(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    if (!loginEmail.trim()) return setLoginError("Email không được để trống.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail))
      return setLoginError("Email không hợp lệ.");
    if (!loginPassword) return setLoginError("Mật khẩu không được để trống.");

    setLoginLoading(true);
    try {
      const res = await login(loginEmail.trim(), loginPassword);
      const data = res.data;
      setAuth({
        token: data.token,
        user: {
          id: data.userId,
          fullName: data.fullName,
          email: data.email,
          role: data.role,
          avatarUrl: data.avatarUrl,
        },
        permissions: data.permissions || [],
      });
      if (remember)
        localStorage.setItem("hm_remember_email", loginEmail.trim());
      else localStorage.removeItem("hm_remember_email");
      navigate("/admin/dashboard");
    } catch (err) {
      setLoginError(
        err?.response?.data?.message || "Email hoặc mật khẩu không đúng.",
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError("");
    if (!regFullName.trim())
      return setRegError("Họ và tên không được để trống.");
    if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail))
      return setRegError("Email không hợp lệ.");
    if (regPassword.length < 6)
      return setRegError("Mật khẩu phải ít nhất 6 ký tự.");
    if (regPassword !== regConfirmPw)
      return setRegError("Mật khẩu xác nhận không khớp.");

    setRegLoading(true);
    try {
      const res = await register({
        fullName: regFullName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        confirmPassword: regConfirmPw,
        phone: regPhone || undefined,
      });
      const data = res.data;
      setAuth({
        token: data.token,
        user: {
          id: data.userId,
          fullName: data.fullName,
          email: data.email,
          role: data.role,
          avatarUrl: data.avatarUrl,
        },
        permissions: data.permissions || [],
      });
      navigate("/admin/dashboard");
    } catch (err) {
      setRegError(
        err?.response?.data?.message || "Đăng ký thất bại. Vui lòng thử lại.",
      );
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <>
      <style>{`
        body { font-family: 'Manrope', sans-serif; background-color: #fbf9f4; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24; }
        .form-input-focus:focus { box-shadow: 0 0 0 1px rgba(79,100,91,0.4); outline: none; }
        .luxury-gradient { background: linear-gradient(135deg, #4f645b 0%, #43574f 100%); }

        /* Spinner */
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { display:inline-block; width:16px; height:16px; border:2px solid rgba(231,254,243,.4); border-top-color:#e7fef3; border-radius:50%; animation:spin .7s linear infinite; vertical-align:middle; margin-right:8px; }

        /* Shake */
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
        .shake { animation: shake .4s ease; }

        /* Password toggle */
        .pw-btn { position:absolute; right:16px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#7a7b75; display:flex; align-items:center; transition:color .2s; }
        .pw-btn:hover { color:#4f645b; }

        /* Modal backdrop */
        .modal-bg { backdrop-filter:blur(4px); }
        .modal-scroll { max-height:90vh; overflow-y:auto; }

        /* Close button — no border, soft hover */
        .modal-close-btn {
          background:none; border:none; outline:none; cursor:pointer;
          padding:6px; border-radius:8px; color:#9ca3af;
          display:flex; align-items:center;
          transition:background .15s, color .15s;
        }
        .modal-close-btn:hover { background:#f3f4f6; color:#374151; }

        /* Register action buttons */
        .reg-btn-cancel {
          flex:1; padding:14px; background:none; border:none; outline:none;
          border-radius:9999px; font-size:14px; font-weight:600;
          color:#5e6059; cursor:pointer; transition:background .15s;
          font-family:'Manrope',sans-serif;
        }
        .reg-btn-cancel:hover { background:#f3f4f6; }

        .reg-btn-submit {
          flex:1; padding:14px; border:none; outline:none;
          border-radius:9999px; font-size:12px; font-weight:700;
          letter-spacing:.1em; text-transform:uppercase;
          color:#e7fef3; cursor:pointer;
          background:linear-gradient(135deg,#4f645b 0%,#43574f 100%);
          box-shadow:0 4px 16px rgba(79,100,91,.3);
          transition:opacity .15s, transform .1s;
          font-family:'Manrope',sans-serif;
        }
        .reg-btn-submit:hover { opacity:.9; }
        .reg-btn-submit:active { transform:scale(.98); }
        .reg-btn-submit:disabled { opacity:.6; }

        /* Sign In button */
        .signin-btn { border:none !important; outline:none; }
        .signin-btn:focus-visible { outline:2px solid #4f645b; outline-offset:2px; }

        /* Create account link — underline only on hover */
        .create-account-link { text-decoration:none; }
        .create-account-link:hover { text-decoration:underline; text-underline-offset:4px; text-decoration-thickness:2px; }

        /* Checkbox */
        .custom-checkbox {
          width:20px; height:20px; min-width:20px; min-height:20px;
          appearance:checkbox; -webkit-appearance:checkbox;
          accent-color:#4f645b; cursor:pointer;
          border:1px solid #b2b2ab; border-radius:4px;
        }
      `}</style>

      <link
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      {/* ══ MODAL: ĐĂNG KÝ ══ */}
      <div
        id="registerModal"
        className={`fixed inset-0 bg-black/50 modal-bg ${isRegisterOpen ? "flex" : "hidden"} items-center justify-center z-[200]`}
        onClick={(e) => {
          if (e.target.id === "registerModal") setIsRegisterOpen(false);
        }}
      >
        <div className="bg-white rounded-2xl w-full max-w-md mx-4 modal-scroll shadow-2xl">
          <div className="flex items-center justify-between px-8 pt-7 pb-4 border-b border-stone-100">
            <h3 className="text-xl font-bold">Tạo tài khoản mới</h3>
            <button
              className="modal-close-btn"
              onClick={() => setIsRegisterOpen(false)}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "20px",
                  fontVariationSettings:
                    "'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24",
                }}
              >
                close
              </span>
            </button>
          </div>

          <form
            className="px-8 py-6 space-y-4"
            noValidate
            onSubmit={handleRegister}
          >
            <div>
              <label
                className="block text-[10px] tracking-[.15em] font-bold uppercase mb-1.5"
                style={{ color: "#5e6059" }}
              >
                Họ và tên *
              </label>
              <input
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                type="text"
                placeholder="Nguyễn Văn A"
                autoComplete="name"
                className="w-full border-none rounded-xl py-3.5 px-5 text-sm form-input-focus transition-all"
                style={{ background: "rgba(227,227,219,.5)", color: "#31332e" }}
              />
            </div>
            <div>
              <label
                className="block text-[10px] tracking-[.15em] font-bold uppercase mb-1.5"
                style={{ color: "#5e6059" }}
              >
                Email *
              </label>
              <input
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                className="w-full border-none rounded-xl py-3.5 px-5 text-sm form-input-focus transition-all"
                style={{ background: "rgba(227,227,219,.5)", color: "#31332e" }}
              />
            </div>
            <div>
              <label
                className="block text-[10px] tracking-[.15em] font-bold uppercase mb-1.5"
                style={{ color: "#5e6059" }}
              >
                Số điện thoại
              </label>
              <input
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                type="tel"
                placeholder="09xxxxxxxx"
                autoComplete="tel"
                className="w-full border-none rounded-xl py-3.5 px-5 text-sm form-input-focus transition-all"
                style={{ background: "rgba(227,227,219,.5)", color: "#31332e" }}
              />
            </div>
            <div>
              <label
                className="block text-[10px] tracking-[.15em] font-bold uppercase mb-1.5"
                style={{ color: "#5e6059" }}
              >
                Mật khẩu *
              </label>
              <div className="relative">
                <input
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  type={showRegPassword ? "text" : "password"}
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                  className="w-full border-none rounded-xl py-3.5 px-5 pr-14 text-sm form-input-focus transition-all"
                  style={{
                    background: "rgba(227,227,219,.5)",
                    color: "#31332e",
                  }}
                />
                <button
                  type="button"
                  className="pw-btn"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "20px",
                      fontVariationSettings:
                        "'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24",
                    }}
                  >
                    {showRegPassword ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
            </div>
            <div>
              <label
                className="block text-[10px] tracking-[.15em] font-bold uppercase mb-1.5"
                style={{ color: "#5e6059" }}
              >
                Xác nhận mật khẩu *
              </label>
              <div className="relative">
                <input
                  value={regConfirmPw}
                  onChange={(e) => setRegConfirmPw(e.target.value)}
                  type={showRegConfirm ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu"
                  autoComplete="new-password"
                  className="w-full border-none rounded-xl py-3.5 px-5 pr-14 text-sm form-input-focus transition-all"
                  style={{
                    background: "rgba(227,227,219,.5)",
                    color: "#31332e",
                  }}
                />
                <button
                  type="button"
                  className="pw-btn"
                  onClick={() => setShowRegConfirm(!showRegConfirm)}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "20px",
                      fontVariationSettings:
                        "'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24",
                    }}
                  >
                    {showRegConfirm ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
            </div>

            {/* Error banner */}
            {regError && (
              <div
                className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                style={{
                  background: "rgba(168,56,54,.1)",
                  border: "1px solid rgba(168,56,54,.25)",
                }}
              >
                <span
                  className="material-symbols-outlined mt-0.5"
                  style={{
                    fontSize: "18px",
                    color: "#a83836",
                    fontVariationSettings:
                      "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20",
                  }}
                >
                  error
                </span>
                <p
                  className="text-sm font-medium leading-snug"
                  style={{ color: "#a83836" }}
                >
                  {regError}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                className="reg-btn-cancel"
                onClick={() => setIsRegisterOpen(false)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="reg-btn-submit"
                disabled={regLoading}
              >
                {regLoading ? (
                  <>
                    <span className="spinner" />
                    Đang xử lý…
                  </>
                ) : (
                  "Tạo tài khoản"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ══ MAIN ══ */}
      <div className="bg-surface text-on-surface antialiased overflow-hidden">
        <main className="min-h-screen flex flex-col md:flex-row w-full">
          {/* Left — Visual */}
          <section className="hidden md:flex md:w-1/2 lg:w-3/5 relative overflow-hidden bg-primary-fixed">
            <div className="absolute inset-0 z-0">
              <img
                alt="Serene Hotel Interior"
                className="w-full h-full object-cover opacity-90 mix-blend-multiply"
                src="https://images8.alphacoders.com/138/1386921.png"
              />
            </div>
            <div className="relative z-10 flex flex-col justify-between p-16 w-full text-on-primary-fixed">
              <div>
                <span className="text-xl font-bold tracking-tighter">
                  The Ethereal Concierge
                </span>
              </div>
              <div className="max-w-md">
                <h2 className="text-5xl font-extrabold tracking-tight leading-tight mb-6">
                  Your Sanctuary Awaits.
                </h2>
                <p className="text-lg font-light leading-relaxed opacity-80">
                  Experience the art of mindful hospitality where every detail
                  is curated for your absolute serenity.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-[1px] w-12 bg-on-primary-fixed-variant opacity-40"></div>
                <span className="text-xs tracking-[0.2em] uppercase">
                  Est. 2024
                </span>
              </div>
            </div>
          </section>

          {/* Right — Login Form */}
          <section className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-8 md:p-12 lg:p-24 bg-surface">
            <div className="w-full max-w-md space-y-10">
              <header className="text-center md:text-left">
                <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">
                  Welcome Back
                </h1>
                <p className="text-on-surface-variant font-light tracking-wide">
                  Please enter your details to access your retreat.
                </p>
              </header>

              <form className="space-y-5" noValidate onSubmit={handleLogin}>
                {/* Email */}
                <div className="space-y-2">
                  <label
                    className="text-[10px] tracking-[0.15em] font-bold text-on-surface-variant uppercase ml-1"
                    htmlFor="f_email"
                  >
                    Username or Email
                  </label>
                  <input
                    id="f_email"
                    type="email"
                    placeholder="Enter your email address"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      setLoginError("");
                    }}
                    className="w-full bg-surface-container-highest/50 border-none rounded-xl py-4 px-6 text-on-surface placeholder:text-outline/50 form-input-focus transition-all duration-300"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label
                      className="text-[10px] tracking-[0.15em] font-bold text-on-surface-variant uppercase"
                      htmlFor="f_password"
                    >
                      Password
                    </label>
                    <a
                      className="text-[10px] font-bold text-primary hover:text-primary-dim transition-colors create-account-link"
                      href="#"
                    >
                      Forgot?
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      id="f_password"
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        setLoginError("");
                      }}
                      className="w-full bg-surface-container-highest/50 border-none rounded-xl py-4 px-6 pr-14 text-on-surface placeholder:text-outline/50 form-input-focus transition-all duration-300"
                    />
                    <button
                      type="button"
                      className="pw-btn"
                      aria-label="Hiện/ẩn mật khẩu"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "20px",
                          fontVariationSettings:
                            "'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24",
                        }}
                      >
                        {showLoginPassword ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <div className="flex items-center gap-3 px-1">
                  <input
                    id="f_remember"
                    type="checkbox"
                    className="custom-checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <label
                    className="text-sm text-on-surface-variant font-medium select-none cursor-pointer"
                    htmlFor="f_remember"
                  >
                    Remember me
                  </label>
                </div>

                {/* Error banner */}
                {loginError && (
                  <div
                    className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                    style={{
                      background: "rgba(168,56,54,.1)",
                      border: "1px solid rgba(168,56,54,.25)",
                    }}
                  >
                    <span
                      className="material-symbols-outlined mt-0.5"
                      style={{
                        fontSize: "18px",
                        color: "#a83836",
                        fontVariationSettings:
                          "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20",
                      }}
                    >
                      error
                    </span>
                    <p
                      className="text-sm font-medium leading-snug"
                      style={{ color: "#a83836" }}
                    >
                      {loginError}
                    </p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="signin-btn w-full luxury-gradient text-on-primary py-4 rounded-full font-bold tracking-widest uppercase text-xs shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all duration-300 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loginLoading ? (
                    <>
                      <span className="spinner" />
                      Đang xử lý…
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>

              <footer className="text-center pt-4">
                <p className="text-sm text-on-surface-variant font-medium">
                  Don't have an account?
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsRegisterOpen(true);
                    }}
                    className="text-primary font-bold ml-1 create-account-link"
                  >
                    Create an account
                  </a>
                </p>
              </footer>
            </div>
          </section>
        </main>

        <div className="fixed top-8 left-8 md:top-12 md:left-12 pointer-events-none md:hidden">
          <span className="text-lg font-bold tracking-tighter text-on-surface">
            The Ethereal Concierge
          </span>
        </div>
      </div>
    </>
  );
}
