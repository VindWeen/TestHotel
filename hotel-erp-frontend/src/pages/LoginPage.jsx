// src/pages/LoginPage.jsx
// Clone 1:1 từ index.html — chỉ UI, chưa có logic/API
import { useState } from "react";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div style={styles.body}>
      <style>{css}</style>

      <main style={styles.main}>
        {/* ══ IMAGE PANEL ══
            - Login:   hiện bên phải (right-0)
            - Sign-up: trượt sang trái (-100%)
        */}
        <section
          className="image-panel"
          style={{
            ...styles.imagePanel,
            transform: isSignUp ? "translateX(-100%)" : "translateX(0)",
          }}
        >
          <div style={{ position: "relative", height: "100%", width: "100%" }}>
            <img
              alt="Serene luxury hotel suite with ocean view"
              style={styles.bgImg}
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCUXLirJlWJiy10WHJheRqqrv4EtlspwBjVQDI4G6WCsDBgXSUvSBwsdAfbo1-m87D-XEPsKtrjpwhxTzc3pgZP9XFBzMezt71X_tkCybCWbpHGllEvbv80ia3FiBv-AIqMTvhmPr03oG0QVMqWvBFLx-M0nnp2W6iXCK0x8RIcmfkjFA9EvE5ATbCrXXB4GhG4amZQiP1h9FRuarHM9n2EbwGdH9Gut0CweAjs6Ot_QKkIaxLUp4dVmQJ9QM8EssZIC-xjI6F1bnw"
            />
            <div style={styles.imgOverlay} />
            <div style={styles.imgContent}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={styles.welcomeTo}>Welcome to</span>
                <h1 style={styles.brandTitle}>The Ethereal Concierge</h1>
              </div>
              <div
                style={{
                  maxWidth: 448,
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                }}
              >
                <p style={styles.brandQuote}>
                  "A digital sanctuary crafted for the discerning traveler,
                  where every detail is a breath of fresh air."
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      height: 1,
                      width: 48,
                      background: "rgba(231,254,243,0.4)",
                    }}
                  />
                  <span style={styles.estLabel}>Est. 2024</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ FORM PANEL ══
            - Login:   ở bên trái, translateX(0)
            - Sign-up: trượt sang phải (100%)
        */}
        <section
          className="form-container"
          style={{
            ...styles.formPanel,
            transform: isSignUp ? "translateX(100%)" : "translateX(0)",
          }}
        >
          {/* Mobile brand — ẩn trên desktop */}
          <div className="mobile-brand" style={styles.mobileBrand}>
            <h1 style={styles.mobileBrandTitle}>The Ethereal Concierge</h1>
          </div>

          {/* ── LOGIN VIEW ── */}
          {!isSignUp && (
            <div style={styles.formBox}>
              <div style={styles.formHeading}>
                <h2 style={styles.formTitle}>Sign In</h2>
                <p style={styles.formSubtitle}>
                  Return to your personal sanctuary.
                </p>
              </div>

              <form style={styles.form} onSubmit={(e) => e.preventDefault()}>
                <Field label="Username or Email">
                  <input
                    style={styles.input}
                    placeholder="Enter your identity"
                    type="text"
                  />
                </Field>

                <Field
                  label="Password"
                  aside={
                    <a href="#" style={styles.forgotLink}>
                      Forgot?
                    </a>
                  }
                >
                  <input
                    style={styles.input}
                    placeholder="••••••••"
                    type="password"
                  />
                </Field>

                <button style={styles.submitBtn} type="submit">
                  Sign In
                </button>
              </form>

              {/* Divider */}
              <div style={{ position: "relative", padding: "16px 0" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      borderTop: "1px solid rgba(209,209,204,0.3)",
                    }}
                  />
                </div>
              </div>

              <p style={styles.switchText}>
                Don't have an account?{" "}
                <button
                  style={styles.switchBtn}
                  onClick={() => setIsSignUp(true)}
                >
                  Sign Up
                </button>
              </p>
            </div>
          )}

          {/* ── SIGN UP VIEW ── */}
          {isSignUp && (
            <div style={{ ...styles.formBox, maxWidth: 448 }}>
              <div style={styles.formHeading}>
                <h2 style={styles.formTitle}>Join the Circle</h2>
                <p style={styles.formSubtitle}>Experience luxury redefined.</p>
              </div>

              <form
                className="custom-scrollbar"
                style={{
                  ...styles.form,
                  maxHeight: 614,
                  overflowY: "auto",
                  paddingRight: 16,
                }}
                onSubmit={(e) => e.preventDefault()}
              >
                {/* Full Name + Email */}
                <div style={styles.grid2}>
                  <Field label="Full Name">
                    <input
                      style={styles.inputSm}
                      placeholder="John Doe"
                      type="text"
                    />
                  </Field>
                  <Field label="Email Address">
                    <input
                      style={styles.inputSm}
                      placeholder="john@ethereal.com"
                      type="email"
                    />
                  </Field>
                </div>

                {/* Phone + DOB */}
                <div style={styles.grid2}>
                  <Field label="Phone Number">
                    <input
                      style={styles.inputSm}
                      placeholder="+1 (555) 000-0000"
                      type="tel"
                    />
                  </Field>
                  <Field label="Date of Birth">
                    <input
                      style={{ ...styles.inputSm, color: "#5e6059" }}
                      type="date"
                    />
                  </Field>
                </div>

                {/* Gender + Username */}
                <div style={styles.grid2}>
                  <Field label="Gender">
                    <select style={{ ...styles.inputSm, color: "#5e6059" }}>
                      <option>Select Preference</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Non-binary</option>
                      <option>Prefer not to say</option>
                    </select>
                  </Field>
                  <Field label="Username">
                    <input
                      style={styles.inputSm}
                      placeholder="unique_traveler"
                      type="text"
                    />
                  </Field>
                </div>

                {/* Address */}
                <Field label="Home Address">
                  <input
                    style={styles.inputSm}
                    placeholder="123 Serenity Blvd, Sky City, 90210"
                    type="text"
                  />
                </Field>

                {/* Password */}
                <Field label="Secure Password">
                  <input
                    style={styles.inputSm}
                    placeholder="••••••••"
                    type="password"
                  />
                </Field>

                {/* Terms */}
                <div style={styles.termsRow}>
                  <input
                    style={{
                      marginTop: 4,
                      height: 16,
                      width: 16,
                      accentColor: "#4f645b",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    type="checkbox"
                  />
                  <label style={styles.termsLabel}>
                    I agree to the{" "}
                    <a href="#" style={styles.termsLink}>
                      Terms of Service
                    </a>{" "}
                    and acknowledge the{" "}
                    <a href="#" style={styles.termsLink}>
                      Privacy Policy
                    </a>
                    .
                  </label>
                </div>

                <button style={styles.submitBtn} type="submit">
                  Create Account
                </button>
              </form>

              <p style={styles.switchText}>
                Already have an account?{" "}
                <button
                  style={styles.switchBtn}
                  onClick={() => setIsSignUp(false)}
                >
                  Sign In
                </button>
              </p>
            </div>
          )}

          {/* Footer links */}
          <footer style={styles.footer}>
            {["Privacy", "Terms", "Sustainability"].map((label) => (
              <a key={label} href="#" style={styles.footerLink}>
                {label}
              </a>
            ))}
          </footer>
        </section>
      </main>
    </div>
  );
}

// ─── Helper: Field wrapper ─────────────────────────────────────────────────────
function Field({ label, aside, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 4px",
        }}
      >
        <label style={styles.fieldLabel}>{label}</label>
        {aside}
      </div>
      {children}
    </div>
  );
}

// ─── CSS ───────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }

  .image-panel, .form-container {
    transition: transform 0.8s cubic-bezier(0.7, 0, 0.3, 1);
  }

  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #f2f2f2; border-radius: 10px; }

  @media (max-width: 768px) {
    .image-panel { display: none !important; }
    .form-container { width: 100% !important; transform: none !important; }
    .mobile-brand { display: flex !important; }
  }
`;

// ─── Styles ────────────────────────────────────────────────────────────────────
const font = "'Manrope', sans-serif";

const styles = {
  body: {
    minHeight: "100vh",
    background: "rgba(141,163,153,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: font,
    WebkitFontSmoothing: "antialiased",
  },
  main: {
    position: "relative",
    display: "flex",
    width: "100%",
    height: "calc(100vh - 3rem)",
    maxHeight: 900,
    overflow: "hidden",
    borderRadius: "1.5rem",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
    background: "#ffffff",
    border: "1px solid rgba(209,209,204,0.2)",
  },

  // ── Image panel ──
  imagePanel: {
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 20,
    height: "100%",
    width: "50%",
    overflow: "hidden",
    background: "#f2f2f2",
  },
  bgImg: { height: "100%", width: "100%", objectFit: "cover" },
  imgOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(79,100,91,0.1)",
    backdropFilter: "blur(2px)",
  },
  imgContent: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: 64,
    color: "#e7fef3",
  },
  welcomeTo: {
    fontFamily: font,
    fontSize: 12,
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    opacity: 0.8,
  },
  brandTitle: {
    fontFamily: font,
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: "-0.025em",
    color: "#e7fef3",
    margin: 0,
  },
  brandQuote: {
    fontFamily: font,
    fontSize: 24,
    lineHeight: 1.625,
    fontWeight: 300,
    fontStyle: "italic",
    color: "#e7fef3",
    margin: 0,
  },
  estLabel: {
    fontFamily: font,
    fontSize: 12,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
  },

  // ── Form panel ──
  formPanel: {
    position: "relative",
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "50%",
    background: "#ffffff",
    padding: "40px 96px",
  },
  mobileBrand: {
    display: "none",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 48,
  },
  mobileBrandTitle: {
    fontFamily: font,
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: "-0.025em",
    color: "#4f645b",
  },

  // ── Form box ──
  formBox: {
    width: "100%",
    maxWidth: 384,
    display: "flex",
    flexDirection: "column",
    gap: 32,
  },
  formHeading: { display: "flex", flexDirection: "column", gap: 8 },
  formTitle: {
    fontFamily: font,
    fontSize: 30,
    fontWeight: 700,
    color: "#1a1a1a",
    margin: 0,
  },
  formSubtitle: {
    fontFamily: font,
    color: "#5e6059",
    fontWeight: 300,
    margin: 0,
  },
  form: { display: "flex", flexDirection: "column", gap: 20 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },

  fieldLabel: {
    fontFamily: font,
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#5e6059",
  },

  // Full-size input (login)
  input: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(209,209,204,0.3)",
    background: "#f2f2f2",
    padding: "16px 20px",
    fontSize: 14,
    color: "#1a1a1a",
    outline: "none",
    fontFamily: font,
    transition: "all 0.2s",
  },
  // Smaller input (sign-up grid)
  inputSm: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(209,209,204,0.3)",
    background: "#f2f2f2",
    padding: "12px 16px",
    fontSize: 14,
    color: "#1a1a1a",
    outline: "none",
    fontFamily: font,
  },

  submitBtn: {
    width: "100%",
    borderRadius: 16,
    background: "#4f645b",
    padding: "16px",
    fontFamily: font,
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    color: "#e7fef3",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 10px 15px -3px rgba(79,100,91,0.2)",
    transition: "all 0.2s",
  },

  forgotLink: {
    fontFamily: font,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "-0.025em",
    color: "rgba(79,100,91,0.7)",
    textDecoration: "none",
  },

  switchText: {
    textAlign: "center",
    fontSize: 14,
    color: "#5e6059",
    fontFamily: font,
    margin: 0,
  },
  switchBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    color: "#4f645b",
    fontFamily: font,
    fontSize: 14,
    textDecoration: "underline",
    textUnderlineOffset: 4,
    padding: 0,
  },

  termsRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "8px 0",
  },
  termsLabel: {
    fontSize: 12,
    color: "#5e6059",
    lineHeight: 1.625,
    fontFamily: font,
  },
  termsLink: { fontWeight: 700, color: "#4f645b", textDecoration: "none" },

  footer: { position: "absolute", bottom: 32, display: "flex", gap: 24 },
  footerLink: {
    fontFamily: font,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    color: "#7a7b75",
    textDecoration: "none",
  },
};
