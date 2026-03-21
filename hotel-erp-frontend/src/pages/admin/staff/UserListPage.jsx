// Bài tập chính trong tuần 5
import { useEffect, useState } from "react";
import {
  getUsers,
  toggleStatus,
  changeRole,
} from "../../../api/userManagementApi";
import { formatDate } from "../../../utils";
import { STATUS_LABEL, ERROR_MESSAGES } from "../../../constants";
import axiosClient from "../../../api/axios";
import { getRoles } from "../../../api/roleApi";

export default function UserListPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filter state
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    roleId: "",
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Load users + roles song song
  useEffect(() => {
    loadData();
  }, [page, filterRole, filterStatus]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, pageSize };

      const [usersRes, rolesRes] = await Promise.all([
        getUsers(params),
        getRoles(),
      ]);

      let userList = usersRes.data?.data || [];

      if (filterStatus === "active") {
        userList = userList.filter((u) => u.status === true);
      } else if (filterStatus === "locked") {
        userList = userList.filter((u) => u.status === false);
      }

      if (filterRole) {
        userList = userList.filter((u) => u.roleName === filterRole);
      }

      setUsers(userList);
      setTotal(usersRes.data?.pagination?.totalItems || 0);
      setRoles(rolesRes.data || []);
    } catch (err) {
      setError(ERROR_MESSAGES.NETWORK);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIdByName = (name, roleList) => {
    const found = roleList.find((r) => r.name === name);
    return found?.id || "";
  };

  // Tìm kiếm phía client theo tên/email/phone
  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    );
  });

  const handleToggleStatus = async (user) => {
    const action = user.status ? "khóa" : "mở khóa";
    if (!confirm(`Bạn có chắc muốn ${action} tài khoản "${user.fullName}"?`))
      return;
    try {
      await toggleStatus(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: !u.status } : u)),
      );
    } catch {
      alert(ERROR_MESSAGES.SERVER);
    }
  };

  const handleChangeRole = async (userId, newRoleId) => {
    try {
      await changeRole(userId, Number(newRoleId));
      await loadData();
    } catch {
      alert(ERROR_MESSAGES.SERVER);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      await axiosClient.post("/UserManagement", {
        ...form,
        roleId: form.roleId ? Number(form.roleId) : null,
      });
      setShowModal(false);
      setForm({ fullName: "", email: "", password: "", phone: "", roleId: "" });
      await loadData();
    } catch (err) {
      setFormError(err.response?.data?.message || ERROR_MESSAGES.SERVER);
    } finally {
      setFormLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      {/* ── Header ── */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Quản lý Nhân sự & Người dùng</h1>
          <p style={styles.pageSub}>
            Quản lý tài khoản nhân viên và phân quyền hệ thống
          </p>
        </div>
        <button onClick={() => setShowModal(true)} style={styles.addBtn}>
          + Thêm người dùng
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={styles.statsRow}>
        <StatCard label="Tổng người dùng" value={total} color="#0ea5e9" />
        <StatCard
          label="Đang hoạt động"
          value={users.filter((u) => u.status === true).length}
          color="#22c55e"
        />
        <StatCard
          label="Bị khóa"
          value={users.filter((u) => u.status === false).length}
          color="#f59e0b"
        />
        <StatCard label="Vai trò" value={roles.length} color="#a855f7" />
      </div>

      {/* ── Filter ── */}
      <div style={styles.filterCard}>
        <input
          style={styles.searchInput}
          placeholder="Tìm theo Tên, Email, SĐT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={styles.filterRow}>
          <select
            style={styles.select}
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả vai trò</option>
            {roles.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>

          <select
            style={styles.select}
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Bị khóa</option>
          </select>

          <button
            onClick={() => {
              setSearch("");
              setFilterRole("");
              setFilterStatus("");
              setPage(1);
            }}
            style={styles.clearBtn}
          >
            Xóa lọc
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && <p style={styles.error}>{error}</p>}

      {/* ── Table ── */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <span style={styles.tableTitle}>
            Danh sách &nbsp;
            <span style={styles.badge}>{filteredUsers.length} kết quả</span>
          </span>
        </div>

        {loading ? (
          <p style={styles.loadingText}>Đang tải...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Họ và tên</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Số điện thoại</th>
                  <th style={styles.th}>Vai trò</th>
                  <th style={styles.th}>Trạng thái</th>
                  <th style={styles.th}>Ngày tạo</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={styles.empty}>
                      Không có dữ liệu
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.userCell}>
                          <div style={styles.avatarCircle}>
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
                                style={styles.avatarImg}
                                alt=""
                              />
                            ) : (
                              <span>{u.fullName?.[0]?.toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <p style={styles.userName}>{u.fullName}</p>
                            <p style={styles.userId}>ID #{u.id}</p>
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>{u.email}</td>
                      <td style={styles.td}>{u.phone || "—"}</td>
                      <td style={styles.td}>
                        <select
                          style={styles.roleSelect}
                          value={u.roleId || ""}
                          onChange={(e) =>
                            handleChangeRole(u.id, e.target.value)
                          }
                        >
                          <option value="">-- chọn --</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            background: u.status ? "#dcfce7" : "#fee2e2",
                            color: u.status ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {STATUS_LABEL[u.status] ?? "—"}
                        </span>
                      </td>
                      <td style={styles.td}>{formatDate(u.createdAt)}</td>
                      <td style={{ ...styles.td, textAlign: "center" }}>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          style={{
                            ...styles.actionBtn,
                            background: u.status ? "#fee2e2" : "#dcfce7",
                            color: u.status ? "#dc2626" : "#16a34a",
                          }}
                        >
                          {u.status ? "Khóa" : "Mở khóa"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={styles.pagination}>
            <span style={styles.paginationInfo}>
              Trang {page} / {totalPages} — {total} kết quả
            </span>
            <div style={styles.paginationBtns}>
              <button
                style={styles.pageBtn}
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                ←
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  style={{
                    ...styles.pageBtn,
                    background: p === page ? "#0ea5e9" : "#fff",
                    color: p === page ? "#fff" : "#374151",
                  }}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                style={styles.pageBtn}
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Thêm người dùng ── */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Thêm người dùng mới</h3>
            <form onSubmit={handleCreateUser} style={styles.modalForm}>
              <label style={styles.label}>Họ và tên *</label>
              <input
                style={styles.input}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />

              <label style={styles.label}>Email *</label>
              <input
                style={styles.input}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />

              <label style={styles.label}>Mật khẩu *</label>
              <input
                style={styles.input}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />

              <label style={styles.label}>Số điện thoại</label>
              <input
                style={styles.input}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />

              <label style={styles.label}>Vai trò</label>
              <select
                style={styles.input}
                value={form.roleId}
                onChange={(e) => setForm({ ...form, roleId: e.target.value })}
              >
                <option value="">-- chọn vai trò --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              {formError && <p style={styles.error}>{formError}</p>}

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormError("");
                  }}
                  style={styles.cancelBtn}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={styles.submitBtn}
                  disabled={formLoading}
                >
                  {formLoading ? "Đang tạo..." : "Tạo tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── StatCard component ────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: color + "20" }}>
        <div style={{ ...styles.statDot, background: color }} />
      </div>
      <div>
        <p style={styles.statLabel}>{label}</p>
        <p style={{ ...styles.statValue, color }}>{value}</p>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  pageTitle: { fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 },
  pageSub: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  addBtn: {
    padding: "10px 18px",
    background: "#0ea5e9",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 20,
  },
  statCard: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: "16px",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statDot: { width: 16, height: 16, borderRadius: "50%" },
  statLabel: { fontSize: 12, color: "#6b7280", margin: 0 },
  statValue: { fontSize: 22, fontWeight: 700, margin: 0 },
  filterCard: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: 20,
    marginBottom: 20,
  },
  searchInput: {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
    boxSizing: "border-box",
    outline: "none",
  },
  filterRow: { display: "flex", gap: 12 },
  select: {
    flex: 1,
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
  },
  clearBtn: {
    padding: "10px 16px",
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  },
  tableCard: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    overflow: "hidden",
  },
  tableHeader: { padding: "16px 20px", borderBottom: "1px solid #e5e7eb" },
  tableTitle: { fontSize: 14, fontWeight: 700, color: "#374151" },
  badge: {
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 12,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 999,
  },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: { background: "#f9fafb" },
  th: {
    padding: "12px 20px",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
  },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "14px 20px", fontSize: 14, color: "#374151" },
  userCell: { display: "flex", alignItems: "center", gap: 10 },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#e0f2fe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "#0369a1",
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover" },
  userName: { fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 },
  userId: { fontSize: 12, color: "#9ca3af", margin: 0 },
  roleSelect: {
    padding: "4px 8px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 13,
  },
  statusBadge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  },
  actionBtn: {
    padding: "5px 12px",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderTop: "1px solid #e5e7eb",
  },
  paginationInfo: { fontSize: 13, color: "#6b7280" },
  paginationBtns: { display: "flex", gap: 4 },
  pageBtn: {
    minWidth: 32,
    height: 32,
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 13,
    cursor: "pointer",
    background: "#fff",
    color: "#374151",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    padding: "32px 28px",
    width: 440,
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 20,
    color: "#111827",
  },
  modalForm: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 8 },
  input: {
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    padding: "9px 18px",
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  },
  submitBtn: {
    padding: "9px 18px",
    background: "#0ea5e9",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  loadingText: { padding: "40px", textAlign: "center", color: "#9ca3af" },
  empty: { padding: "40px", textAlign: "center", color: "#9ca3af" },
  error: { color: "#dc2626", fontSize: 13, margin: "4px 0" },
};
