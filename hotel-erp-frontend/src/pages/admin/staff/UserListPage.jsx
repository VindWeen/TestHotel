// src/pages/admin/staff/UserManagementPage.jsx
// Clone 1:1 từ UserManagement.html — chỉ UI, chưa có logic/API
import { useState } from "react";

// ─── Material Symbols helper ───────────────────────────────────────────────────
function MSIcon({ name, filled = false, style: extraStyle }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
        verticalAlign: "middle",
        fontSize: 20,
        ...extraStyle,
      }}
    >
      {name}
    </span>
  );
}

// ─── Toggle Switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange }) {
  return (
    <label style={styles.toggleWrap}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
      />
      <span
        style={{
          ...styles.slider,
          background: checked ? "#4f645b" : "#cbd5e1",
        }}
      >
        <span
          style={{
            ...styles.sliderThumb,
            transform: checked ? "translateX(20px)" : "translateX(0)",
          }}
        />
      </span>
    </label>
  );
}

// ─── Sidebar nav item ──────────────────────────────────────────────────────────
function NavItem({ icon, label, active = false, filled = false }) {
  return (
    <a
      href="#"
      style={{
        ...styles.navItem,
        color: active ? "#1a3a2f" : "#6b7280",
        background: active ? "rgba(79,100,91,0.08)" : "transparent",
        fontWeight: active ? 700 : 500,
      }}
    >
      <MSIcon
        name={icon}
        filled={filled}
        style={{ color: active ? "#4f645b" : "#9ca3af" }}
      />
      <span>{label}</span>
    </a>
  );
}

// ─── Table row data (static demo) ─────────────────────────────────────────────
const DEMO_USERS = [
  {
    id: 1,
    name: "Hùng Lê Mạnh 2",
    email: "manhung08062@gmail.com",
    phone: "02323453454",
    role: "Receptionist",
    roleColor: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBwj11ZS5iH48v0sXiiU44b3dLEPEJV4XON3tDiH6ZNsLDJb5la_4Xr-I0fCyLxs8QT_eFvRxLXSYKS93_UUueQH8tlsP6IPFHyLaVtZF9AcB3vV64WHTsPcUJM4bP9U5vJnWhDXTewCi00AoSwbWTEUnhDZZypCZF--qFor6pz5D3hZkHHBuVF_7LrrJWGDggtpxHd0Ct9ctNJNLn3dO5QJsqBjc6ZOApz2NKbIgyX8agRyxnVMddwJNlIBJJCw30n1cpJ3QGGrcg",
    active: true,
  },
  {
    id: 2,
    name: "Lê Mạnh Hùng",
    email: "hunglm@vaa.edu.vn",
    phone: "0123672890",
    role: "Manager",
    roleColor: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBuammojAR49_9oLkY4_JZbHbvyAqZ-PXHuft5YjMhyn_dL-LPnZC3-DJQZIp5L6EGNK8M7ZkHMqbhyGa9DkN-M-A_KhC9PZKvy39gRiQzjatRJmESBUptPvOqVZ_fk1dze5JkaFNpbwxIaHUPsw8JeFb2CHIRUxuuxXvreQ6G4q-6YP4WNoVf_8U4rH4Z0b64Oqr3tN74gS-VmhhbmpBrZKs5jSBAhTxB3oVn_JTxosyV-nqTYeYNqtuwvipl7B_9eaAXWRnjTYBI",
    active: true,
  },
  {
    id: 3,
    name: "Hoàng Kế Toán",
    email: "accountant@hotel.com",
    phone: "0900000005",
    role: "Accountant",
    roleColor: { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" },
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBotBwe3I7pSk_aK2FBC81I49DZ3G25aEzi6Q-5eS8ULM9mTFT8vEZz8TPqW8iKkyMWQYYqY4eOef4Mn_jVg5mxo2wgVZOyjgKLed2jMoq0N8LLVJCSvTdk3pMChI9WndZqG7Ti26a30B5SDv_UzBedHrrYxYNglRyVJnbYcalVO1Ab7l_0oCT7jlkJfkNs8MC8YejWh012qlCdVR1c7B6d_Zw-bmsO_cQd8jNUA0weJRTYb3Jr__0_4rw_pTsQPGBd73A9KRB6GdI",
    active: false,
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const [users, setUsers] = useState(DEMO_USERS);

  const handleToggle = (id) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u)),
    );
  };

  return (
    <div style={styles.shell}>
      <style>{css}</style>

      {/* ══ SIDEBAR ══ */}
      <aside style={styles.sidebar}>
        {/* Brand */}
        <div style={styles.sidebarBrand}>
          <h1 style={styles.brandName}>The Ethereal</h1>
          <p style={styles.brandSub}>Hotel ERP</p>
        </div>

        {/* Nav */}
        <nav style={styles.nav}>
          <NavItem icon="dashboard" label="Dashboard" />
          <NavItem icon="meeting_room" label="Quản lý Phòng" />
          <NavItem icon="inventory_2" label="Vật tư &amp; Minibar" />
          <NavItem icon="confirmation_number" label="Booking &amp; Voucher" />
          <NavItem icon="group" label="Danh sách Nhân sự" active filled />
        </nav>

        {/* Bottom CTA */}
        <div style={{ marginTop: "auto" }}>
          <button style={styles.sidebarCTA}>
            <MSIcon name="add" style={{ fontSize: 16, color: "#e7fef3" }} />
            Thêm người dùng
          </button>
        </div>
      </aside>

      {/* ══ MAIN AREA ══ */}
      <div style={styles.mainArea}>
        {/* ── Top Header ── */}
        <header style={styles.header}>
          {/* Search + Nav tabs */}
          <div style={styles.headerLeft}>
            <div style={styles.searchWrap}>
              <MSIcon name="search" style={styles.searchIcon} />
              <input
                style={styles.searchInput}
                placeholder="Tìm kiếm tài nguyên..."
                type="text"
              />
            </div>
            <nav style={styles.headerNav}>
              {["Hotels", "Analytics", "Reports"].map((tab, i) => (
                <a
                  key={tab}
                  href="#"
                  style={{
                    ...styles.headerNavLink,
                    color: i === 1 ? "#1a3a2f" : "#6b7280",
                    borderBottom: i === 1 ? "2px solid #1a3a2f" : "none",
                    paddingBottom: i === 1 ? 4 : 0,
                    fontWeight: i === 1 ? 600 : 500,
                  }}
                >
                  {tab}
                </a>
              ))}
            </nav>
          </div>

          {/* Right side */}
          <div style={styles.headerRight}>
            <div style={styles.headerIcons}>
              {/* Theme toggle */}
              <button style={styles.iconBtn}>
                <MSIcon name="light_mode" style={{ color: "#6b7280" }} />
              </button>
              {/* Bell */}
              <button style={{ ...styles.iconBtn, position: "relative" }}>
                <MSIcon name="notifications" style={{ color: "#6b7280" }} />
                <span style={styles.notifDot} />
              </button>
              {/* Help */}
              <button style={styles.iconBtn}>
                <MSIcon name="help_outline" style={{ color: "#6b7280" }} />
              </button>
            </div>

            <div style={styles.headerDivider} />

            {/* User profile */}
            <div style={styles.headerUser}>
              <div style={styles.headerUserText}>
                <p style={styles.headerUserName}>Alex Rivera</p>
                <p style={styles.headerUserRole}>General Manager</p>
              </div>
              <img
                alt="Manager Profile"
                style={styles.headerAvatar}
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBwj11ZS5iH48v0sXiiU44b3dLEPEJV4XON3tDiH6ZNsLDJb5la_4Xr-I0fCyLxs8QT_eFvRxLXSYKS93_UUueQH8tlsP6IPFHyLaVtZF9AcB3vV64WHTsPcUJM4bP9U5vJnWhDXTewCi00AoSwbWTEUnhDZZypCZF--qFor6pz5D3hZkHHBuVF_7LrrJWGDggtpxHd0Ct9ctNJNLn3dO5QJsqBjc6ZOApz2NKbIgyX8agRyxnVMddwJNlIBJJCw30n1cpJ3QGGrcg"
              />
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main style={styles.content}>
          <div style={styles.contentInner}>
            {/* Page title + actions */}
            <div style={styles.pageHeader}>
              <div>
                <h2 style={styles.pageTitle}>
                  Quản lý Nhân sự &amp; Người dùng
                </h2>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button style={styles.exportBtn}>
                  <MSIcon
                    name="file_download"
                    style={{ fontSize: 16, color: "#374151" }}
                  />
                  Xuất báo cáo
                </button>
                <button style={styles.addUserBtn}>
                  <MSIcon
                    name="person_add"
                    style={{ fontSize: 16, color: "#e7fef3" }}
                  />
                  Thêm người dùng
                </button>
              </div>
            </div>

            {/* Filters */}
            <section style={styles.filterSection}>
              {/* Search */}
              <div style={{ flex: 1, minWidth: 300 }}>
                <label style={styles.filterLabel}>Họ tên, Email, SĐT</label>
                <div style={{ position: "relative" }}>
                  <MSIcon name="search" style={styles.filterSearchIcon} />
                  <input
                    style={styles.filterInput}
                    placeholder="Gõ từ khóa..."
                    type="text"
                  />
                </div>
              </div>

              {/* Role select */}
              <div style={styles.filterField}>
                <label style={styles.filterLabel}>Lọc theo Vai trò</label>
                <select style={styles.filterSelect}>
                  <option>Chọn vai trò</option>
                  <option>Receptionist</option>
                  <option>Manager</option>
                  <option>Accountant</option>
                  <option>Guest</option>
                </select>
              </div>

              {/* Status select */}
              <div style={styles.filterField}>
                <label style={styles.filterLabel}>Lọc theo Trạng thái</label>
                <select style={styles.filterSelect}>
                  <option>Chọn trạng thái</option>
                  <option>Hoạt động</option>
                  <option>Đã khóa</option>
                </select>
              </div>

              {/* Tune button */}
              <button style={styles.tuneBtn}>
                <MSIcon name="tune" style={{ color: "#6b7280" }} />
              </button>
            </section>

            {/* Table */}
            <div style={styles.tableCard}>
              <div style={{ overflowX: "auto" }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thead}>
                      {[
                        "Họ và tên",
                        "Email",
                        "Số điện thoại",
                        "Vai trò",
                        "Trạng thái",
                        "Thao tác",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            ...styles.th,
                            textAlign: h === "Thao tác" ? "right" : "left",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="table-row" style={styles.tr}>
                        {/* Name */}
                        <td style={styles.td}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            <img
                              alt="Avatar"
                              style={styles.avatar}
                              src={u.avatar}
                            />
                            <span style={styles.userName}>{u.name}</span>
                          </div>
                        </td>

                        {/* Email */}
                        <td style={styles.td}>{u.email}</td>

                        {/* Phone */}
                        <td style={styles.td}>{u.phone}</td>

                        {/* Role badge */}
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.roleBadge,
                              background: u.roleColor.bg,
                              color: u.roleColor.text,
                              border: `1px solid ${u.roleColor.border}`,
                            }}
                          >
                            {u.role}
                          </span>
                        </td>

                        {/* Status + Toggle */}
                        <td style={styles.td}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: u.active ? "#16a34a" : "#9ca3af",
                              }}
                            >
                              {u.active ? "Hoạt động" : "Bị khóa"}
                            </span>
                            <ToggleSwitch
                              checked={u.active}
                              onChange={() => handleToggle(u.id)}
                            />
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              gap: 4,
                            }}
                          >
                            <button className="action-btn" title="Phân quyền">
                              <MSIcon
                                name="shield"
                                style={{ fontSize: 20, color: "currentColor" }}
                              />
                            </button>
                            <button className="action-btn" title="Xem chi tiết">
                              <MSIcon
                                name="visibility"
                                style={{ fontSize: 20, color: "currentColor" }}
                              />
                            </button>
                            <button className="action-btn" title="Chỉnh sửa">
                              <MSIcon
                                name="edit_square"
                                style={{ fontSize: 20, color: "currentColor" }}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={styles.pagination}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, color: "#6b7280" }}>
                    Tổng số người dùng: 10
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    style={{
                      ...styles.pageBtn,
                      opacity: 0.5,
                      cursor: "not-allowed",
                    }}
                  >
                    <MSIcon
                      name="chevron_left"
                      style={{ fontSize: 18, color: "#9ca3af" }}
                    />
                  </button>
                  {[1, 2, 3].map((p) => (
                    <button
                      key={p}
                      style={{
                        ...styles.pageBtn,
                        background: p === 1 ? "#4f645b" : "#fff",
                        color: p === 1 ? "#e7fef3" : "#6b7280",
                        border:
                          p === 1 ? "1px solid #4f645b" : "1px solid #e5e7eb",
                        fontWeight: p === 1 ? 700 : 500,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                  <span style={{ padding: "0 8px", color: "#9ca3af" }}>
                    ...
                  </span>
                  <button style={styles.pageBtn}>
                    <MSIcon
                      name="chevron_right"
                      style={{ fontSize: 18, color: "#9ca3af" }}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── CSS (scoped) ──────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
  * { box-sizing: border-box; }

  .material-symbols-outlined {
    font-family: 'Material Symbols Outlined';
    font-weight: normal;
    font-style: normal;
    font-size: 20px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-smoothing: antialiased;
    vertical-align: middle;
  }

  .table-row:hover td { background: rgba(79,100,91,0.025) !important; }

  .action-btn {
    padding: 8px;
    border: none;
    background: transparent;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s;
  }
  .action-btn:hover {
    background: #f3f4f6;
    color: #4f645b;
  }
`;

// ─── Styles ────────────────────────────────────────────────────────────────────
const font = "'Manrope', sans-serif";

const styles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "#f8f9fa",
    fontFamily: font,
    WebkitFontSmoothing: "antialiased",
  },

  // ── Sidebar ──
  sidebar: {
    width: 256,
    minHeight: "100vh",
    background: "#ffffff",
    borderRight: "1px solid #f3f4f6",
    display: "flex",
    flexDirection: "column",
    padding: "32px 16px",
    position: "fixed",
    left: 0,
    top: 0,
    zIndex: 40,
  },
  sidebarBrand: { marginBottom: 40, padding: "0 16px" },
  brandName: {
    fontFamily: font,
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.025em",
    color: "#1a3a2f",
    textTransform: "uppercase",
    margin: 0,
  },
  brandSub: {
    fontFamily: font,
    fontSize: 10,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "#9ca3af",
    marginTop: 4,
  },
  nav: { display: "flex", flexDirection: "column", gap: 4 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 12,
    textDecoration: "none",
    fontSize: 14,
    fontFamily: font,
    transition: "all 0.15s",
  },
  sidebarCTA: {
    width: "100%",
    padding: "12px",
    background: "#4f645b",
    color: "#e7fef3",
    border: "none",
    borderRadius: 12,
    fontFamily: font,
    fontSize: 14,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(79,100,91,0.25)",
  },

  // ── Main area ──
  mainArea: {
    marginLeft: 256,
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },

  // ── Header ──
  header: {
    position: "sticky",
    top: 0,
    zIndex: 30,
    background: "rgba(255,255,255,0.8)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid #f3f4f6",
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 32px",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 32 },
  searchWrap: { position: "relative", width: 320 },
  searchIcon: {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#9ca3af",
  },
  searchInput: {
    width: "100%",
    background: "#f3f4f6",
    border: "none",
    borderRadius: 999,
    padding: "8px 16px 8px 40px",
    fontSize: 12,
    fontFamily: font,
    outline: "none",
    color: "#374151",
  },
  headerNav: { display: "flex", gap: 24 },
  headerNavLink: {
    fontFamily: font,
    fontSize: 14,
    fontWeight: 500,
    textDecoration: "none",
    transition: "color 0.15s",
  },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  headerIcons: { display: "flex", gap: 4 },
  iconBtn: {
    padding: 8,
    border: "none",
    background: "transparent",
    borderRadius: 999,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s",
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    background: "#ef4444",
    borderRadius: "50%",
    border: "2px solid white",
  },
  headerDivider: {
    width: 1,
    height: 32,
    background: "#e5e7eb",
    margin: "0 8px",
  },
  headerUser: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
  },
  headerUserText: { textAlign: "right" },
  headerUserName: {
    fontFamily: font,
    fontSize: 12,
    fontWeight: 700,
    color: "#1a1a1a",
    margin: 0,
  },
  headerUserRole: {
    fontFamily: font,
    fontSize: 10,
    color: "#6b7280",
    margin: 0,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid #e5e7eb",
  },

  // ── Content ──
  content: { flex: 1, padding: "32px" },
  contentInner: { maxWidth: 1200, margin: "0 auto" },

  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  pageTitle: {
    fontFamily: font,
    fontSize: 22,
    fontWeight: 800,
    color: "#1a1a1a",
    margin: 0,
    letterSpacing: "-0.3px",
  },

  exportBtn: {
    padding: "9px 20px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
    fontFamily: font,
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    cursor: "pointer",
  },
  addUserBtn: {
    padding: "9px 20px",
    background: "#4f645b",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    color: "#e7fef3",
    fontFamily: font,
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 4px 12px rgba(79,100,91,0.25)",
    cursor: "pointer",
  },

  // ── Filters ──
  filterSection: {
    background: "#ffffff",
    borderRadius: 16,
    padding: "20px 24px",
    marginBottom: 24,
    border: "1px solid #f3f4f6",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-end",
  },
  filterLabel: {
    display: "block",
    fontFamily: font,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#6b7280",
    marginBottom: 8,
  },
  filterInput: {
    width: "100%",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "10px 16px 10px 40px",
    fontSize: 14,
    fontFamily: font,
    outline: "none",
    color: "#374151",
  },
  filterSearchIcon: {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#9ca3af",
  },
  filterField: { width: 224 },
  filterSelect: {
    width: "100%",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "10px 16px",
    fontSize: 14,
    fontFamily: font,
    outline: "none",
    color: "#6b7280",
    cursor: "pointer",
  },
  tuneBtn: {
    padding: "10px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Table ──
  tableCard: {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #f3f4f6",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: {
    background: "rgba(249,250,251,0.5)",
    borderBottom: "1px solid #f3f4f6",
  },
  tr: {},
  th: {
    padding: "16px 24px",
    fontFamily: font,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#6b7280",
  },
  td: {
    padding: "16px 24px",
    fontSize: 14,
    fontFamily: font,
    color: "#374151",
    borderBottom: "1px solid rgba(243,244,246,0.8)",
  },
  avatar: { width: 36, height: 36, borderRadius: "50%", objectFit: "cover" },
  userName: {
    fontSize: 14,
    fontWeight: 500,
    color: "#1a1a1a",
    fontFamily: font,
  },
  roleBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: font,
  },

  // Toggle switch
  toggleWrap: {
    position: "relative",
    display: "inline-block",
    width: 44,
    height: 24,
    cursor: "pointer",
  },
  slider: {
    position: "absolute",
    inset: 0,
    borderRadius: 24,
    transition: "background 0.3s",
    display: "flex",
    alignItems: "center",
  },
  sliderThumb: {
    position: "absolute",
    left: 3,
    width: 18,
    height: 18,
    background: "#ffffff",
    borderRadius: "50%",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    transition: "transform 0.3s",
  },

  // Pagination
  pagination: {
    padding: "16px 24px",
    borderTop: "1px solid #f3f4f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageBtn: {
    minWidth: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: font,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#6b7280",
    cursor: "pointer",
    transition: "all 0.15s",
  },
};
