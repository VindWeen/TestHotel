// Sidebar + Header (Bell notification) + <Outlet />
// Layout này dùng <Outlet /> của React Router v6 để render trang con mà không re-render sidebar/header.
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { useLoadingStore } from "../store/loadingStore";
import { logout } from "../api/authApi";

export default function AdminLayout() {
  const { user, permissions } = useAdminAuthStore();
  const clearAuth = useAdminAuthStore((s) => s.clearAuth);
  const isLoading = useLoadingStore((s) => s.isLoading);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // vẫn logout phía client dù server lỗi
    }
    clearAuth();
    navigate("/login");
  };

  const hasPermission = (code) =>
    permissions.some(
      (p) =>
        (typeof p === "string" && p === code) ||
        (typeof p === "object" && p.permissionCode === code),
    );

  return (
    <div style={styles.shell}>
      {/* ── Loading Overlay ── */}
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner} />
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>🏨 HOTEL ERP</div>

        <nav style={styles.nav}>
          <NavLink to="/admin/dashboard" style={navStyle}>
            Dashboard
          </NavLink>

          {hasPermission("MANAGE_USERS") && (
            <NavLink to="/admin/staff" style={navStyle}>
              Quản lý Nhân sự
            </NavLink>
          )}

          {hasPermission("MANAGE_ROOMS") && (
            <NavLink to="/admin/rooms" style={navStyle}>
              Quản lý Phòng
            </NavLink>
          )}

          {hasPermission("MANAGE_BOOKINGS") && (
            <NavLink to="/admin/bookings" style={navStyle}>
              Booking & Voucher
            </NavLink>
          )}
          {hasPermission("MANAGE_ROLES") && (
            <NavLink to="/admin/roles" style={navStyle}>
              Vai trò & Phân quyền
            </NavLink>
          )}
        </nav>

        {/* ── User info bottom ── */}
        <div style={styles.userBox}>
          {user?.avatarUrl && (
            <img src={user.avatarUrl} alt="avatar" style={styles.avatar} />
          )}
          <div style={styles.userInfo}>
            <p style={styles.userName}>{user?.fullName}</p>
            <p style={styles.userRole}>{user?.role}</p>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={styles.main}>
        {/* Header */}
        <header style={styles.header}>
          <span style={styles.headerTitle}>Admin Panel</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Đăng xuất
          </button>
        </header>

        {/* Page content */}
        <main style={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ── NavLink style helper ──────────────────────────────────────────────────────
const navStyle = ({ isActive }) => ({
  display: "block",
  padding: "10px 16px",
  marginBottom: 4,
  borderRadius: 6,
  textDecoration: "none",
  fontSize: 14,
  fontWeight: isActive ? 700 : 500,
  background: isActive ? "#0ea5e9" : "transparent",
  color: isActive ? "#fff" : "#374151",
});

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "sans-serif",
  },
  loadingOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(255,255,255,0.6)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "4px solid #e5e7eb",
    borderTop: "4px solid #0ea5e9",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  sidebar: {
    width: 240,
    background: "#fff",
    borderRight: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    padding: "24px 12px",
    position: "fixed",
    top: 0,
    left: 0,
    height: "100vh",
  },
  logo: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0ea5e9",
    marginBottom: 28,
    paddingLeft: 8,
  },
  nav: {
    flex: 1,
  },
  userBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 8px",
    borderTop: "1px solid #e5e7eb",
    marginTop: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    objectFit: "cover",
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#111827",
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  userRole: {
    fontSize: 11,
    color: "#6b7280",
    margin: 0,
  },
  main: {
    marginLeft: 240,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    background: "#f9fafb",
  },
  header: {
    height: 56,
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#374151",
  },
  logoutBtn: {
    padding: "6px 14px",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  content: {
    flex: 1,
    padding: 24,
  },
};
