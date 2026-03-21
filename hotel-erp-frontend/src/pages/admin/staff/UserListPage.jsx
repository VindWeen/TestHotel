// src/pages/admin/staff/UserListPage.jsx
// Giao diện khớp UserManagement.html + tích hợp API thực tế
import { useState, useEffect, useRef, useCallback } from "react";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleStatus,
  changeRole,
} from "../../../api/userManagementApi";
import { getRoles } from "../../../api/rolesApi";
import { useAdminAuthStore } from "../../../store/adminAuthStore";
import { logout } from "../../../api/authApi";
import { useNavigate } from "react-router-dom";

// ─── Constants ───────────────────────────────────────────────────────────────
const ROLE_BADGE = {
  Admin: "bg-purple-50 text-purple-600",
  Manager: "bg-emerald-50 text-emerald-600",
  Receptionist: "bg-blue-50 text-blue-600",
  Accountant: "bg-stone-100 text-stone-600",
  Housekeeping: "bg-yellow-50 text-yellow-700",
  Security: "bg-orange-50 text-orange-600",
  Chef: "bg-red-50 text-red-600",
  Waiter: "bg-pink-50 text-pink-600",
  "IT Support": "bg-cyan-50 text-cyan-600",
  Guest: "bg-gray-100 text-gray-500",
};

const ACTION_LABEL = {
  LoginAccount: "Đăng nhập",
  CreateAccount: "Tạo tài khoản",
  UpdateAccount: "Cập nhật",
  LockAccount: "Khóa tài khoản",
  UnlockAccount: "Mở khóa",
  ViewUsers: "Xem danh sách",
};

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ─── Toast System ─────────────────────────────────────────────────────────────
const TOAST_STYLE = {
  Success: {
    bg: "#1e3a2f",
    border: "#2d5a45",
    text: "#a7f3d0",
    prog: "#34d399",
    icon: "check_circle",
  },
  Error: {
    bg: "#3a1e1e",
    border: "#5a2d2d",
    text: "#fca5a5",
    prog: "#f87171",
    icon: "error",
  },
  Warning: {
    bg: "#3a2e1a",
    border: "#5a4820",
    text: "#fcd34d",
    prog: "#fbbf24",
    icon: "warning",
  },
  Info: {
    bg: "#1e2f3a",
    border: "#2d4a5a",
    text: "#93c5fd",
    prog: "#60a5fa",
    icon: "info",
  },
};

function Toast({ id, msg, type = "Success", action, dur = 4000, onDismiss }) {
  const s = TOAST_STYLE[type] || TOAST_STYLE.Info;
  const actTag = action && ACTION_LABEL[action] ? ACTION_LABEL[action] : null;
  const [leaving, setLeaving] = useState(false);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(id), 300);
  }, [id, onDismiss]);

  useEffect(() => {
    const t = setTimeout(dismiss, dur);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={leaving ? "toast-out" : "toast-in"}
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,.3)",
        pointerEvents: "auto",
        marginBottom: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "13px 13px 9px",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: "19px",
            flexShrink: 0,
            marginTop: "1px",
            fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20",
          }}
        >
          {s.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {actTag && (
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                opacity: 0.5,
                marginBottom: "2px",
              }}
            >
              {actTag}
            </div>
          )}
          <p
            style={{
              fontSize: "13px",
              fontWeight: 600,
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            {msg}
          </p>
        </div>
        <button
          onClick={dismiss}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            opacity: 0.4,
            padding: "2px",
            flexShrink: 0,
            color: "inherit",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "14px" }}
          >
            close
          </span>
        </button>
      </div>
      <div
        style={{
          margin: "0 12px 9px",
          height: "3px",
          borderRadius: "9999px",
          background: "rgba(255,255,255,.1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: "9999px",
            background: s.prog,
            animation: `toastProgress ${dur}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div
      style={{
        position: "fixed",
        top: "24px",
        right: "24px",
        zIndex: 200,
        minWidth: "280px",
        maxWidth: "360px",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ─── Skeleton Rows ────────────────────────────────────────────────────────────
function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i} className="border-b border-stone-50">
      <td className="px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
          <div>
            <div className="skeleton w-28 h-4 mb-1.5" />
            <div className="skeleton w-10 h-3" />
          </div>
        </div>
      </td>
      <td className="px-6 py-3">
        <div className="skeleton w-40 h-4" />
      </td>
      <td className="px-6 py-3">
        <div className="skeleton w-28 h-4" />
      </td>
      <td className="px-6 py-3">
        <div className="skeleton w-20 h-5 rounded-full" />
      </td>
      <td className="px-6 py-3">
        <div className="skeleton w-28 h-6 rounded-full" />
      </td>
      <td className="px-6 py-3 text-right">
        <div className="skeleton w-14 h-7 rounded-lg ml-auto" />
      </td>
    </tr>
  ));
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UserListPage() {
  const { user: currentUser, permissions, clearAuth } = useAdminAuthStore();
  const navigate = useNavigate();

  // State
  const [allUsers, setAllUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({
    search: "",
    roleId: "",
    status: "",
  });
  const [toasts, setToasts] = useState([]);

  // Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [togglingIds, setTogglingIds] = useState(new Set());

  // Form fields
  const [fFullName, setFFullName] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fPassword, setFPassword] = useState("");
  const [fRoleId, setFRoleId] = useState("");
  const [fGender, setFGender] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Top search sync
  const [topSearch, setTopSearch] = useState("");
  const debounceRef = useRef(null);

  // ── Toast helpers ──
  const showToast = useCallback(
    (msg, type = "Success", action = null, dur = 4000) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, msg, type, action, dur }]);
    },
    [],
  );

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showNotif = useCallback(
    (notif, fallbackMsg = "", fallbackType = "Info") => {
      if (notif?.message) {
        const t = notif.type || fallbackType;
        showToast(notif.message, t, notif.action || null);
      } else if (fallbackMsg) {
        showToast(fallbackMsg, fallbackType);
      }
    },
    [showToast],
  );

  // ── Load data ──
  const loadUsers = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await getUsers({ page: 1, pageSize: 200 });
      const data = res.data;
      let users = data.data || [];
      const total = data.pagination?.totalItems || users.length;
      if (total > 200) {
        const all = await getUsers({ page: 1, pageSize: total });
        if (all.data) users = all.data.data || users;
      }
      setAllUsers(users);
      if (data.notification) showNotif(data.notification);
    } catch (e) {
      showNotif(
        e?.response?.data?.notification,
        e?.response?.data?.message || "Không thể tải danh sách người dùng.",
        "Error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const res = await getRoles();
      setRoles(res.data?.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  // ── Apply filters ──
  useEffect(() => {
    let users = [...allUsers];
    const q = filters.search.toLowerCase().trim();
    if (q) {
      users = users.filter(
        (u) =>
          (u.fullName || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.phone || "").toLowerCase().includes(q),
      );
    }
    if (filters.roleId) {
      users = users.filter((u) => u.roleId === parseInt(filters.roleId));
    }
    if (filters.status === "active")
      users = users.filter((u) => u.status === true);
    if (filters.status === "locked") users = users.filter((u) => !u.status);
    setFiltered(users);
    setPage(1);
  }, [allUsers, filters]);

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedUsers = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ── Toggle status ──
  const handleToggle = async (userId, currentStatus) => {
    if (togglingIds.has(userId)) return;
    setTogglingIds((prev) => new Set(prev).add(userId));
    try {
      const res = await toggleStatus(userId);
      const data = res.data;
      const isActive = data.status === true || data.status === 1;
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: isActive } : u)),
      );
      showNotif(
        data.notification,
        isActive ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản.",
        isActive ? "Success" : "Warning",
      );
    } catch (e) {
      showNotif(
        e?.response?.data?.notification,
        e?.response?.data?.message || "Không thể thay đổi trạng thái.",
        "Error",
      );
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  // ── Detail modal ──
  const openDetail = async (userId) => {
    setDetailUser(null);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const res = await getUserById(userId);
      setDetailUser(res.data);
    } catch (e) {
      setDetailModalOpen(false);
      showToast(
        e?.response?.data?.message || "Không thể tải thông tin.",
        "Error",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Add modal ──
  const openAdd = () => {
    setEditingId(null);
    resetForm();
    setAddModalOpen(true);
  };

  // ── Edit modal ──
  const openEdit = async (userId) => {
    setEditingId(userId);
    resetForm();
    setAddModalOpen(true);
    try {
      const res = await getUserById(userId);
      const u = res.data;
      setFFullName(u.fullName || "");
      setFEmail(u.email || "");
      setFPhone(u.phone || "");
      setFGender(u.gender || "");
      setFRoleId(u.roleId?.toString() || "");
    } catch (e) {
      setAddModalOpen(false);
      showToast(
        e?.response?.data?.message || "Không thể tải thông tin.",
        "Error",
      );
    }
  };

  const resetForm = () => {
    setFFullName("");
    setFEmail("");
    setFPhone("");
    setFPassword("");
    setFRoleId("");
    setFGender("");
    setFormError("");
    setFieldErrors({});
  };

  // ── Form submit ──
  const validateForm = () => {
    const errs = {};
    if (!fFullName.trim()) errs.fullName = "Họ và tên không được để trống.";
    if (!editingId) {
      if (!fEmail.trim()) errs.email = "Email không được để trống.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fEmail))
        errs.email = "Email không hợp lệ.";
      if (!fPassword) errs.password = "Mật khẩu không được để trống.";
      else if (fPassword.length < 6)
        errs.password = "Mật khẩu phải ít nhất 6 ký tự.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setFormLoading(true);
    setFormError("");
    try {
      if (editingId) {
        // Update
        const res = await updateUser(editingId, {
          fullName: fFullName,
          phone: fPhone || null,
          gender: fGender || null,
        });
        // Change role if changed
        const cur = allUsers.find((u) => u.id === editingId);
        if (fRoleId && cur && parseInt(fRoleId) !== cur.roleId) {
          const rRes = await changeRole(editingId, parseInt(fRoleId));
          showNotif(rRes.data?.notification);
        }
        showNotif(
          res.data?.notification,
          res.data?.message || "Cập nhật thành công!",
          "Success",
        );
      } else {
        // Create
        const res = await createUser({
          fullName: fFullName,
          email: fEmail,
          password: fPassword,
          phone: fPhone || null,
          gender: fGender || null,
          roleId: fRoleId ? parseInt(fRoleId) : null,
        });
        showNotif(
          res.data?.notification,
          res.data?.message || "Tạo tài khoản thành công!",
          "Success",
        );
      }
      setAddModalOpen(false);
      await loadUsers();
    } catch (e) {
      setFormError(e?.response?.data?.message || "Có lỗi xảy ra.");
      showNotif(e?.response?.data?.notification);
    } finally {
      setFormLoading(false);
    }
  };

  // ── Search debounce ──
  const onSearch = (val) => {
    setTopSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: val.trim() }));
    }, 320);
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const users = filtered.length ? filtered : allUsers;
    if (!users.length) {
      showToast("Không có dữ liệu để xuất.", "Warning");
      return;
    }
    const h = [
      "ID",
      "Họ tên",
      "Email",
      "Điện thoại",
      "Vai trò",
      "Hạng",
      "Điểm",
      "Trạng thái",
      "Ngày tạo",
    ];
    const rows = users.map((u) => [
      u.id,
      u.fullName || "",
      u.email || "",
      u.phone || "",
      u.roleName || "",
      u.membershipTier || "",
      u.loyaltyPoints || 0,
      u.status === true ? "Hoạt động" : "Đã khóa",
      u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "",
    ]);
    const csv = [h, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `nhan-su_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Đã xuất ${users.length} bản ghi.`, "Success");
  };

  // ── Logout ──
  const handleLogout = async () => {
    try {
      const res = await logout();
      showNotif(
        res?.data?.notification,
        res?.data?.message || "Đã đăng xuất.",
        "Info",
      );
    } catch {}
    clearAuth();
    setTimeout(() => navigate("/login"), 700);
  };

  // ── Pagination buttons ──
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const DELTA = 2;
    const lo = Math.max(1, page - DELTA);
    const hi = Math.min(totalPages, page + DELTA);
    const nums = [];
    for (let i = lo; i <= hi; i++) nums.push(i);

    const btn = (p, label, disabled, isActive = false) => (
      <button
        key={`pg-${p}-${label}`}
        onClick={() => !disabled && setPage(p)}
        disabled={disabled}
        className={`pg-btn${isActive ? " active" : ""}${typeof label !== "number" ? " icon" : ""}`}
      >
        {typeof label === "number" ? (
          label
        ) : (
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "18px" }}
          >
            {label}
          </span>
        )}
      </button>
    );

    return (
      <div className="flex items-center gap-1">
        {btn(page - 1, "chevron_left", page <= 1)}
        {nums[0] > 1 && (
          <>
            {btn(1, 1, false)}
            {nums[0] > 2 && (
              <span className="px-1 text-stone-300 text-sm">...</span>
            )}
          </>
        )}
        {nums.map((n) => btn(n, n, false, n === page))}
        {nums[nums.length - 1] < totalPages && (
          <>
            {nums[nums.length - 1] < totalPages - 1 && (
              <span className="px-1 text-stone-300 text-sm">...</span>
            )}
            {btn(totalPages, totalPages, false)}
          </>
        )}
        {btn(page + 1, "chevron_right", page >= totalPages)}
      </div>
    );
  };

  const hasPermission = (code) =>
    permissions.some(
      (p) =>
        (typeof p === "string" && p === code) ||
        (typeof p === "object" && p.permissionCode === code),
    );

  const ch = (currentUser?.fullName || "A")[0].toUpperCase();
  const s = (page - 1) * pageSize + 1;
  const e2 = Math.min(page * pageSize, filtered.length);
  const hasFilter = filters.search || filters.roleId || filters.status;

  return (
    <div className="bg-surface text-on-surface antialiased font-body min-h-screen">
      {/* ─ Styles ─ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        body { font-family: 'Manrope', sans-serif; -webkit-font-smoothing: antialiased; }
        .material-symbols-outlined { font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; vertical-align:middle; }

        .toggle-switch { position:relative; display:inline-block; width:44px; height:24px; }
        .toggle-switch input { opacity:0; width:0; height:0; }
        .slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#cbd5e1; transition:.4s; border-radius:24px; }
        .slider:before { position:absolute; content:""; height:18px; width:18px; left:3px; bottom:3px; background-color:white; transition:.4s; border-radius:50%; }
        input:checked + .slider { background-color:#4f645b; }
        input:checked + .slider:before { transform:translateX(20px); }
        input:disabled + .slider { opacity:0.5; cursor:not-allowed; }

        @keyframes spin { to{transform:rotate(360deg)} }
        .spinner-sm { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,.35); border-top-color:white; border-radius:50%; animation:spin .65s linear infinite; vertical-align:middle; margin-right:6px; }
        .spinner-dark { border-color:rgba(79,100,91,.2); border-top-color:#4f645b; }

        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        .skeleton { background:linear-gradient(90deg,#e8e8e0 25%,#f2f2ea 50%,#e8e8e0 75%); background-size:600px; animation:shimmer 1.4s infinite; border-radius:6px; }

        @keyframes toastIn  { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes toastOut { from{transform:translateX(0);opacity:1} to{transform:translateX(110%);opacity:0} }
        .toast-in  { animation:toastIn  .35s cubic-bezier(.22,1,.36,1) forwards; }
        .toast-out { animation:toastOut .28s cubic-bezier(.55,0,1,.45) forwards; }
        @keyframes toastProgress { from{width:100%} to{width:0} }

        @keyframes fadeRow { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .fade-row { animation:fadeRow .22s ease forwards; }
        tbody tr { transition:background .12s; }

        .modal-backdrop { backdrop-filter:blur(4px); }

        .pg-btn {
          width:2rem; height:2rem; border-radius:.5rem;
          display:flex; align-items:center; justify-content:center;
          font-size:.875rem; font-weight:500;
          color:#6b7280; background:transparent; border:none; cursor:pointer;
          transition:background .15s, color .15s;
        }
        .pg-btn:hover:not(:disabled) { background:#f3f4f6; }
        .pg-btn.active { background:#4f645b; color:#e7fef3; font-weight:700; cursor:default; }
        .pg-btn:disabled { opacity:.35; cursor:not-allowed; }
        .pg-btn.icon { color:#9ca3af; }
      `}</style>

      {/* ─ Toast Container ─ */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ═══════ MODAL: THÊM / SỬA ═══════ */}
      {addModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">
                {editingId ? "Chỉnh sửa thông tin" : "Thêm người dùng mới"}
              </h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <form noValidate onSubmit={handleSubmit}>
              {/* Full Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={fFullName}
                  onChange={(e) => setFFullName(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none transition"
                />
                {fieldErrors.fullName && (
                  <p className="text-xs mt-1 text-error">
                    {fieldErrors.fullName}
                  </p>
                )}
              </div>
              {/* Email */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  placeholder="email@hotel.com"
                  value={fEmail}
                  onChange={(e) => setFEmail(e.target.value)}
                  disabled={!!editingId}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {fieldErrors.email && (
                  <p className="text-xs mt-1 text-error">{fieldErrors.email}</p>
                )}
              </div>
              {/* Phone */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">SĐT</label>
                <input
                  type="tel"
                  placeholder="09xxxxxxxx"
                  value={fPhone}
                  onChange={(e) => setFPhone(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none transition"
                />
              </div>
              {/* Password — only for create */}
              {!editingId && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Mật khẩu *
                  </label>
                  <input
                    type="password"
                    placeholder="Tối thiểu 6 ký tự"
                    value={fPassword}
                    onChange={(e) => setFPassword(e.target.value)}
                    className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none transition"
                  />
                  {fieldErrors.password && (
                    <p className="text-xs mt-1 text-error">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>
              )}
              {/* Role */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Vai trò
                </label>
                <select
                  value={fRoleId}
                  onChange={(e) => setFRoleId(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none bg-white"
                >
                  <option value="">-- Chọn vai trò --</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* Gender */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Giới tính
                </label>
                <select
                  value={fGender}
                  onChange={(e) => setFGender(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none bg-white"
                >
                  <option value="">-- Chọn --</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
              {/* Form error */}
              {formError && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                  <span
                    className="material-symbols-outlined text-red-500 mt-0.5"
                    style={{ fontSize: "16px" }}
                  >
                    error
                  </span>
                  <span>{formError}</span>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-5 py-2 border rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold hover:opacity-90 transition-all disabled:opacity-60 flex items-center"
                >
                  {formLoading && <span className="spinner-sm" />}
                  {editingId ? "Lưu" : "Thêm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ MODAL: CHI TIẾT ═══════ */}
      {detailModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailModalOpen(false);
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
            style={{
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="flex items-center justify-between px-8 pt-7 pb-4 border-b border-stone-100 flex-shrink-0">
              <h3 className="text-xl font-bold">Chi tiết người dùng</h3>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="px-8 py-5 overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="py-10 flex justify-center">
                  <div
                    className="spinner-sm spinner-dark"
                    style={{
                      width: "24px",
                      height: "24px",
                      borderWidth: "3px",
                    }}
                  />
                </div>
              ) : detailUser ? (
                <>
                  <div className="flex items-center gap-4 mb-5 pb-4 border-b border-stone-100">
                    {detailUser.avatarUrl ? (
                      <img
                        src={detailUser.avatarUrl}
                        className="w-14 h-14 rounded-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                        {(detailUser.fullName || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-bold">
                        {detailUser.fullName || "—"}
                      </p>
                      <p className="text-sm text-stone-500">
                        {detailUser.email || "—"}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            detailUser.status
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-stone-100 text-stone-500"
                          }`}
                        >
                          {detailUser.status ? "Hoạt động" : "Đã khóa"}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            ROLE_BADGE[detailUser.roleName] ||
                            "bg-stone-100 text-stone-500"
                          }`}
                        >
                          {detailUser.roleName || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      ["Vai trò", detailUser.roleName || "—"],
                      ["Hạng thành viên", detailUser.membershipTier || "—"],
                      ["Điện thoại", detailUser.phone || "—"],
                      ["Giới tính", detailUser.gender || "—"],
                      ["Ngày sinh", detailUser.dateOfBirth || "—"],
                      ["CCCD / Hộ chiếu", detailUser.nationalId || "—"],
                      ["Điểm tích lũy", detailUser.loyaltyPoints ?? "—"],
                      ["Điểm khả dụng", detailUser.loyaltyPointsUsable ?? "—"],
                      ["Địa chỉ", detailUser.address || "—"],
                      [
                        "Đăng nhập lần cuối",
                        detailUser.lastLoginAt
                          ? new Date(detailUser.lastLoginAt).toLocaleString(
                              "vi-VN",
                            )
                          : "—",
                      ],
                      [
                        "Ngày tạo",
                        detailUser.createdAt
                          ? new Date(detailUser.createdAt).toLocaleDateString(
                              "vi-VN",
                            )
                          : "—",
                      ],
                    ].map(([k, v], i) => (
                      <div key={i} className="bg-stone-50 rounded-xl p-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-0.5">
                          {k}
                        </p>
                        <p
                          className="text-sm font-semibold text-stone-700 truncate"
                          title={String(v)}
                        >
                          {String(v)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-4 pt-4 border-t border-stone-100">
                    <button
                      onClick={() => {
                        setDetailModalOpen(false);
                        openEdit(detailUser.id);
                      }}
                      className="px-4 py-2 text-sm font-bold bg-primary text-on-primary rounded-xl hover:opacity-90 transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">
                        edit_square
                      </span>
                      Chỉnh sửa
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ LAYOUT ═══════ */}
      {/* SideNavBar */}
      <aside className="h-screen w-64 fixed left-0 top-0 border-r border-stone-100 bg-white flex flex-col py-8 px-4 z-40">
        <div className="mb-10 px-4">
          <h1 className="text-xl font-bold tracking-widest text-emerald-900 uppercase">
            The Ethereal
          </h1>
          <p className="text-[10px] tracking-[0.2em] text-stone-500 uppercase mt-1">
            Hotel ERP
          </p>
        </div>
        <nav className="flex-1 space-y-1">
          <a
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-stone-500 hover:text-emerald-700 hover:bg-emerald-50"
            href="#"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-sm font-medium">Dashboard</span>
          </a>
          <a
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-stone-500 hover:text-emerald-700 hover:bg-emerald-50"
            href="#"
          >
            <span className="material-symbols-outlined">meeting_room</span>
            <span className="text-sm font-medium">Quản lý Phòng</span>
          </a>
          <a
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-stone-500 hover:text-emerald-700 hover:bg-emerald-50"
            href="#"
          >
            <span className="material-symbols-outlined">inventory_2</span>
            <span className="text-sm font-medium">Vật tư &amp; Minibar</span>
          </a>
          <a
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-stone-500 hover:text-emerald-700 hover:bg-emerald-50"
            href="#"
          >
            <span className="material-symbols-outlined">
              confirmation_number
            </span>
            <span className="text-sm font-medium">Booking &amp; Voucher</span>
          </a>
          <a
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-emerald-900 bg-emerald-50/50 font-bold"
            href="#"
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24",
              }}
            >
              group
            </span>
            <span className="text-sm font-medium">Danh sách Nhân sự</span>
          </a>
        </nav>
        <div className="mt-auto px-4 space-y-2">
          <div className="px-2 py-2 rounded-xl bg-stone-50 flex items-center gap-2">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                alt=""
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                {ch}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-stone-800 truncate">
                {currentUser?.fullName || "—"}
              </p>
              <p className="text-[10px] text-stone-500 truncate">
                {currentUser?.role || "—"}
              </p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="w-full py-3 bg-primary text-on-primary rounded-xl font-semibold text-sm shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Thêm người dùng
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 border border-stone-200 text-stone-500 rounded-xl font-medium text-sm hover:bg-stone-50 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* TopNavBar */}
      <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 z-30 bg-white/80 backdrop-blur-md border-b border-stone-100 flex items-center justify-between px-8">
        <div className="flex items-center gap-8">
          <div className="relative w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
              search
            </span>
            <input
              className="w-full bg-stone-100 border-none rounded-full py-2 pl-10 pr-4 text-xs focus:ring-1 focus:ring-primary/40 outline-none"
              placeholder="Tìm kiếm tài nguyên..."
              type="text"
              value={topSearch}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <nav className="flex gap-6">
            <a
              className="text-stone-500 font-medium text-sm hover:text-emerald-700 transition-all"
              href="#"
            >
              Hotels
            </a>
            <a
              className="text-emerald-800 border-b-2 border-emerald-800 pb-1 font-semibold text-sm"
              href="#"
            >
              Analytics
            </a>
            <a
              className="text-stone-500 font-medium text-sm hover:text-emerald-700 transition-all"
              href="#"
            >
              Reports
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            <button className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <button className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
          </div>
          <div className="h-8 w-px bg-stone-200 mx-2" />
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="text-right">
              <p className="text-xs font-bold text-on-surface">
                {currentUser?.fullName || "—"}
              </p>
              <p className="text-[10px] text-stone-500">
                {currentUser?.role || "—"}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {ch}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="ml-64 pt-20 p-8 min-h-screen bg-[#f8f9fa]">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="text-2xl font-bold text-on-surface tracking-tight">
                Quản lý Nhân sự &amp; Người dùng
              </h2>
              <p className="text-sm text-stone-500 mt-1">
                Tổng:{" "}
                <span className="font-semibold text-on-surface">
                  {allUsers.length}
                </span>{" "}
                người dùng
                {hasFilter && filtered.length !== allUsers.length && (
                  <span className="text-primary ml-1">
                    (lọc:{" "}
                    <span className="font-semibold">{filtered.length}</span>)
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportCSV}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-white text-on-surface border border-stone-200 hover:bg-stone-50 transition-colors flex items-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">
                  file_download
                </span>
                Xuất báo cáo
              </button>
              <button
                onClick={openAdd}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-primary text-on-primary hover:opacity-90 transition-all flex items-center gap-2 shadow-md"
              >
                <span className="material-symbols-outlined text-sm">
                  person_add
                </span>
                Thêm người dùng
              </button>
            </div>
          </div>

          {/* Filters */}
          <section className="flex flex-wrap gap-4 items-end mb-6">
            <div className="flex-1 min-w-[320px]">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-lg">
                  search
                </span>
                <input
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary/40 focus:bg-white outline-none"
                  placeholder="Họ tên, Email, SĐT..."
                  type="text"
                  value={topSearch}
                  onChange={(e) => onSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="w-48">
              <select
                className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary/40 outline-none"
                value={filters.roleId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, roleId: e.target.value }))
                }
              >
                <option value="">Chọn vai trò</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-48">
              <select
                className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary/40 outline-none"
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="">Chọn trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="locked">Đã khóa</option>
              </select>
            </div>
            <button
              onClick={() => {
                clearTimeout(debounceRef.current);
                setTopSearch("");
                setFilters({ search: "", roleId: "", status: "" });
              }}
              className="bg-stone-50 border border-stone-200 text-stone-600 p-2.5 rounded-xl hover:bg-stone-100 transition-colors"
              title="Xóa bộ lọc"
            >
              <span className="material-symbols-outlined">tune</span>
            </button>
          </section>

          {/* Data Table */}
          <div className="bg-white shadow-sm border border-stone-100 overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Họ và tên
                    </th>
                    <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Email
                    </th>
                    <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Số điện thoại
                    </th>
                    <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Vai trò
                    </th>
                    <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-stone-500 text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows />
                  ) : paginatedUsers.length === 0 ? null : (
                    paginatedUsers.map((u, i) => {
                      const active = u.status === true || u.status === 1;
                      const initial = (u.fullName || "?")[0].toUpperCase();
                      const roleClass =
                        ROLE_BADGE[u.roleName] || "bg-stone-100 text-stone-500";
                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-stone-50/50 transition-colors fade-row border-b border-stone-50"
                          style={{
                            animationDelay: `${Math.min(i * 25, 200)}ms`,
                          }}
                        >
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              {u.avatarUrl ? (
                                <img
                                  alt="Avatar"
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                  src={u.avatarUrl}
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                                  {initial}
                                </div>
                              )}
                              <div>
                                <span className="font-medium text-stone-800 text-sm">
                                  {u.fullName || "—"}
                                </span>
                                <p className="text-xs text-stone-400">
                                  #{u.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-sm text-stone-600">
                            {u.email || "—"}
                          </td>
                          <td className="px-6 py-3 text-sm text-stone-600">
                            {u.phone || "—"}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`px-2.5 py-0.5 ${roleClass} text-[10px] font-bold rounded-full uppercase`}
                            >
                              {u.roleName || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-medium ${
                                  active ? "text-emerald-600" : "text-stone-400"
                                }`}
                              >
                                {active ? "Hoạt động" : "Đã khóa"}
                              </span>
                              <label className="toggle-switch">
                                <input
                                  type="checkbox"
                                  checked={active}
                                  disabled={togglingIds.has(u.id)}
                                  onChange={() => handleToggle(u.id, active)}
                                />
                                <span className="slider" />
                              </label>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openDetail(u.id)}
                                className="text-stone-300 hover:text-stone-500 transition-colors"
                                title="Xem chi tiết"
                              >
                                <span className="material-symbols-outlined text-xl">
                                  visibility
                                </span>
                              </button>
                              <button
                                onClick={() => openEdit(u.id)}
                                className="text-stone-300 hover:text-stone-500 transition-colors"
                                title="Chỉnh sửa"
                              >
                                <span className="material-symbols-outlined text-xl">
                                  edit_square
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Empty state */}
            {!loading && paginatedUsers.length === 0 && (
              <div className="py-16 text-center">
                <span className="material-symbols-outlined text-5xl text-stone-300 mb-3 block">
                  group_off
                </span>
                <p className="text-stone-400 font-medium">
                  Không tìm thấy người dùng nào
                </p>
              </div>
            )}

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-500">Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value));
                    setPage(1);
                  }}
                  className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-primary/40 outline-none"
                >
                  <option value="10">10/trang</option>
                  <option value="20">20/trang</option>
                  <option value="50">50/trang</option>
                </select>
                {filtered.length > 0 && (
                  <span className="text-xs text-stone-400">
                    {s}–{e2} / {filtered.length}
                  </span>
                )}
              </div>
              {renderPagination()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
