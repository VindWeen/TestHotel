// src/pages/admin/roles/Role_Permission.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { getRoles, getRoleById, assignPermission } from "../../api/rolesApi";
import { useAdminAuthStore } from "../../store/adminAuthStore";
import { useNavigate } from "react-router-dom";
import { logout } from "../../api/authApi";

// ─── Tất cả permissions trong hệ thống (map theo PermissionCodes.cs) ──────────
const ALL_PERMISSIONS = [
  {
    id: 1,
    name: "Xem Dashboard",
    permissionCode: "VIEW_DASHBOARD",
    moduleName: "System",
  },
  {
    id: 2,
    name: "Quản lý Người dùng",
    permissionCode: "MANAGE_USERS",
    moduleName: "HR",
  },
  {
    id: 3,
    name: "Quản lý Vai trò",
    permissionCode: "MANAGE_ROLES",
    moduleName: "HR",
  },
  {
    id: 4,
    name: "Quản lý Phòng",
    permissionCode: "MANAGE_ROOMS",
    moduleName: "Room",
  },
  {
    id: 5,
    name: "Quản lý Booking",
    permissionCode: "MANAGE_BOOKINGS",
    moduleName: "Booking",
  },
  {
    id: 6,
    name: "Quản lý Hoá đơn",
    permissionCode: "MANAGE_INVOICES",
    moduleName: "Billing",
  },
  {
    id: 7,
    name: "Quản lý Dịch vụ",
    permissionCode: "MANAGE_SERVICES",
    moduleName: "Service",
  },
  {
    id: 8,
    name: "Xem Báo cáo",
    permissionCode: "VIEW_REPORTS",
    moduleName: "Report",
  },
  {
    id: 9,
    name: "Quản lý Nội dung",
    permissionCode: "MANAGE_CONTENT",
    moduleName: "CMS",
  },
  {
    id: 10,
    name: "Quản lý Vật tư",
    permissionCode: "MANAGE_INVENTORY",
    moduleName: "Room",
  },
];

// ─── Toast ────────────────────────────────────────────────────────────────────
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

function Toast({ id, msg, type = "success", dur = 3500, onDismiss }) {
  const s = TOAST_STYLES[type] || TOAST_STYLES.info;
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
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 8px 28px rgba(0,0,0,.35)",
        pointerEvents: "auto",
        marginBottom: 10,
        animation: "toastIn .32s cubic-bezier(.22,1,.36,1) forwards",
        minWidth: 280,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 12px 8px",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 18,
            flexShrink: 0,
            marginTop: 1,
            fontVariationSettings: "'FILL' 1",
          }}
        >
          {s.icon}
        </span>
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
            margin: 0,
            flex: 1,
          }}
        >
          {msg}
        </p>
        <button
          onClick={() => onDismiss(id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            opacity: 0.4,
            color: "inherit",
            padding: 2,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            close
          </span>
        </button>
      </div>
      <div
        style={{
          margin: "0 12px 8px",
          height: 3,
          borderRadius: 9999,
          background: "rgba(255,255,255,.1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background: s.prog,
            animation: `toastProgress ${dur}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Role color dots ──────────────────────────────────────────────────────────
const ROLE_COLORS = {
  Admin: "#7c3aed",
  Manager: "#059669",
  Receptionist: "#2563eb",
  Accountant: "#64748b",
  Housekeeping: "#d97706",
  Security: "#ea580c",
  Chef: "#dc2626",
  Waiter: "#ec4899",
  "IT Support": "#0891b2",
  Guest: "#9ca3af",
};

function getRoleColor(name) {
  return ROLE_COLORS[name] || "#4f645b";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i}>
      <td style={{ padding: "20px 28px" }}>
        <div className="skel" style={{ width: 72, height: 14 }} />
      </td>
      <td style={{ padding: "20px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            className="skel"
            style={{ width: 10, height: 10, borderRadius: "50%" }}
          />
          <div className="skel" style={{ width: 110, height: 14 }} />
        </div>
      </td>
      <td style={{ padding: "20px 28px" }}>
        <div className="skel" style={{ width: 200, height: 13 }} />
      </td>
      <td style={{ padding: "20px 28px", textAlign: "right" }}>
        <div
          className="skel"
          style={{ width: 90, height: 32, borderRadius: 8, marginLeft: "auto" }}
        />
      </td>
    </tr>
  ));
}

// ─── Permission Modal ─────────────────────────────────────────────────────────
function PermissionModal({ role, onClose, onSaved, showToast }) {
  const [currentPerms, setCurrentPerms] = useState([]);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getRoleById(role.id);
        const perms = res.data?.permissions || [];
        setCurrentPerms(perms);
        const map = {};
        ALL_PERMISSIONS.forEach((p) => {
          map[p.id] = perms.some(
            (cp) => cp.permissionCode === p.permissionCode || cp.id === p.id,
          );
        });
        setChecked(map);
      } catch {
        showToast("Không thể tải quyền của vai trò.", "error");
        onClose();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [role.id]);

  const toggle = (id) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = [];
      ALL_PERMISSIONS.forEach((p) => {
        const shouldHave = !!checked[p.id];
        const hasNow = currentPerms.some(
          (cp) => cp.permissionCode === p.permissionCode || cp.id === p.id,
        );
        if (shouldHave !== hasNow) {
          promises.push(assignPermission(role.id, p.id, shouldHave));
        }
      });
      await Promise.all(promises);
      showToast(
        `Đã cập nhật quyền cho vai trò "${role.name}" thành công.`,
        "success",
      );
      onSaved();
      onClose();
    } catch (e) {
      showToast(e?.response?.data?.message || "Cập nhật thất bại.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Group by module
  const grouped = {};
  ALL_PERMISSIONS.forEach((p) => {
    if (!grouped[p.moduleName]) grouped[p.moduleName] = [];
    grouped[p.moduleName].push(p);
  });

  const moduleLabels = {
    System: "Hệ thống",
    HR: "Nhân sự",
    Room: "Phòng & Vật tư",
    Booking: "Booking",
    Billing: "Thanh toán",
    Service: "Dịch vụ",
    Report: "Báo cáo",
    CMS: "Nội dung",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "white",
          borderRadius: 20,
          width: "100%",
          maxWidth: 540,
          boxShadow: "0 24px 64px rgba(0,0,0,.2)",
          animation: "modalIn .25s cubic-bezier(.22,1,.36,1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 28px 18px",
            borderBottom: "1px solid #f1f0ea",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#1c1917",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Cấu hình Quyền hạn
            </h3>
            <p
              style={{
                fontSize: 12,
                color: "#6b7280",
                margin: "4px 0 0",
                fontWeight: 500,
              }}
            >
              Vai trò:{" "}
              <span style={{ color: getRoleColor(role.name), fontWeight: 700 }}>
                {role.name}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
              color: "#9ca3af",
              display: "flex",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20 }}
            >
              close
            </span>
          </button>
        </div>

        {/* Body */}
        <div
          style={{ padding: "20px 28px 0", maxHeight: 440, overflowY: "auto" }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  border: "3px solid #e5e7eb",
                  borderTopColor: "#4f645b",
                  borderRadius: "50%",
                  animation: "spin .65s linear infinite",
                  margin: "0 auto",
                }}
              />
            </div>
          ) : (
            Object.entries(grouped).map(([module, perms]) => (
              <div key={module} style={{ marginBottom: 20 }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: "#9ca3af",
                    marginBottom: 10,
                  }}
                >
                  {moduleLabels[module] || module}
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {perms.map((p) => (
                    <label
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        borderRadius: 12,
                        background: checked[p.id]
                          ? "rgba(79,100,91,.08)"
                          : "#f9f8f3",
                        border: `1.5px solid ${checked[p.id] ? "rgba(79,100,91,.3)" : "#e2e8e1"}`,
                        cursor: "pointer",
                        transition: "all .15s",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!checked[p.id]}
                        onChange={() => toggle(p.id)}
                        style={{
                          width: 17,
                          height: 17,
                          accentColor: "#4f645b",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: checked[p.id] ? "#1a3826" : "#4b5563",
                          lineHeight: 1.3,
                        }}
                      >
                        {p.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 28px 24px",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              background: "none",
              border: "1.5px solid #e2e8e1",
              color: "#4b5563",
              cursor: "pointer",
            }}
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)",
              color: "#e7fef3",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              opacity: saving || loading ? 0.6 : 1,
            }}
          >
            {saving && (
              <div
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(231,254,243,.4)",
                  borderTopColor: "#e7fef3",
                  borderRadius: "50%",
                  animation: "spin .65s linear infinite",
                }}
              />
            )}
            Cập nhật
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Role_Permission() {
  const { user: currentUser, permissions, clearAuth } = useAdminAuthStore();
  const navigate = useNavigate();

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const showToast = useCallback((msg, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
  }, []);

  const dismissToast = useCallback(
    (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  const loadRoles = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getRoles();
      setRoles(res.data?.data || []);
    } catch {
      showToast("Không thể tải danh sách vai trò.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, []);

  const handleRefresh = () => loadRoles(true);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {}
    clearAuth();
    navigate("/login");
  };

  const totalPages = Math.max(1, Math.ceil(roles.length / pageSize));
  const paginatedRoles = roles.slice((page - 1) * pageSize, page * pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, roles.length);

  const ch = (currentUser?.fullName || "A")[0].toUpperCase();

  const hasPermission = (code) =>
    permissions.some(
      (p) =>
        (typeof p === "string" && p === code) ||
        (typeof p === "object" && p.permissionCode === code),
    );

  return (
    <>
      <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

                .material-symbols-outlined { font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; vertical-align:middle; }

                @keyframes spin { to { transform:rotate(360deg) } }
                @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
                @keyframes toastIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
                @keyframes toastProgress { from{width:100%} to{width:0} }
                @keyframes fadeRow { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
                @keyframes modalIn { from{opacity:0;transform:scale(.96) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
                @keyframes spin360 { to{transform:rotate(360deg)} }

                .skel { background:linear-gradient(90deg,#e8e8e0 25%,#f2f2ea 50%,#e8e8e0 75%); background-size:600px; animation:shimmer 1.4s infinite; border-radius:6px; height:13px; }

                .fade-row { animation:fadeRow .2s ease forwards; }

                .perm-btn {
                    display:inline-flex; align-items:center; gap:6px;
                    padding:8px 16px; border-radius:9px; font-size:13px; font-weight:700;
                    background:#f0faf5; color:#1a3826; border:1.5px solid rgba(79,100,91,.2);
                    cursor:pointer; transition:all .15s; font-family:'Manrope',sans-serif;
                }
                .perm-btn:hover { background:#4f645b; color:#e7fef3; border-color:#4f645b; }

                .refresh-btn {
                    display:inline-flex; align-items:center; gap:8px;
                    padding:10px 22px; border-radius:12px; font-size:14px; font-weight:700;
                    background:white; color:#1c1917; border:1.5px solid #e2e8e1;
                    cursor:pointer; transition:all .15s; font-family:'Manrope',sans-serif;
                    box-shadow:0 1px 4px rgba(0,0,0,.06);
                }
                .refresh-btn:hover { background:#f9f8f3; border-color:#c8c8c0; }

                .pg-btn { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:600; color:#6b7280; background:transparent; border:none; cursor:pointer; transition:background .15s,color .15s; font-family:'Manrope',sans-serif; }
                .pg-btn:hover:not(:disabled) { background:#f3f4f6; }
                .pg-btn.active { background:#4f645b; color:#e7fef3; font-weight:700; cursor:default; }
                .pg-btn:disabled { opacity:.35; cursor:not-allowed; }

                tr:hover td { background:rgba(249,248,243,.6) !important; }
            `}</style>

      {/* Toast Container */}
      <div
        style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 300,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Permission Modal */}
      {selectedRole && (
        <PermissionModal
          role={selectedRole}
          onClose={() => setSelectedRole(null)}
          onSaved={() => loadRoles()}
          showToast={showToast}
        />
      )}

      {/* ── Layout ── */}
      <div
        style={{
          fontFamily: "'Manrope', sans-serif",
          background: "#f8f9fa",
          minHeight: "100vh",
        }}
      >
        {/* Sidebar */}
        <aside
          style={{
            width: 256,
            height: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            borderRight: "1px solid #f1f0ea",
            background: "white",
            display: "flex",
            flexDirection: "column",
            padding: "32px 16px",
            zIndex: 50,
          }}
        >
          <div style={{ marginBottom: 40, paddingLeft: 16 }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "0.15em",
                color: "#1a3826",
                textTransform: "uppercase",
              }}
            >
              The Ethereal
            </h1>
            <p
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "#6b7280",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              Hotel ERP
            </p>
          </div>

          <nav
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {[
              {
                icon: "dashboard",
                label: "Dashboard",
                path: "/admin/dashboard",
              },
              {
                icon: "meeting_room",
                label: "Quản lý Phòng",
                path: "/admin/rooms",
              },
              {
                icon: "inventory_2",
                label: "Vật tư & Minibar",
                path: "/admin/items",
              },
              {
                icon: "confirmation_number",
                label: "Booking & Voucher",
                path: "/admin/bookings",
              },
              { icon: "group", label: "Quản lý Nhân sự", path: "/admin/staff" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 12,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#6b7280",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#065f46";
                  e.currentTarget.style.background = "#ecfdf5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#6b7280";
                  e.currentTarget.style.background = "";
                }}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
            {/* Active */}
            <a
              href="#"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 12,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 700,
                color: "#1a3826",
                background: "rgba(236,253,245,.5)",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                shield_person
              </span>
              <span>Vai trò & Phân quyền</span>
            </a>
          </nav>

          <div style={{ paddingLeft: 8, paddingRight: 8 }}>
            <button
              onClick={handleLogout}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 12,
                background: "none",
                border: "1px solid #e2e8e1",
                color: "#6b7280",
                fontWeight: 500,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "'Manrope',sans-serif",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18 }}
              >
                logout
              </span>
              Đăng xuất
            </button>
          </div>
        </aside>

        {/* Header */}
        <header
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "calc(100% - 256px)",
            height: 64,
            zIndex: 40,
            background: "rgba(255,255,255,.85)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid #f1f0ea",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "#9ca3af",
            }}
          >
            <span>Hệ thống</span>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16 }}
            >
              chevron_right
            </span>
            <span style={{ color: "#1c1917", fontWeight: 600 }}>
              Quản lý Vai trò & Phân quyền
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 1, height: 32, background: "#e5e7eb" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ textAlign: "right" }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#1c1917",
                    margin: 0,
                  }}
                >
                  {currentUser?.fullName || "—"}
                </p>
                <p style={{ fontSize: 10, color: "#6b7280", margin: 0 }}>
                  {currentUser?.role || "—"}
                </p>
              </div>
              <div
                style={{
                  width: 40,
                  height: 40,
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
                {ch}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main style={{ marginLeft: 256, paddingTop: 64 }}>
          <div style={{ padding: "36px 32px 32px" }}>
            {/* Page header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 32,
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#1c1917",
                    letterSpacing: "-0.03em",
                    margin: "0 0 6px",
                  }}
                >
                  Quản lý vai trò &amp; Quyền (RBAC)
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: "#6b7280",
                    margin: 0,
                    maxWidth: 520,
                  }}
                >
                  Phân định vai trò và gán quyền hạn truy cập cho từng bộ phận
                  trong hệ thống Grand Horizon.
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="refresh-btn"
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 18,
                    animation: refreshing
                      ? "spin360 .8s linear infinite"
                      : "none",
                  }}
                >
                  refresh
                </span>
                Làm mới
              </button>
            </div>

            {/* Table card */}
            <div
              style={{
                background: "white",
                borderRadius: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                border: "1px solid #f1f0ea",
                overflow: "hidden",
              }}
            >
              {/* Card header */}
              <div
                style={{
                  padding: "20px 28px",
                  borderBottom: "1px solid #f1f0ea",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#1c1917",
                    margin: 0,
                  }}
                >
                  Danh sách vai trò
                </h3>
                {!loading && (
                  <span
                    style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}
                  >
                    HIỂN THỊ {Math.min(paginatedRoles.length, pageSize)}/
                    {roles.length}
                  </span>
                )}
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(249,248,243,.5)" }}>
                      {["ID", "TÊN VAI TRÒ", "MÔ TẢ", "THAO TÁC"].map(
                        (h, i) => (
                          <th
                            key={h}
                            style={{
                              padding: "14px 28px",
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: ".1em",
                              color: "#9ca3af",
                              textAlign: i === 3 ? "right" : "left",
                              whiteSpace: "nowrap",
                              borderBottom: "1px solid #f1f0ea",
                            }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <SkeletonRows />
                    ) : paginatedRoles.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          style={{ padding: "60px 0", textAlign: "center" }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{
                              fontSize: 40,
                              color: "#d1d5db",
                              display: "block",
                              marginBottom: 10,
                            }}
                          >
                            shield_question
                          </span>
                          <p
                            style={{
                              color: "#9ca3af",
                              fontWeight: 500,
                              fontSize: 14,
                            }}
                          >
                            Chưa có vai trò nào
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginatedRoles.map((role, i) => {
                        const dotColor = getRoleColor(role.name);
                        const roleNum = (page - 1) * pageSize + i + 1;
                        return (
                          <tr
                            key={role.id}
                            className="fade-row"
                            style={{
                              borderBottom: "1px solid #fafaf8",
                              animationDelay: `${Math.min(i * 30, 150)}ms`,
                            }}
                          >
                            <td
                              style={{
                                padding: "20px 28px",
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#9ca3af",
                                fontFamily: "monospace",
                                letterSpacing: ".05em",
                              }}
                            >
                              ROLE-{String(roleNum).padStart(3, "0")}
                            </td>
                            <td style={{ padding: "20px 28px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <div
                                  style={{
                                    width: 9,
                                    height: 9,
                                    borderRadius: "50%",
                                    background: dotColor,
                                    flexShrink: 0,
                                    boxShadow: `0 0 0 2px ${dotColor}22`,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: "#1c1917",
                                  }}
                                >
                                  {role.name}
                                </span>
                              </div>
                            </td>
                            <td
                              style={{
                                padding: "20px 28px",
                                fontSize: 14,
                                color: "#6b7280",
                              }}
                            >
                              {role.description || (
                                <span
                                  style={{
                                    color: "#d1d5db",
                                    fontStyle: "italic",
                                  }}
                                >
                                  Chưa có mô tả
                                </span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "20px 28px",
                                textAlign: "right",
                              }}
                            >
                              {hasPermission("MANAGE_ROLES") && (
                                <button
                                  className="perm-btn"
                                  onClick={() => setSelectedRole(role)}
                                >
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: 16 }}
                                  >
                                    shield_lock
                                  </span>
                                  Phân quyền
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!loading && roles.length > 0 && (
                <div
                  style={{
                    padding: "14px 28px",
                    borderTop: "1px solid #f1f0ea",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                    {start}–{end} /{" "}
                    <span style={{ fontWeight: 600, color: "#6b7280" }}>
                      {roles.length}
                    </span>{" "}
                    vai trò
                  </p>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <button
                      className="pg-btn"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 18 }}
                      >
                        chevron_left
                      </span>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (n) => (
                        <button
                          key={n}
                          className={`pg-btn${n === page ? " active" : ""}`}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </button>
                      ),
                    )}
                    <button
                      className="pg-btn"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 18 }}
                      >
                        chevron_right
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Info note */}
            <div
              style={{
                marginTop: 20,
                padding: "14px 20px",
                background: "rgba(79,100,91,.06)",
                borderRadius: 12,
                border: "1px solid rgba(79,100,91,.12)",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 18,
                  color: "#4f645b",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                info
              </span>
              <p
                style={{
                  fontSize: 12,
                  color: "#4b5563",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Chỉ tài khoản có quyền <strong>MANAGE_ROLES</strong> mới có thể
                thay đổi phân quyền. Các thay đổi sẽ được áp dụng ngay khi người
                dùng đăng nhập lại.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
