// src/pages/admin/dashboard/DashboardPage.jsx
// Minimal version để test — chỉ hiển thị auth state sau khi login
import { useAdminAuthStore } from "../../store/adminAuthStore";
import { useNavigate } from "react-router-dom";
import { logout } from "../../api/authApi";

export default function DashboardPage() {
  const { user, token, permissions } = useAdminAuthStore();
  const clearAuth = useAdminAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout(); // Gọi POST /api/Auth/logout để xóa refresh token trên server
    } catch {
      // Nếu request lỗi vẫn logout phía client
    }
    clearAuth();
    navigate("/login");
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={styles.title}>✅ Login thành công!</h2>
        <p style={styles.sub}>
          Trang này chỉ dùng để kiểm tra store sau khi đăng nhập.
        </p>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>👤 User</h3>
          <pre style={styles.pre}>{JSON.stringify(user, null, 2)}</pre>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>🔑 Token (50 ký tự đầu)</h3>
          <pre style={styles.pre}>{token?.slice(0, 50)}...</pre>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>
            🛡️ Permissions ({permissions?.length})
          </h3>
          <pre style={styles.pre}>{JSON.stringify(permissions, null, 2)}</pre>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>💾 localStorage</h3>
          <pre style={styles.pre}>
            token: {localStorage.getItem("token")?.slice(0, 50)}...{"\n"}
            user: {localStorage.getItem("user")}
            {"\n"}
            permissions: {localStorage.getItem("permissions")}
          </pre>
        </section>

        <button onClick={handleLogout} style={styles.logoutBtn}>
          Đăng xuất (test clearAuth)
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    background: "#f0f2f5",
    padding: "40px 24px",
    fontFamily: "monospace",
  },
  card: {
    maxWidth: 700,
    margin: "0 auto",
    background: "#fff",
    borderRadius: 8,
    padding: "32px 28px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  },
  title: {
    margin: "0 0 6px",
    color: "#1a1a2e",
    fontFamily: "sans-serif",
  },
  sub: {
    color: "#888",
    fontSize: 13,
    marginBottom: 24,
    fontFamily: "sans-serif",
  },
  section: {
    marginBottom: 20,
    borderBottom: "1px solid #f0f0f0",
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
    fontFamily: "sans-serif",
    color: "#444",
  },
  pre: {
    background: "#f6f8fa",
    borderRadius: 6,
    padding: "10px 12px",
    fontSize: 12,
    overflowX: "auto",
    margin: 0,
    color: "#1a1a2e",
    lineHeight: 1.6,
  },
  logoutBtn: {
    marginTop: 8,
    padding: "10px 20px",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "sans-serif",
  },
};
