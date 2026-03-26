// src/pages/admin/staff/UserListPage.jsx
// Giao diện khớp 1:1 với UserManagement.html + tích hợp API thực tế
import { useState, useEffect, useRef, useCallback } from "react";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleStatus,
  changeRole,
} from "../../api/userManagementApi";
import { getRoles } from "../../api/rolesApi";
import { useAdminAuthStore } from "../../store/adminAuthStore";

import { useNavigate } from "react-router-dom";

// ─── Constants ────────────────────────────────────────────────────────────────
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

const ACTION_LABELS = {
  LoginAccount: "Đăng nhập",
  CreateAccount: "Tạo tài khoản",
  UpdateAccount: "Cập nhật",
  LockAccount: "Khóa tài khoản",
  UnlockAccount: "Mở khóa",
  ViewUsers: "Xem danh sách",
};

// ─── Toast Component ──────────────────────────────────────────────────────────
const TOAST_STYLES = {
  success: {
    bg: "#1e3a2f",
    border: "#2d5a45",
    text: "#a7f3d0",
    prog: "#34d399",
    icon: "check_circle",
  },
  error: {
    bg: "#3a1e1e",
    border: "#5a2d2d",
    text: "#fca5a5",
    prog: "#f87171",
    icon: "error",
  },
  warning: {
    bg: "#3a2e1a",
    border: "#5a4820",
    text: "#fcd34d",
    prog: "#fbbf24",
    icon: "warning",
  },
  info: {
    bg: "#1e2f3a",
    border: "#2d4a5a",
    text: "#93c5fd",
    prog: "#60a5fa",
    icon: "info",
  },
};

function Toast({ id, msg, type = "success", action, dur = 4000, onDismiss }) {
  const s = TOAST_STYLES[type] || TOAST_STYLES.info;
  const actLabel =
    action && ACTION_LABELS[action] ? ACTION_LABELS[action] : null;
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), dur);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,.3)",
        pointerEvents: "auto",
        marginBottom: 10,
        animation: "toastIn .35s cubic-bezier(.22,1,.36,1) forwards",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "13px 13px 9px",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 19,
            flexShrink: 0,
            marginTop: 1,
            fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20",
          }}
        >
          {s.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {actLabel && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                opacity: 0.5,
                marginBottom: 2,
              }}
            >
              {actLabel}
            </div>
          )}
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            {msg}
          </p>
        </div>
        <button
          onClick={() => onDismiss(id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            opacity: 0.4,
            padding: 2,
            color: "inherit",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            close
          </span>
        </button>
      </div>
      <div
        style={{
          margin: "0 12px 9px",
          height: 3,
          borderRadius: 9999,
          background: "rgba(255,255,255,.1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 9999,
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
        top: 24,
        right: 24,
        zIndex: 300,
        minWidth: 280,
        maxWidth: 360,
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
    <tr key={i}>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="skeleton w-9 h-9 rounded-full" />
          <div>
            <div className="skeleton w-28 h-4 mb-1" />
            <div className="skeleton w-10 h-3" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="skeleton w-40 h-4" />
      </td>
      <td className="px-6 py-4">
        <div className="skeleton w-28 h-4" />
      </td>
      <td className="px-6 py-4">
        <div className="skeleton w-24 h-5 rounded-full" />
      </td>
      <td className="px-6 py-4">
        <div className="skeleton w-32 h-6 rounded-full" />
      </td>
      <td className="px-6 py-4">
        <div className="skeleton w-16 h-8 rounded-lg ml-auto" />
      </td>
    </tr>
  ));
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UserListPage() {
  const { permissions } = useAdminAuthStore();
  const navigate = useNavigate();

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
  const [togglingIds, setTogglingIds] = useState(new Set());

  // Modal: Thêm/Sửa
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [fFullName, setFFullName] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fPassword, setFPassword] = useState("");
  const [fRoleId, setFRoleId] = useState("");
  const [fGender, setFGender] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formLoading, setFormLoading] = useState(false);

  // Modal: Chi tiết
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [topSearch, setTopSearch] = useState("");
  const debounceRef = useRef(null);

  // ── Toast helpers ──
  const showToast = useCallback(
    (msg, type = "success", action = null, dur = 4000) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, msg, type, action, dur }]);
    },
    [],
  );

  const dismissToast = useCallback(
    (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  const showNotif = useCallback(
    (notif, fallbackMsg = "", fallbackType = "info") => {
      if (notif?.message) {
        const t = (notif.type || fallbackType).toLowerCase();
        showToast(
          notif.message,
          ["success", "error", "warning", "info"].includes(t)
            ? t
            : fallbackType,
          notif.action || null,
        );
      } else if (fallbackMsg) {
        showToast(fallbackMsg, fallbackType);
      }
    },
    [showToast],
  );

  // ── Load users ──
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
    } catch (e) {
      showNotif(
        e?.response?.data?.notification,
        e?.response?.data?.message || "Không thể tải danh sách người dùng.",
        "error",
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
    if (q)
      users = users.filter(
        (u) =>
          (u.fullName || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.phone || "").toLowerCase().includes(q),
      );
    if (filters.roleId)
      users = users.filter((u) => u.roleId === parseInt(filters.roleId));
    if (filters.status === "active")
      users = users.filter((u) => u.status === true);
    if (filters.status === "locked") users = users.filter((u) => !u.status);
    setFiltered(users);
    setPage(1);
  }, [allUsers, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedUsers = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ── Toggle status ──
  const handleToggle = async (userId) => {
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
        isActive ? "success" : "warning",
      );
    } catch (e) {
      showNotif(
        e?.response?.data?.notification,
        e?.response?.data?.message || "Không thể thay đổi trạng thái.",
        "error",
      );
    } finally {
      setTogglingIds((prev) => {
        const n = new Set(prev);
        n.delete(userId);
        return n;
      });
    }
  };

  // ── Detail modal — fetch trước, mở modal sau (tránh flash skeleton) ──
  const openDetail = async (userId) => {
    try {
      const res = await getUserById(userId);
      setDetailUser(res.data);
      setDetailModalOpen(true);
    } catch (e) {
      showToast(
        e?.response?.data?.message || "Không thể tải thông tin.",
        "error",
      );
    }
  };

  // ── Add/Edit modal ──
  const openAdd = () => {
    setEditingId(null);
    resetForm();
    setAddModalOpen(true);
  };

  const openEdit = async (userId) => {
    try {
      const res = await getUserById(userId);
      const u = res.data;
      setEditingId(userId);
      setFFullName(u.fullName || "");
      setFEmail(u.email || "");
      setFPhone(u.phone || "");
      setFGender(u.gender || "");
      setFRoleId(u.roleId?.toString() || "");
      setFormError("");
      setFieldErrors({});
      setAddModalOpen(true);
    } catch (e) {
      showToast(
        e?.response?.data?.message || "Không thể tải thông tin.",
        "error",
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

  // ── Form validation & submit ──
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
        const cur = allUsers.find((u) => u.id === editingId);
        const roleChanged = fRoleId && cur && parseInt(fRoleId) !== cur.roleId;

        const promises = [
          updateUser(editingId, { fullName: fFullName, phone: fPhone || null, gender: fGender || null }),
          ...(roleChanged ? [changeRole(editingId, parseInt(fRoleId))] : []),
        ];

        const [res, rRes] = await Promise.all(promises);
        if (roleChanged && rRes) showNotif(rRes.data?.notification);
        showNotif(
          res.data?.notification,
          res.data?.message || "Cập nhật thành công!",
          "success",
        );
      } else {
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
          "success",
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
    debounceRef.current = setTimeout(
      () => setFilters((f) => ({ ...f, search: val.trim() })),
      320,
    );
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const users = filtered.length ? filtered : allUsers;
    if (!users.length) {
      showToast("Không có dữ liệu để xuất.", "warning");
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
    showToast(`Đã xuất ${users.length} bản ghi.`, "success");
  };



  // ── Pagination ──
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const DELTA = 2;
    const lo = Math.max(1, page - DELTA),
      hi = Math.min(totalPages, page + DELTA);
    const nums = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

    const Btn = ({ p, label, disabled, active }) => (
      <button
        key={`pg-${p}-${label}`}
        onClick={() => !disabled && setPage(p)}
        disabled={disabled}
        className={`pg-btn${active ? " active" : ""}${typeof label !== "number" ? " icon" : ""}`}
      >
        {typeof label === "number" ? (
          label
        ) : (
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {label}
          </span>
        )}
      </button>
    );

    return (
      <div className="flex items-center gap-1">
        <Btn p={page - 1} label="chevron_left" disabled={page <= 1} />
        {nums[0] > 1 && (
          <>
            <Btn p={1} label={1} />
            {nums[0] > 2 && (
              <span className="px-1 text-stone-300 text-sm">...</span>
            )}
          </>
        )}
        {nums.map((n) => (
          <Btn key={n} p={n} label={n} active={n === page} />
        ))}
        {nums[nums.length - 1] < totalPages && (
          <>
            {nums[nums.length - 1] < totalPages - 1 && (
              <span className="px-1 text-stone-300 text-sm">...</span>
            )}
            <Btn p={totalPages} label={totalPages} />
          </>
        )}
        <Btn p={page + 1} label="chevron_right" disabled={page >= totalPages} />
      </div>
    );
  };

  const hasFilter = filters.search || filters.roleId || filters.status;
  const start = (page - 1) * pageSize + 1,
    end = Math.min(page * pageSize, filtered.length);

  return (
    <>
      {/* ── Global Styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        .material-symbols-outlined { font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; vertical-align:middle; }

        .toggle-switch { position:relative; display:inline-block; width:44px; height:24px; }
        .toggle-switch input { opacity:0; width:0; height:0; }
        .slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#cbd5e1; transition:.4s; border-radius:24px; }
        .slider:before { position:absolute; content:""; height:18px; width:18px; left:3px; bottom:3px; background-color:white; transition:.4s; border-radius:50%; }
        input:checked + .slider { background-color:#4f645b; }
        input:checked + .slider:before { transform:translateX(20px); }
        input:disabled + .slider { opacity:0.5; cursor:not-allowed; }

        @keyframes spin { to { transform:rotate(360deg) } }
        .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,.35); border-top-color:white; border-radius:50%; animation:spin .65s linear infinite; vertical-align:middle; margin-right:6px; }
        .spinner-dark { border-color:rgba(79,100,91,.2); border-top-color:#4f645b; }

        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        .skeleton { background:linear-gradient(90deg,#e8e8e0 25%,#f2f2ea 50%,#e8e8e0 75%); background-size:600px; animation:shimmer 1.4s infinite; border-radius:6px; }

        @keyframes toastIn  { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes toastOut { from{transform:translateX(0);opacity:1} to{transform:translateX(110%);opacity:0} }
        @keyframes toastProgress { from{width:100%} to{width:0} }

        @keyframes fadeRow { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .fade-row { animation:fadeRow .22s ease forwards; }
        tbody tr { transition:background .12s; }

        .modal-backdrop { backdrop-filter:blur(4px); }

        .pg-btn { width:2rem; height:2rem; border-radius:.5rem; display:flex; align-items:center; justify-content:center; font-size:.875rem; font-weight:500; color:#6b7280; background:transparent; border:none; cursor:pointer; transition:background .15s,color .15s; }
        .pg-btn:hover:not(:disabled) { background:#f3f4f6; }
        .pg-btn.active { background:#4f645b; color:#e7fef3; font-weight:700; cursor:default; }
        .pg-btn:disabled { opacity:.35; cursor:not-allowed; }
        .pg-btn.icon { color:#9ca3af; }
      `}</style>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ══════ MODALS ══════ */}
      {addModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 modal-backdrop flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setAddModalOpen(false)}
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
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Họ và tên *</label>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={fFullName}
                  onChange={(e) => setFFullName(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none transition"
                />
                {fieldErrors.fullName && (
                  <p className="text-xs mt-1 text-red-600">{fieldErrors.fullName}</p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  placeholder="email@hotel.com"
                  value={fEmail}
                  onChange={(e) => setFEmail(e.target.value)}
                  disabled={!!editingId}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {fieldErrors.email && (
                  <p className="text-xs mt-1 text-red-600">{fieldErrors.email}</p>
                )}
              </div>
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
              {!editingId && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Mật khẩu *</label>
                  <input
                    type="password"
                    placeholder="Tối thiểu 6 ký tự"
                    value={fPassword}
                    onChange={(e) => setFPassword(e.target.value)}
                    className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none transition"
                  />
                  {fieldErrors.password && (
                    <p className="text-xs mt-1 text-red-600">{fieldErrors.password}</p>
                  )}
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Vai trò</label>
                <select
                  value={fRoleId}
                  onChange={(e) => setFRoleId(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none bg-white"
                >
                  <option value="">-- Chọn vai trò --</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Giới tính</label>
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
              {formError && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                  <span className="material-symbols-outlined text-red-500 mt-0.5" style={{ fontSize: 16 }}>error</span>
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
                  style={{ backgroundColor: "#4f645b", color: "#e7fef3" }}
                >
                  {formLoading && <span className="spinner" />}
                  {editingId ? "Lưu" : "Thêm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 modal-backdrop flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setDetailModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
            style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
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
                  <div className="spinner-dark" style={{ width: 24, height: 24, border: "3px solid rgba(79,100,91,.2)", borderTopColor: "#4f645b", borderRadius: "50%", animation: "spin .65s linear infinite" }} />
                </div>
              ) : detailUser ? (
                <>
                  <div className="flex items-center gap-4 mb-5 pb-4 border-b border-stone-100">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl"
                      style={{ background: "rgba(79,100,91,.2)", color: "#4f645b" }}
                    >
                      {(detailUser.fullName || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-lg font-bold">{detailUser.fullName || "—"}</p>
                      <p className="text-sm text-stone-500">{detailUser.email || "—"}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${detailUser.status ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-500"}`}>
                          {detailUser.status ? "Hoạt động" : "Đã khóa"}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${ROLE_BADGE[detailUser.roleName] || "bg-stone-100 text-stone-500"}`}>
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
                      ["Điểm tích lũy", detailUser.loyaltyPoints ?? "-"],
                      ["Điểm khả dụng", detailUser.loyaltyPointsUsable ?? "-"],
                      ["Địa chỉ", detailUser.address || "—"],
                      ["Ngày tạo", detailUser.createdAt ? new Date(detailUser.createdAt).toLocaleDateString("vi-VN") : "—"],
                    ].map(([k, v], i) => (
                      <div key={i} className="bg-stone-50 rounded-xl p-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-0.5">{k}</p>
                        <p className="text-sm font-semibold text-stone-700 truncate" title={String(v)}>{String(v)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-4 pt-4 border-t border-stone-100">
                    <button
                      onClick={() => { setDetailModalOpen(false); openEdit(detailUser.id); }}
                      className="px-4 py-2 text-sm font-bold rounded-xl hover:opacity-90 transition-all flex items-center gap-1.5"
                      style={{ background: "#4f645b", color: "#e7fef3" }}
                    >
                      <span className="material-symbols-outlined text-base">edit_square</span>
                      Chỉnh sửa
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}


      {/* ── Main Content Area ── */}
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Page Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 32,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#1c1917",
                  letterSpacing: "-0.025em",
                  margin: 0,
                }}
              >
                Quản lý Nhân sự &amp; Người dùng
              </h2>
              <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                Tổng:{" "}
                <span style={{ fontWeight: 600, color: "#1c1917" }}>
                  {allUsers.length}
                </span>{" "}
                người dùng
                {hasFilter && filtered.length !== allUsers.length && (
                  <span style={{ color: "#4f645b", marginLeft: 4 }}>
                    (lọc:{" "}
                    <span style={{ fontWeight: 600 }}>{filtered.length}</span>)
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={exportCSV}
                style={{
                  padding: "8px 20px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 500,
                  background: "white",
                  color: "#1c1917",
                  border: "1px solid #e2e8e1",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18 }}
                >
                  file_download
                </span>
                Xuất báo cáo
              </button>
              <button
                onClick={openAdd}
                style={{
                  padding: "8px 20px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 500,
                  background: "#4f645b",
                  color: "#e7fef3",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 4px 12px rgba(79,100,91,.2)",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18 }}
                >
                  person_add
                </span>
                Thêm người dùng
              </button>
            </div>
          </div>

          {/* Filters Section — khớp HTML */}
          <section
            style={{
              background: "white",
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,.06)",
              border: "1px solid #f1f0ea",
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "flex-end",
            }}
          >
            <div style={{ flex: 1, minWidth: 300 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#6b7280",
                  marginBottom: 8,
                }}
              >
                Họ tên, Email, SĐT
              </label>
              <div style={{ position: "relative" }}>
                <span
                  className="material-symbols-outlined"
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#9ca3af",
                    fontSize: 20,
                  }}
                >
                  search
                </span>
                <input
                  value={topSearch}
                  onChange={(e) => onSearch(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#f9f8f3",
                    border: "1px solid #e2e8e1",
                    borderRadius: 12,
                    padding: "10px 16px 10px 40px",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  placeholder="Gõ từ khóa..."
                />
              </div>
            </div>
            <div style={{ width: 224 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#6b7280",
                  marginBottom: 8,
                }}
              >
                Lọc theo Vai trò
              </label>
              <select
                value={filters.roleId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, roleId: e.target.value }))
                }
                style={{
                  width: "100%",
                  background: "#f9f8f3",
                  border: "1px solid #e2e8e1",
                  borderRadius: 12,
                  padding: "10px 16px",
                  fontSize: 14,
                  outline: "none",
                }}
              >
                <option value="">Chọn vai trò</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 224 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#6b7280",
                  marginBottom: 8,
                }}
              >
                Lọc theo Trạng thái
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
                style={{
                  width: "100%",
                  background: "#f9f8f3",
                  border: "1px solid #e2e8e1",
                  borderRadius: 12,
                  padding: "10px 16px",
                  fontSize: 14,
                  outline: "none",
                }}
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
              style={{
                background: "#f3f4f6",
                border: "1px solid #e2e8e1",
                color: "#4b5563",
                padding: 10,
                borderRadius: 12,
                cursor: "pointer",
              }}
              title="Xóa bộ lọc"
            >
              <span className="material-symbols-outlined">tune</span>
            </button>
          </section>

          {/* Data Table — khớp HTML */}
          <div
            style={{
              background: "white",
              borderRadius: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,.06)",
              border: "1px solid #f1f0ea",
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "rgba(249,248,243,.5)",
                      borderBottom: "1px solid #f1f0ea",
                    }}
                  >
                    {[
                      "Họ và tên",
                      "Email",
                      "Số điện thoại",
                      "Vai trò",
                      "Trạng thái",
                      "Thao tác",
                    ].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          padding: "16px 24px",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#6b7280",
                          textAlign: i === 5 ? "right" : "left",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ borderTop: "1px solid #f1f0ea" }}>
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
                          className="fade-row"
                          style={{
                            borderBottom: "1px solid #fafaf8",
                            animationDelay: `${Math.min(i * 25, 200)}ms`,
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#fafaf8")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "")
                          }
                        >
                          <td style={{ padding: "16px 24px" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                              }}
                            >
                              {u.avatarUrl ? (
                                <img
                                  alt=""
                                  src={u.avatarUrl}
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    background: "rgba(79,100,91,.2)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#4f645b",
                                    fontWeight: 700,
                                    fontSize: 14,
                                  }}
                                >
                                  {initial}
                                </div>
                              )}
                              <div>
                                <span
                                  style={{
                                    fontWeight: 500,
                                    color: "#292524",
                                    fontSize: 14,
                                  }}
                                >
                                  {u.fullName || "—"}
                                </span>
                                <p
                                  style={{
                                    fontSize: 12,
                                    color: "#9ca3af",
                                    margin: 0,
                                  }}
                                >
                                  #{u.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td
                            style={{
                              padding: "16px 24px",
                              fontSize: 14,
                              color: "#4b5563",
                            }}
                          >
                            {u.email || "—"}
                          </td>
                          <td
                            style={{
                              padding: "16px 24px",
                              fontSize: 14,
                              color: "#4b5563",
                            }}
                          >
                            {u.phone || "—"}
                          </td>
                          <td style={{ padding: "16px 24px" }}>
                            <span
                              className={`px-3 py-1 ${roleClass} text-[10px] font-bold rounded-full uppercase`}
                            >
                              {u.roleName || "—"}
                            </span>
                          </td>
                          <td style={{ padding: "16px 24px" }}>
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
                                  color: active ? "#059669" : "#9ca3af",
                                }}
                              >
                                {active ? "Hoạt động" : "Đã khóa"}
                              </span>
                              <label className="toggle-switch">
                                <input
                                  type="checkbox"
                                  checked={active}
                                  disabled={togglingIds.has(u.id)}
                                  onChange={() => handleToggle(u.id)}
                                />
                                <span className="slider" />
                              </label>
                            </div>
                          </td>
                          <td
                            style={{ padding: "16px 24px", textAlign: "right" }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 4,
                              }}
                            >
                              <button
                                onClick={() => openDetail(u.id)}
                                style={{
                                  padding: 8,
                                  color: "#9ca3af",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  borderRadius: 8,
                                  transition: "all .15s",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#f3f4f6";
                                  e.currentTarget.style.color = "#4f645b";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "";
                                  e.currentTarget.style.color = "#9ca3af";
                                }}
                                title="Xem chi tiết"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 22 }}
                                >
                                  visibility
                                </span>
                              </button>
                              <button
                                onClick={() => openEdit(u.id)}
                                style={{
                                  padding: 8,
                                  color: "#9ca3af",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  borderRadius: 8,
                                  transition: "all .15s",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#f3f4f6";
                                  e.currentTarget.style.color = "#4f645b";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "";
                                  e.currentTarget.style.color = "#9ca3af";
                                }}
                                title="Chỉnh sửa"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 22 }}
                                >
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
              <div style={{ padding: "64px 0", textAlign: "center" }}>
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 48,
                    color: "#d1d5db",
                    display: "block",
                    marginBottom: 12,
                  }}
                >
                  group_off
                </span>
                <p style={{ color: "#9ca3af", fontWeight: 500 }}>
                  Không tìm thấy người dùng nào
                </p>
              </div>
            )}

            {/* Pagination — khớp HTML */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #f1f0ea",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#6b7280" }}>Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value));
                    setPage(1);
                  }}
                  style={{
                    background: "#f9f8f3",
                    border: "1px solid #e2e8e1",
                    borderRadius: 8,
                    padding: "4px 8px",
                    fontSize: 12,
                    outline: "none",
                  }}
                >
                  <option value="10">10/trang</option>
                  <option value="20">20/trang</option>
                  <option value="50">50/trang</option>
                </select>
                {filtered.length > 0 && (
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>
                    {start}–{end} / {filtered.length}
                  </span>
                )}
              </div>

              {/* Nút chuyển trang (1, 2, 3...) gọi từ hàm cũ */}
              {renderPagination()}
            </div>
          </div>
        </div>
      </>
    );
  }
