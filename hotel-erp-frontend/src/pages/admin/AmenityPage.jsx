// src/pages/admin/AmenityPage.jsx
// Quản lý Tiện nghi phòng — đồng bộ với UserListPage, AdminLayout
import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAmenities,
  createAmenity,
  updateAmenity,
  deleteAmenity,
  toggleAmenityActive,
} from "../../api/amenitiesApi";
import { useAdminAuthStore } from "../../store/adminAuthStore";
import { useNavigate } from "react-router-dom";

// ─── Toast ────────────────────────────────────────────────────────────────────
const TOAST_STYLES = {
  success: {
    bg: "#1e3a2f", border: "#2d5a45", text: "#a7f3d0",
    prog: "#34d399", icon: "check_circle",
  },
  error: {
    bg: "#3a1e1e", border: "#5a2d2d", text: "#fca5a5",
    prog: "#f87171", icon: "error",
  },
  warning: {
    bg: "#3a2e1a", border: "#5a4820", text: "#fcd34d",
    prog: "#fbbf24", icon: "warning",
  },
  info: {
    bg: "#1e2f3a", border: "#2d4a5a", text: "#93c5fd",
    prog: "#60a5fa", icon: "info",
  },
};

function Toast({ id, msg, type = "success", dur = 4000, onDismiss }) {
  const s = TOAST_STYLES[type] || TOAST_STYLES.info;
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), dur);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      style={{
        background: s.bg, border: `1px solid ${s.border}`, color: s.text,
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,.3)", pointerEvents: "auto",
        marginBottom: 10, animation: "toastIn .35s cubic-bezier(.22,1,.36,1) forwards",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 13px 9px" }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 19, flexShrink: 0, marginTop: 1, fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20" }}
        >
          {s.icon}
        </span>
        <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, margin: 0, flex: 1 }}>
          {msg}
        </p>
        <button onClick={() => onDismiss(id)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2, color: "inherit" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
        </button>
      </div>
      <div style={{ margin: "0 12px 9px", height: 3, borderRadius: 9999, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 9999, background: s.prog, animation: `toastProgress ${dur}ms linear forwards` }} />
      </div>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, minWidth: 280, maxWidth: 360, pointerEvents: "none" }}>
      {toasts.map((t) => <Toast key={t.id} {...t} onDismiss={onDismiss} />)}
    </div>
  );
}

// ─── Skeleton Rows ────────────────────────────────────────────────────────────
function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i}>
      <td className="px-6 py-4">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10 }} />
          <div>
            <div className="skeleton" style={{ width: 140, height: 14, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: 60, height: 11 }} />
          </div>
        </div>
      </td>
      <td className="px-6 py-4"><div className="skeleton" style={{ width: 100, height: 13 }} /></td>
      <td className="px-6 py-4"><div className="skeleton" style={{ width: 64, height: 22, borderRadius: 9999 }} /></td>
      <td className="px-6 py-4" style={{ textAlign: "right" }}>
        <div className="skeleton" style={{ width: 80, height: 30, borderRadius: 8, marginLeft: "auto" }} />
      </td>
    </tr>
  ));
}

// ─── Icon Preview Component ───────────────────────────────────────────────────
function AmenityIcon({ iconUrl, name, size = 40 }) {
  const initial = (name || "?")[0].toUpperCase();

  // Nếu iconUrl là tên icon Material Symbols
  const isMaterialIcon = iconUrl && !iconUrl.includes("/") && !iconUrl.includes(".");

  if (isMaterialIcon) {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: 10,
          background: "rgba(79,100,91,.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: size * 0.55, color: "#4f645b", fontVariationSettings: "'FILL' 1" }}>
          {iconUrl}
        </span>
      </div>
    );
  }

  if (iconUrl && (iconUrl.startsWith("http") || iconUrl.startsWith("/"))) {
    return (
      <img
        src={iconUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid #f1f0ea" }}
        onError={(e) => { e.target.style.display = "none"; }}
      />
    );
  }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: 10,
        background: "rgba(79,100,91,.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#4f645b", fontWeight: 700, fontSize: size * 0.4, flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

// ─── ICON SUGGESTIONS ─────────────────────────────────────────────────────────
const ICON_SUGGESTIONS = [
  { icon: "wifi", label: "Wifi" },
  { icon: "tv", label: "TV" },
  { icon: "ac_unit", label: "Điều hoà" },
  { icon: "local_bar", label: "Minibar" },
  { icon: "balcony", label: "Ban công" },
  { icon: "hot_tub", label: "Bồn tắm" },
  { icon: "lock", label: "Két sắt" },
  { icon: "dry", label: "Máy sấy" },
  { icon: "coffee", label: "Cà phê" },
  { icon: "table_restaurant", label: "Bàn làm việc" },
  { icon: "pool", label: "Hồ bơi" },
  { icon: "fitness_center", label: "Gym" },
  { icon: "restaurant", label: "Nhà hàng" },
  { icon: "spa", label: "Spa" },
  { icon: "local_parking", label: "Bãi đỗ xe" },
  { icon: "elevator", label: "Thang máy" },
];

// ─── Form Modal ───────────────────────────────────────────────────────────────
function AmenityModal({ mode, amenity, onClose, onSaved, showToast }) {
  const [name, setName] = useState(amenity?.name || "");
  const [iconUrl, setIconUrl] = useState(amenity?.iconUrl || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showIcons, setShowIcons] = useState(false);

  const isEdit = mode === "edit";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Tên tiện nghi không được để trống."); return; }
    setLoading(true);
    setError("");
    try {
      const payload = { name: name.trim(), iconUrl: iconUrl.trim() || null };
      if (isEdit) {
        await updateAmenity(amenity.id, payload);
        showToast(`Đã cập nhật tiện nghi "${name.trim()}"`, "success");
      } else {
        await createAmenity(payload);
        showToast(`Đã thêm tiện nghi "${name.trim()}"`, "success");
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || (isEdit ? "Cập nhật thất bại." : "Tạo thất bại.");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 200, padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "white", borderRadius: 20, width: "100%", maxWidth: 480,
          boxShadow: "0 24px 64px rgba(0,0,0,.18)", animation: "modalIn .25s cubic-bezier(.22,1,.36,1)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 28px 18px", borderBottom: "1px solid #f1f0ea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1c1917", margin: 0, letterSpacing: "-0.02em" }}>
              {isEdit ? "Chỉnh sửa tiện nghi" : "Thêm tiện nghi mới"}
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "3px 0 0", fontWeight: 500 }}>
              {isEdit ? "Cập nhật tên và icon hiển thị" : "Thêm tiện nghi phòng vào hệ thống"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#9ca3af", display: "flex" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ padding: "20px 28px" }}>
            {/* Preview */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                background: "#f9f8f3", borderRadius: 14, marginBottom: 20, border: "1px solid #f1f0ea",
              }}
            >
              <AmenityIcon iconUrl={iconUrl} name={name || "?"} size={44} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1c1917", margin: 0 }}>
                  {name || "Tên tiện nghi"}
                </p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>
                  {iconUrl || "Chưa có icon"}
                </p>
              </div>
            </div>

            {/* Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                Tên tiện nghi *
              </label>
              <input
                type="text"
                placeholder="VD: Wifi Miễn Phí, Smart TV, Điều Hòa..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                style={{
                  width: "100%", background: "#f9f8f3", border: "1.5px solid #e2e8e1",
                  borderRadius: 12, padding: "10px 14px", fontSize: 14, outline: "none",
                  boxSizing: "border-box", transition: "border .15s",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => e.target.style.borderColor = "#4f645b"}
                onBlur={(e) => e.target.style.borderColor = "#e2e8e1"}
              />
            </div>

            {/* Icon */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                Icon (Material Symbol hoặc URL ảnh)
              </label>
              <input
                type="text"
                placeholder="VD: wifi / coffee / ac_unit hoặc https://..."
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                style={{
                  width: "100%", background: "#f9f8f3", border: "1.5px solid #e2e8e1",
                  borderRadius: 12, padding: "10px 14px", fontSize: 14, outline: "none",
                  boxSizing: "border-box", transition: "border .15s",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#4f645b"; setShowIcons(true); }}
                onBlur={(e) => { e.target.style.borderColor = "#e2e8e1"; setTimeout(() => setShowIcons(false), 150); }}
              />

              {/* Icon Suggestions */}
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, marginBottom: 8, letterSpacing: "0.05em" }}>
                  GỢI Ý ICON THƯỜNG DÙNG:
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ICON_SUGGESTIONS.map((ic) => (
                    <button
                      key={ic.icon}
                      type="button"
                      onClick={() => setIconUrl(ic.icon)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                        borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                        background: iconUrl === ic.icon ? "rgba(79,100,91,.12)" : "#f3f4f6",
                        color: iconUrl === ic.icon ? "#4f645b" : "#6b7280",
                        border: iconUrl === ic.icon ? "1.5px solid rgba(79,100,91,.3)" : "1.5px solid transparent",
                        transition: "all .12s", fontFamily: "inherit",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1" }}>{ic.icon}</span>
                      {ic.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(168,56,54,.08)", border: "1px solid rgba(168,56,54,.2)", display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#a83836" }}>error</span>
                <span style={{ fontSize: 13, color: "#a83836", fontWeight: 500 }}>{error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "0 28px 24px", display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: "11px", borderRadius: 11, fontSize: 14, fontWeight: 600,
                background: "none", border: "1.5px solid #e2e8e1", color: "#4b5563",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2, padding: "11px", borderRadius: 11, fontSize: 14, fontWeight: 700,
                background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)",
                color: "#e7fef3", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: loading ? 0.65 : 1, fontFamily: "inherit",
              }}
            >
              {loading && (
                <div style={{ width: 14, height: 14, border: "2px solid rgba(231,254,243,.4)", borderTopColor: "#e7fef3", borderRadius: "50%", animation: "spin .65s linear infinite" }} />
              )}
              {loading ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm tiện nghi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ amenity, onClose, onConfirmed, showToast }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteAmenity(amenity.id);
      showToast(`Đã xóa tiện nghi "${amenity.name}"`, "warning");
      onConfirmed();
      onClose();
    } catch (err) {
      showToast(err?.response?.data?.message || "Không thể xóa tiện nghi này.", "error");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 200, padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,.18)", padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26, color: "#dc2626" }}>delete_forever</span>
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1c1917", margin: "0 0 6px" }}>Xóa tiện nghi?</h3>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
            Bạn chắc chắn muốn xóa tiện nghi <strong>"{amenity?.name}"</strong>? Hành động này không thể hoàn tác.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: 11, fontSize: 14, fontWeight: 600, background: "none", border: "1.5px solid #e2e8e1", color: "#4b5563", cursor: "pointer", fontFamily: "inherit" }}>
            Hủy
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            style={{
              flex: 1, padding: "11px", borderRadius: 11, fontSize: 14, fontWeight: 700,
              background: "#dc2626", color: "white", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: loading ? 0.65 : 1, fontFamily: "inherit",
            }}
          >
            {loading && <div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,.35)", borderTopColor: "white", borderRadius: "50%", animation: "spin .65s linear infinite" }} />}
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AmenityPage() {
  const { permissions } = useAdminAuthStore();
  const navigate = useNavigate();

  const hasPermission = (code) =>
    permissions.some(
      (p) =>
        (typeof p === "string" && p === code) ||
        (typeof p === "object" && p.permissionCode === code)
    );

  const [amenities, setAmenities] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [togglingIds, setTogglingIds] = useState(new Set());

  // Modals
  const [modal, setModal] = useState(null); // null | { type: "add" | "edit" | "delete", amenity?: obj }

  // Filter
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState("all"); // all | active | inactive
  const debounceRef = useRef(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
  }, []);

  const dismissToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadAmenities = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await getAmenities();
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setAmenities(data);
    } catch (err) {
      showToast(err?.response?.data?.message || "Không thể tải danh sách tiện nghi.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAmenities(); }, []);

  // ── Filter ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let result = [...amenities];
    const q = search.toLowerCase().trim();
    if (q) result = result.filter((a) => (a.name || "").toLowerCase().includes(q));
    if (filterActive === "active") result = result.filter((a) => a.isActive);
    if (filterActive === "inactive") result = result.filter((a) => !a.isActive);
    setFiltered(result);
    setPage(1);
  }, [amenities, search, filterActive]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedAmenities = filtered.slice((page - 1) * pageSize, page * pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, filtered.length);

  // ── Toggle active ──────────────────────────────────────────────────────────
  const handleToggle = async (id) => {
    if (togglingIds.has(id)) return;
    setTogglingIds((prev) => new Set(prev).add(id));
    try {
      const res = await toggleAmenityActive(id);
      const updated = res.data;
      setAmenities((prev) =>
        prev.map((a) => a.id === id ? { ...a, isActive: updated.isActive ?? !a.isActive } : a)
      );
      const amenity = amenities.find((a) => a.id === id);
      const nextActive = !(amenity?.isActive);
      showToast(
        `${nextActive ? "Đã kích hoạt" : "Đã vô hiệu hóa"} tiện nghi "${amenity?.name}"`,
        nextActive ? "success" : "warning"
      );
    } catch (err) {
      showToast(err?.response?.data?.message || "Không thể thay đổi trạng thái.", "error");
    } finally {
      setTogglingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  // ── Search debounce ────────────────────────────────────────────────────────
  const onSearch = (val) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val.trim()), 300);
  };

  // ── Pagination ─────────────────────────────────────────────────────────────
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const DELTA = 2;
    const lo = Math.max(1, page - DELTA), hi = Math.min(totalPages, page + DELTA);
    const nums = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

    const PgBtn = ({ p, label, disabled, active }) => (
      <button
        onClick={() => !disabled && setPage(p)}
        disabled={disabled}
        className={`pg-btn${active ? " active" : ""}${typeof label !== "number" ? " icon" : ""}`}
      >
        {typeof label === "number" ? label : (
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{label}</span>
        )}
      </button>
    );

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <PgBtn p={page - 1} label="chevron_left" disabled={page <= 1} />
        {nums[0] > 1 && (
          <>
            <PgBtn p={1} label={1} />
            {nums[0] > 2 && <span style={{ padding: "0 4px", color: "#9ca3af", fontSize: 14 }}>...</span>}
          </>
        )}
        {nums.map((n) => <PgBtn key={n} p={n} label={n} active={n === page} />)}
        {nums[nums.length - 1] < totalPages && (
          <>
            {nums[nums.length - 1] < totalPages - 1 && <span style={{ padding: "0 4px", color: "#9ca3af", fontSize: 14 }}>...</span>}
            <PgBtn p={totalPages} label={totalPages} />
          </>
        )}
        <PgBtn p={page + 1} label="chevron_right" disabled={page >= totalPages} />
      </div>
    );
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalActive = amenities.filter((a) => a.isActive).length;
  const totalInactive = amenities.length - totalActive;

  return (
    <>
      {/* ── Global Styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        .material-symbols-outlined { font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; vertical-align:middle; }

        .toggle-switch { position:relative; display:inline-block; width:44px; height:24px; }
        .toggle-switch input { opacity:0; width:0; height:0; }
        .slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:#cbd5e1; transition:.4s; border-radius:24px; }
        .slider:before { position:absolute; content:""; height:18px; width:18px; left:3px; bottom:3px; background:white; transition:.4s; border-radius:50%; }
        input:checked + .slider { background:#4f645b; }
        input:checked + .slider:before { transform:translateX(20px); }
        input:disabled + .slider { opacity:0.5; cursor:not-allowed; }

        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes modalIn { from{transform:scale(.95);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes toastIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes toastProgress { from{width:100%} to{width:0} }
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        @keyframes fadeRow { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }

        .skeleton { background:linear-gradient(90deg,#e8e8e0 25%,#f2f2ea 50%,#e8e8e0 75%); background-size:600px; animation:shimmer 1.4s infinite; border-radius:6px; }
        .fade-row { animation:fadeRow .22s ease forwards; }
        tbody tr { transition:background .12s; }

        .pg-btn { width:2rem; height:2rem; border-radius:.5rem; display:flex; align-items:center; justify-content:center; font-size:.875rem; font-weight:500; color:#6b7280; background:transparent; border:none; cursor:pointer; transition:background .15s,color .15s; font-family:inherit; }
        .pg-btn:hover:not(:disabled) { background:#f3f4f6; }
        .pg-btn.active { background:#4f645b; color:#e7fef3; font-weight:700; cursor:default; }
        .pg-btn:disabled { opacity:.35; cursor:not-allowed; }
        .pg-btn.icon { color:#9ca3af; }

        .filter-tab { padding:7px 14px; border-radius:9px; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s; border:none; font-family:inherit; }
      `}</style>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ══ MODALS ══ */}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <AmenityModal
          mode={modal.type}
          amenity={modal.amenity}
          onClose={() => setModal(null)}
          onSaved={loadAmenities}
          showToast={showToast}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteModal
          amenity={modal.amenity}
          onClose={() => setModal(null)}
          onConfirmed={loadAmenities}
          showToast={showToast}
        />
      )}

      {/* ── Content ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#1c1917", letterSpacing: "-0.025em", margin: "0 0 4px" }}>
              Quản lý Tiện nghi Phòng
            </h2>
            <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
              Tổng:{" "}
              <span style={{ fontWeight: 600, color: "#1c1917" }}>{amenities.length}</span> tiện nghi
              {" · "}
              <span style={{ color: "#059669", fontWeight: 600 }}>{totalActive} hoạt động</span>
              {totalInactive > 0 && (
                <> · <span style={{ color: "#9ca3af", fontWeight: 600 }}>{totalInactive} tắt</span></>
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={loadAmenities}
              style={{
                padding: "8px 18px", borderRadius: 12, fontSize: 14, fontWeight: 500,
                background: "white", color: "#1c1917", border: "1px solid #e2e8e1",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                boxShadow: "0 1px 3px rgba(0,0,0,.06)", fontFamily: "inherit",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 17, ...(loading ? { animation: "spin .7s linear infinite" } : {}) }}>
                refresh
              </span>
              Làm mới
            </button>
            {hasPermission("MANAGE_ROOMS") && (
              <button
                onClick={() => setModal({ type: "add" })}
                style={{
                  padding: "8px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600,
                  background: "#4f645b", color: "#e7fef3", border: "none",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  boxShadow: "0 4px 12px rgba(79,100,91,.2)", fontFamily: "inherit",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                Thêm tiện nghi
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <section
          style={{
            background: "white", borderRadius: 16, padding: "18px 24px", marginBottom: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: "1px solid #f1f0ea",
            display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center",
          }}
        >
          {/* Search */}
          <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
            <span className="material-symbols-outlined" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 19 }}>
              search
            </span>
            <input
              placeholder="Tìm tên tiện nghi..."
              onChange={(e) => onSearch(e.target.value)}
              style={{
                width: "100%", background: "#f9f8f3", border: "1px solid #e2e8e1",
                borderRadius: 11, padding: "9px 14px 9px 38px", fontSize: 14,
                outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              }}
            />
          </div>

          {/* Status tabs */}
          <div style={{ display: "flex", gap: 6, background: "#f9f8f3", padding: "4px", borderRadius: 11 }}>
            {[
              { key: "all", label: "Tất cả" },
              { key: "active", label: "Hoạt động" },
              { key: "inactive", label: "Đã tắt" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterActive(tab.key)}
                className="filter-tab"
                style={{
                  background: filterActive === tab.key ? "white" : "transparent",
                  color: filterActive === tab.key ? "#1c1917" : "#6b7280",
                  boxShadow: filterActive === tab.key ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                }}
              >
                {tab.label}
                {tab.key === "all" && <span style={{ marginLeft: 5, fontSize: 10, background: "#e2e8e1", padding: "1px 5px", borderRadius: 9999, fontWeight: 700 }}>{amenities.length}</span>}
                {tab.key === "active" && <span style={{ marginLeft: 5, fontSize: 10, background: "#d1fae5", color: "#065f46", padding: "1px 5px", borderRadius: 9999, fontWeight: 700 }}>{totalActive}</span>}
                {tab.key === "inactive" && totalInactive > 0 && <span style={{ marginLeft: 5, fontSize: 10, background: "#f3f4f6", color: "#9ca3af", padding: "1px 5px", borderRadius: 9999, fontWeight: 700 }}>{totalInactive}</span>}
              </button>
            ))}
          </div>

          {/* Reset filter */}
          {(search || filterActive !== "all") && (
            <button
              onClick={() => { setSearch(""); setFilterActive("all"); }}
              style={{
                padding: "8px 12px", borderRadius: 10, background: "#f3f4f6",
                border: "1px solid #e2e8e1", color: "#4b5563", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4, fontSize: 12,
                fontWeight: 600, fontFamily: "inherit",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>filter_list_off</span>
              Xóa lọc
            </button>
          )}
        </section>

        {/* Table */}
        <div style={{ background: "white", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: "1px solid #f1f0ea", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(249,248,243,.5)", borderBottom: "1px solid #f1f0ea" }}>
                  {["Tiện nghi", "Icon", "Trạng thái", "Thao tác"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: "15px 24px",
                        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.08em", color: "#6b7280",
                        textAlign: i === 3 ? "right" : "left",
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
                ) : paginatedAmenities.length === 0 ? null : (
                  paginatedAmenities.map((amenity, i) => (
                    <tr
                      key={amenity.id}
                      className="fade-row"
                      style={{ borderBottom: "1px solid #fafaf8", animationDelay: `${Math.min(i * 30, 200)}ms` }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#fafaf8"}
                      onMouseLeave={(e) => e.currentTarget.style.background = ""}
                    >
                      {/* Name */}
                      <td style={{ padding: "15px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <AmenityIcon iconUrl={amenity.iconUrl} name={amenity.name} size={38} />
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 600, color: amenity.isActive ? "#292524" : "#9ca3af" }}>
                              {amenity.name}
                            </span>
                            <p style={{ fontSize: 11, color: "#9ca3af", margin: "1px 0 0" }}>#{amenity.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Icon code */}
                      <td style={{ padding: "15px 24px" }}>
                        {amenity.iconUrl ? (
                          <code style={{ fontSize: 12, background: "#f3f4f6", padding: "3px 8px", borderRadius: 6, color: "#4b5563", fontFamily: "monospace" }}>
                            {amenity.iconUrl.length > 30 ? amenity.iconUrl.slice(0, 28) + "…" : amenity.iconUrl}
                          </code>
                        ) : (
                          <span style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic" }}>Chưa có</span>
                        )}
                      </td>

                      {/* Status + Toggle */}
                      <td style={{ padding: "15px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: amenity.isActive ? "#059669" : "#9ca3af" }}>
                            {amenity.isActive ? "Hoạt động" : "Đã tắt"}
                          </span>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={!!amenity.isActive}
                              disabled={togglingIds.has(amenity.id) || !hasPermission("MANAGE_ROOMS")}
                              onChange={() => handleToggle(amenity.id)}
                            />
                            <span className="slider" />
                          </label>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "15px 24px", textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                          {hasPermission("MANAGE_ROOMS") && (
                            <>
                              {/* Edit */}
                              <button
                                onClick={() => setModal({ type: "edit", amenity })}
                                style={{ padding: 7, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", borderRadius: 8, transition: "all .15s" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#4f645b"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "#9ca3af"; }}
                                title="Chỉnh sửa"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>edit</span>
                              </button>
                              {/* Delete */}
                              <button
                                onClick={() => setModal({ type: "delete", amenity })}
                                style={{ padding: 7, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", borderRadius: 8, transition: "all .15s" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#dc2626"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "#9ca3af"; }}
                                title="Xóa"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {!loading && paginatedAmenities.length === 0 && (
            <div style={{ padding: "64px 0", textAlign: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#d1d5db", display: "block", marginBottom: 12 }}>
                bed
              </span>
              <p style={{ color: "#9ca3af", fontWeight: 500, margin: 0 }}>
                {search || filterActive !== "all" ? "Không tìm thấy tiện nghi phù hợp" : "Chưa có tiện nghi nào"}
              </p>
              {!search && filterActive === "all" && hasPermission("MANAGE_ROOMS") && (
                <button
                  onClick={() => setModal({ type: "add" })}
                  style={{
                    marginTop: 14, padding: "8px 18px", borderRadius: 10, fontSize: 13,
                    fontWeight: 600, background: "#4f645b", color: "#e7fef3",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Thêm tiện nghi đầu tiên
                </button>
              )}
            </div>
          )}

          {/* Pagination Footer */}
          <div
            style={{
              padding: "14px 24px", borderTop: "1px solid #f1f0ea",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              {filtered.length > 0 ? `${start}–${end} / ${filtered.length}` : "0 kết quả"}
            </span>
            {renderPagination()}
          </div>
        </div>
      </div>
    </>
  );
}
