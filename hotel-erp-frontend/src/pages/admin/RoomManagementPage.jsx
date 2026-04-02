// src/pages/admin/RoomManagementPage.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAdminAuthStore } from "../../store/adminAuthStore";
import {
    getRooms,
    createRoom,
    updateBusinessStatus,
    updateCleaningStatus,
} from "../../api/roomsApi";
import { getAdminRoomTypes } from "../../api/roomTypesApi";
import { getInventoryByRoom, cloneInventory } from "../../api/roomInventoriesApi";
// ─── Constants ─────────────────────────────────────────────────────────────────
const BUSINESS_STATUS_CONFIG = {
    Available: {
        label: "Sẵn sàng",
        bg: "#ecfdf5",
        color: "#059669",
        border: "#a7f3d0",
        dot: "#10b981",
    },
    Occupied: {
        label: "Đang dùng",
        bg: "#fffbeb",
        color: "#d97706",
        border: "#fde68a",
        dot: "#f59e0b",
    },
    Disabled: {
        label: "Bảo trì",
        bg: "#f5f3ff",
        color: "#7c3aed",
        border: "#ddd6fe",
        dot: "#8b5cf6",
    },
};

const ROOM_STATUS_CONFIG = {
    Available: { label: "Sẵn sàng", bg: "#ecfdf5", color: "#059669", border: "#a7f3d0", dot: "#10b981" },
    Occupied: { label: "Đang dùng", bg: "#fffbeb", color: "#d97706", border: "#fde68a", dot: "#f59e0b" },
    Cleaning: { label: "Đang dọn", bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe", dot: "#3b82f6" },
    Maintenance: { label: "Bảo trì", bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe", dot: "#8b5cf6" },
};

const CLEANING_STATUS_CONFIG = {
    Clean: {
        label: "Sạch sẽ",
        bg: "#eff6ff",
        color: "#2563eb",
        border: "#bfdbfe",
        icon: "check_circle",
    },
    Dirty: {
        label: "Cần dọn",
        bg: "#fff7ed",
        color: "#ea580c",
        border: "#fed7aa",
        icon: "cleaning_services",
    },
};

const VIEW_TYPES = ["Biển", "Thành phố", "Núi", "Vườn", "Hồ bơi"];
const ROOM_VIEW_MODE_STORAGE_KEY = "admin_room_management_view_mode";

// ─── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ id, msg, type = "success", dur = 4000, onDismiss }) {
    const styles = {
        success: { bg: "#1e3a2f", border: "#2d5a45", text: "#a7f3d0", prog: "#34d399", icon: "check_circle" },
        error: { bg: "#3a1e1e", border: "#5a2d2d", text: "#fca5a5", prog: "#f87171", icon: "error" },
        warning: { bg: "#3a2e1a", border: "#5a4820", text: "#fcd34d", prog: "#fbbf24", icon: "warning" },
        info: { bg: "#1e2f3a", border: "#2d4a5a", text: "#93c5fd", prog: "#60a5fa", icon: "info" },
    };
    const s = styles[type] || styles.info;
    useEffect(() => {
        const t = setTimeout(() => onDismiss(id), dur);
        return () => clearTimeout(t);
    }, []);
    return (
        <div style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.35)", pointerEvents: "auto", marginBottom: 10, minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 13px 9px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 19, flexShrink: 0, marginTop: 1, fontVariationSettings: "'FILL' 1,'wght' 400" }}>{s.icon}</span>
                <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, margin: 0, flex: 1 }}>{msg}</p>
                <button onClick={() => onDismiss(id)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, color: "inherit", padding: 2 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                </button>
            </div>
            <div style={{ margin: "0 12px 9px", height: 3, borderRadius: 9999, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
                <div style={{ height: "100%", background: s.prog, animation: `toastProgress ${dur}ms linear forwards` }} />
            </div>
        </div>
    );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────────
function SkeletonRows() {
    return Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
            {Array.from({ length: 6 }).map((_, j) => (
                <td key={j} style={{ padding: "18px 24px" }}>
                    <div className="skeleton" style={{ height: 14, width: j === 0 ? 50 : j === 2 ? 160 : 80, borderRadius: 6 }} />
                </td>
            ))}
        </tr>
    ));
}

// ─── Room Card (for grid view) ──────────────────────────────────────────────────
function RoomCard({ room, onDetail }) {
    const currentStatus = room.status || room.businessStatus || "Available";
    const bsCfg = ROOM_STATUS_CONFIG[currentStatus] || ROOM_STATUS_CONFIG.Available;
    const clCfg = CLEANING_STATUS_CONFIG[room.cleaningStatus] || CLEANING_STATUS_CONFIG.Clean;
    return (
        <div
            onClick={() => onDetail(room.id)}
            style={{
                background: "white",
                border: `1.5px solid ${bsCfg.border}`,
                borderRadius: 16,
                padding: "16px 18px",
                cursor: "pointer",
                transition: "all .18s",
                position: "relative",
                overflow: "hidden",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
        >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: bsCfg.dot, borderRadius: "16px 16px 0 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, paddingTop: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#1c1917", fontFamily: "Manrope, sans-serif" }}>{room.roomNumber}</span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: bsCfg.dot, flexShrink: 0, marginTop: 6 }} />
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,.4)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {room.roomTypeName || "—"}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: bsCfg.color, background: bsCfg.bg, padding: "2px 8px", borderRadius: 9999 }}>
                    {bsCfg.label}
                </span>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>T.{room.floor || "?"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13, color: clCfg.color, fontVariationSettings: "'FILL' 1" }}>{clCfg.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: clCfg.color }}>{clCfg.label}</span>
            </div>
        </div>
    );
}

// ─── Status Dropdown ────────────────────────────────────────────────────────────
function StatusDropdown({ options, current, onSelect, configMap }) {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef(null);
    const menuRef = useRef(null);
    const cfg = configMap[current] || {};

    const openMenu = () => {
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            // position: absolute trên body → cần cộng scroll
            setMenuPos({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
            });
        }
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const handleClick = (e) => {
            if (
                btnRef.current && !btnRef.current.contains(e.target) &&
                menuRef.current && !menuRef.current.contains(e.target)
            ) setOpen(false);
        };
        const handleScroll = () => setOpen(false);
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("scroll", handleScroll, true);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("scroll", handleScroll, true);
        };
    }, [open]);

    const menu = open ? createPortal(
        <div
            ref={menuRef}
            style={{
                position: "absolute",
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 9999,
                background: "white",
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,.14)",
                border: "1px solid #f1f0ea",
                minWidth: 150,
                overflow: "hidden",
            }}
        >
            {options.map((opt) => {
                const optCfg = configMap[opt] || {};
                return (
                    <button
                        key={opt}
                        onClick={() => { onSelect(opt); setOpen(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", width: "100%", background: opt === current ? "#f9f8f3" : "transparent", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: optCfg.color || "#374151", textAlign: "left", fontFamily: "Manrope, sans-serif" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f9f8f3"}
                        onMouseLeave={e => e.currentTarget.style.background = opt === current ? "#f9f8f3" : "transparent"}
                    >
                        {optCfg.dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: optCfg.dot, flexShrink: 0 }} />}
                        {optCfg.icon && <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1", color: optCfg.color }}>{optCfg.icon}</span>}
                        {optCfg.label || opt}
                        {opt === current && <span className="material-symbols-outlined" style={{ fontSize: 14, marginLeft: "auto", color: "#4f645b" }}>check</span>}
                    </button>
                );
            })}
        </div>,
        document.body
    ) : null;

    return (
        <div style={{ display: "inline-block" }}>
            <button
                ref={btnRef}
                onClick={() => open ? setOpen(false) : openMenu()}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${cfg.border || "#e2e8e1"}`, background: cfg.bg || "#f9f8f3", cursor: "pointer", fontSize: 12, fontWeight: 700, color: cfg.color || "#6b7280", fontFamily: "Manrope, sans-serif" }}
            >
                {cfg.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot }} />}
                {cfg.icon && <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>}
                <span>{cfg.label || current}</span>
                <span className="material-symbols-outlined" style={{ fontSize: 14, opacity: 0.5 }}>expand_more</span>
            </button>
            {menu}
        </div>
    );
}

// ─── Create Room Modal ─────────────────────────────────────────────────────────
// ─── Create Room Wizard ─────────────────────────────────────────────────────────
function CreateRoomWizard({ roomTypes, allRooms, onClose, onCreated, showToast, canManageInventory }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Step 1 states
    const [roomNumber, setRoomNumber] = useState("");
    const [floor, setFloor] = useState("");
    const [roomTypeId, setRoomTypeId] = useState("");
    const [viewType, setViewType] = useState("");
    const [roomId, setRoomId] = useState(null);

    // Step 3 states
    const [cloneFromRoomId, setCloneFromRoomId] = useState("");
    const [inventories, setInventories] = useState([]);
    const [loadingInv, setLoadingInv] = useState(false);

    const selectedType = roomTypes.find((rt) => rt.id === parseInt(roomTypeId));

    const handleCreateMainInfo = async () => {
        setError("");
        if (!roomNumber.trim()) return setError("Số phòng không được để trống.");
        if (!roomTypeId) return setError("Vui lòng chọn hạng phòng.");

        setLoading(true);
        try {
            const res = await createRoom({
                roomNumber: roomNumber.trim(),
                floor: floor ? parseInt(floor) : null,
                roomTypeId: parseInt(roomTypeId),
                viewType: viewType || undefined,
            });
            setRoomId(res.data.id);
            showToast(`Đã tạo phòng ${roomNumber} thành công!`, "success");
            setStep(2);
        } catch (err) {
            setError(err?.response?.data?.message || "Tạo phòng thất bại.");
        } finally {
            setLoading(false);
        }
    };

    const fetchInventory = async (rId) => {
        setLoadingInv(true);
        try {
            const res = await getInventoryByRoom(rId);
            const grouped = res.data?.data || [];
            const items = grouped.flatMap(g => g.items || []);
            setInventories(items);
        } catch (err) {
            console.error("Fetch inv error", err);
        } finally {
            setLoadingInv(false);
        }
    };

    const handleClone = async (fromRoomId) => {
        setCloneFromRoomId(fromRoomId);
        if (!fromRoomId) {
            setInventories([]);
            return;
        }
        setLoadingInv(true);
        try {
            await cloneInventory(parseInt(fromRoomId), [roomId]);
            showToast("Đã clone vật tư thành công.", "success");
            await fetchInventory(roomId);
        } catch (err) {
            showToast(err?.response?.data?.message || "Lỗi khi sao chép vật tư.", "error");
            setCloneFromRoomId("");
        } finally {
            setLoadingInv(false);
        }
    };

    const handleFinish = () => {
        onCreated();
        onClose();
    };

    // UI Styles
    const activeColor = "#4f645b";

    return (
        <div style={{ background: "#f9f8f3", display: "flex", flexDirection: "column", borderRadius: 20, border: "1px solid #e2e8e1", overflow: "hidden", minHeight: "calc(100vh - 120px)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            {/* Header */}
            <div style={{ padding: "20px 40px", background: "white", borderBottom: "1px solid #e2e8e1", display: "flex", alignItems: "center" }}>
                <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "#4b5563", fontSize: 16, fontWeight: 700, fontFamily: "Manrope, sans-serif" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
                    Quy trình thiết lập phòng trọn gói
                </button>
            </div>

            {/* Stepper */}
            <div style={{ padding: "40px 20px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <StepItem active={step >= 1} current={step === 1} icon="home" label="Thông tin chính" color={activeColor} />
                <div style={{ height: 2, width: 100, background: step >= 2 ? activeColor : "#e5e7eb", margin: "0 16px" }} />
                <StepItem active={step >= 2} current={step === 2} icon="local_cafe" label="Tiện ích" color={activeColor} />
                <div style={{ height: 2, width: 100, background: step >= 3 ? activeColor : "#e5e7eb", margin: "0 16px" }} />
                <StepItem active={canManageInventory && step >= 3} current={step === 3} icon="key" label="Vật tư & Minibar" color={activeColor} />
            </div>

            {/* Content Container */}
            <div style={{ maxWidth: 1000, margin: "0 auto", width: "100%", padding: "0 20px 60px" }}>
                {step === 1 && (
                    <div style={{ display: "flex", gap: 60 }}>
                        {/* Form area */}
                        <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
                                <div style={{ flex: 3 }}>
                                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>* Số phòng</label>
                                    <input
                                        value={roomNumber}
                                        onChange={e => setRoomNumber(e.target.value)}
                                        style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 15, outline: "none", background: "white", boxSizing: "border-box", fontFamily: "Manrope, sans-serif" }}
                                    />
                                </div>
                                <div style={{ flex: 2 }}>
                                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>* Tầng</label>
                                    <input
                                        type="number"
                                        value={floor}
                                        onChange={e => setFloor(e.target.value)}
                                        style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 15, outline: "none", background: "white", boxSizing: "border-box", fontFamily: "Manrope, sans-serif" }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 20, marginBottom: 32 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>* Hạng phòng</label>
                                    <select
                                        value={roomTypeId}
                                        onChange={e => setRoomTypeId(e.target.value)}
                                        style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 15, outline: "none", background: "white", boxSizing: "border-box", cursor: "pointer", fontFamily: "Manrope, sans-serif" }}
                                    >
                                        <option value="">Chọn hạng phòng</option>
                                        {roomTypes.map(rt => (
                                            <option key={rt.id} value={rt.id}>
                                                {rt.name}
                                            </option>
                                        ))}
                                    </select>
                                    {roomTypes.length === 0 && (
                                        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                                            Chưa tải được danh sách hạng phòng. Vui lòng kiểm tra API RoomTypes/admin.
                                        </p>
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>View phòng (Tùy chọn)</label>
                                    <select
                                        value={viewType}
                                        onChange={e => setViewType(e.target.value)}
                                        style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 15, outline: "none", background: "white", boxSizing: "border-box", cursor: "pointer", fontFamily: "Manrope, sans-serif" }}
                                    >
                                        <option value="">Không có view</option>
                                        {VIEW_TYPES.map(vt => (
                                            <option key={vt} value={vt}>{vt}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleCreateMainInfo}
                                disabled={loading}
                                style={{ background: "linear-gradient(135deg, #4f645b 0%, #43574f 100%)", color: "white", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(79,100,91,.2)", fontFamily: "Manrope, sans-serif", opacity: loading ? 0.7 : 1 }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                                {loading ? "Đang xử lý..." : "Tạo phòng & Tiếp tục"}
                            </button>
                            {error && <p style={{ color: "#ef4444", marginTop: 12, fontSize: 13, fontWeight: 600 }}>{error}</p>}
                        </div>

                        {/* Image preview area */}
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#4b5563", marginBottom: 8 }}>Hình ảnh hạng phòng</p>
                            <div style={{ background: "#e2e8e0", borderRadius: 16, height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#6b7280", overflow: "hidden", position: "relative" }}>
                                {selectedType && selectedType.primaryImage ? (
                                    <img src={selectedType.primaryImage.imageUrl} alt={selectedType.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined" style={{ fontSize: 64, opacity: 0.5, marginBottom: 16 }}>image</span>
                                        <span style={{ fontSize: 14, fontWeight: 600 }}>Chọn hạng phòng để xem ảnh</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div style={{ maxWidth: 800, margin: "0 auto" }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#4b5563", marginBottom: 12 }}>Các tiện ích cố định theo hạng phòng {selectedType?.name}:</p>
                        <div style={{ background: "#e8edea", borderRadius: 16, minHeight: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
                            {selectedType?.amenities && selectedType.amenities.length > 0 ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, width: "100%", justifyContent: "center" }}>
                                    {selectedType.amenities.map(a => (
                                        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "white", padding: "10px 16px", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: activeColor }}>{a.iconUrl || "star"}</span>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{a.name}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined" style={{ fontSize: 56, color: "#9ca3af", marginBottom: 12 }}>inbox</span>
                                    <p style={{ fontSize: 14, color: "#6b7280", fontWeight: 600 }}>Hạng phòng này chưa cấu hình tiện ích</p>
                                </>
                            )}
                        </div>
                        <div style={{ marginTop: 32 }}>
                            <button
                                onClick={() => canManageInventory ? setStep(3) : handleFinish()}
                                style={{ background: "linear-gradient(135deg, #4f645b 0%, #43574f 100%)", color: "white", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(79,100,91,.2)", fontFamily: "Manrope, sans-serif" }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                                {canManageInventory ? "Tiếp theo: Thiết lập vật tư" : "Hoàn tất"}
                            </button>
                        </div>
                    </div>
                )}

                {canManageInventory && step === 3 && (
                    <div style={{ maxWidth: 900, margin: "0 auto" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 32 }}>
                            <div style={{ background: "white", padding: 20, borderRadius: 12, border: "1px solid #e2e8e1", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                                <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#4b5563", marginBottom: 16 }}>Thiết lập nhanh vật tư</label>
                                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                    <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 500 }}>Sao chép định mức từ phòng mẫu:</span>
                                    <select
                                        value={cloneFromRoomId}
                                        onChange={e => handleClone(e.target.value)}
                                        style={{ width: 280, padding: "10px 16px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, outline: "none", background: "#f9f8f3", cursor: "pointer", fontFamily: "Manrope, sans-serif", fontWeight: 600 }}
                                    >
                                        <option value="">Chọn một phòng có sẵn</option>
                                        {allRooms.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.roomNumber} - {r.roomTypeName || "N/A"}
                                            </option>
                                        ))}
                                    </select>
                                    <span style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>(Tự động thêm Tivi, Tủ lạnh, đồ Minibar...)</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: 32 }}>
                            <p style={{ fontSize: 15, fontWeight: 800, color: "#4b5563", marginBottom: 16 }}>Danh sách vật tư hiện tại của phòng</p>
                            <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8e1", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ background: "#f9f8f3", borderBottom: "1px solid #e2e8e1" }}>
                                            <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mã VT</th>
                                            <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tên vật tư</th>
                                            <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>ĐVT / Loại</th>
                                            <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>SL</th>
                                            <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Giá đền bù</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingInv ? (
                                            <tr>
                                                <td colSpan={5} style={{ padding: "40px 0", textAlign: "center", color: "#6b7280" }}>Đang tải danh sách vật tư...</td>
                                            </tr>
                                        ) : inventories.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} style={{ padding: "60px 0", textAlign: "center", color: "#9ca3af" }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.5, marginBottom: 8, display: "block" }}>inventory_2</span>
                                                    Chưa có vật tư. Hãy chọn phòng mẫu để sao chép nhanh.
                                                </td>
                                            </tr>
                                        ) : (
                                            inventories.map((inv, idx) => {
                                                const code = inv.id ? `VT-${String(inv.id).padStart(4, "0")}` : (inv.itemCode || "N/A");
                                                return (
                                                    <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                                        <td style={{ padding: "16px 20px", fontSize: 14, color: "#4f645b", fontWeight: 700 }}>{code}</td>
                                                        <td style={{ padding: "16px 20px", fontSize: 15, color: "#374151", fontWeight: 600 }}>{inv.equipmentName || "N/A"}</td>
                                                        <td style={{ padding: "16px 20px", fontSize: 14, color: "#6b7280" }}>{inv.itemType === "Asset" ? "Tài sản" : (inv.itemType || "N/A")}</td>
                                                        <td style={{ padding: "16px 20px", fontSize: 15, color: "#1c1917", fontWeight: 800 }}>{inv.quantity || 0}</td>
                                                        <td style={{ padding: "16px 20px", fontSize: 14, color: "#6b7280", fontWeight: 600 }}>
                                                            {inv.priceIfLost != null ? new Intl.NumberFormat("vi-VN").format(inv.priceIfLost) + " đ" : "—"}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ paddingBottom: 40 }}>
                            <button
                                onClick={handleFinish}
                                style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)", color: "white", padding: "14px 28px", borderRadius: 8, fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, boxShadow: "0 4px 12px rgba(29,78,216,.25)", fontFamily: "Manrope, sans-serif" }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>check_circle</span>
                                Hoàn tất và Quay về danh sách
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StepItem({ active, current, icon, label, color }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: current ? color : active ? color : "#9ca3af", opacity: current ? 1 : active ? 0.8 : 0.6, fontWeight: current ? 800 : 700 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{icon}</span>
            <span style={{ fontSize: 16 }}>{label}</span>
        </div>
    );
}



function RoomManagementHeader({
  stats,
  hasFilters,
  viewMode,
  onViewModeChange,
  onCreateRoom,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 28,
      }}
    >
      <div>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#1c1917",
            letterSpacing: "-0.025em",
            margin: "0 0 4px",
            fontFamily: "Manrope, sans-serif",
          }}
        >
          Quản lý Phòng
        </h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Tổng <span style={{ fontWeight: 700, color: "#1c1917" }}>{stats.total}</span> phòng
          {hasFilters && (
            <span style={{ color: "#4f645b", fontWeight: 600, marginLeft: 4 }}>(đang lọc)</span>
          )}
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 2, background: "#f1f0ea", padding: 4, borderRadius: 12 }}>
          {["table", "grid"].map((mode) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              style={{
                padding: "7px 14px",
                borderRadius: 9,
                background: viewMode === mode ? "white" : "transparent",
                border: "none",
                cursor: "pointer",
                color: viewMode === mode ? "#1c1917" : "#9ca3af",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 700,
                boxShadow: viewMode === mode ? "0 1px 4px rgba(0,0,0,.1)" : "none",
                transition: "all .15s",
                fontFamily: "Manrope, sans-serif",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {mode === "table" ? "table_rows" : "grid_view"}
              </span>
              {mode === "table" ? "Bảng" : "Lưới"}
            </button>
          ))}
        </div>
        <button
          onClick={onCreateRoom}
          style={{
            padding: "9px 20px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            background: "#4f645b",
            color: "#e7fef3",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 7,
            boxShadow: "0 4px 12px rgba(79,100,91,.2)",
            fontFamily: "Manrope, sans-serif",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            add_circle
          </span>
          Thêm phòng
        </button>
      </div>
    </div>
  );
}

function RoomManagementSummary({ stats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
      {[
        { label: "TỔNG PHÒNG", value: stats.total, bg: "#f8f9fa", color: "#6b7280", border: "#f1f0ea" },
        { label: "SẴN SÀNG", value: stats.available, bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" },
        { label: "ĐANG DÙNG", value: stats.occupied, bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
        { label: "BẢO TRÌ", value: stats.disabled, bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
        { label: "CẦN DỌN", value: stats.dirty, bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
      ].map((item) => (
        <div
          key={item.label}
          style={{
            background: item.bg,
            border: `1.5px solid ${item.border}`,
            borderRadius: 16,
            padding: "16px 18px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: item.color,
              margin: "0 0 4px",
              fontFamily: "Manrope, sans-serif",
            }}
          >
            {item.value}
          </p>
          <p
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".12em",
              color: item.color,
              margin: 0,
              opacity: 0.7,
            }}
          >
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function RoomManagementFilters({
  filters,
  roomTypes,
  floors,
  hasFilters,
  onFiltersChange,
  onClearFilters,
}) {
  const filterConfigs = [
    {
      label: "Trạng thái KD",
      key: "businessStatus",
      options: [
        { value: "", label: "Tất cả" },
        { value: "Available", label: "Sẵn sàng" },
        { value: "Occupied", label: "Đang dùng" },
        { value: "Disabled", label: "Bảo trì" },
      ],
    },
    {
      label: "Tình trạng vệ sinh",
      key: "cleaningStatus",
      options: [
        { value: "", label: "Tất cả" },
        { value: "Clean", label: "Sạch sẽ" },
        { value: "Dirty", label: "Cần dọn" },
      ],
    },
    {
      label: "Hạng phòng",
      key: "roomTypeId",
      options: [{ value: "", label: "Tất cả" }, ...roomTypes.map((rt) => ({ value: rt.id.toString(), label: rt.name }))],
    },
    {
      label: "Tầng",
      key: "floor",
      options: [{ value: "", label: "Tất cả" }, ...floors.map((f) => ({ value: f.toString(), label: `Tầng ${f}` }))],
    },
  ];

  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        padding: "18px 22px",
        marginBottom: 20,
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        border: "1px solid #f1f0ea",
        display: "flex",
        gap: 14,
        alignItems: "flex-end",
        flexWrap: "wrap",
      }}
    >
      {filterConfigs.map((filter) => (
        <div key={filter.key} style={{ flex: 1, minWidth: 160 }}>
          <label
            style={{
              display: "block",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".12em",
              color: "#9ca3af",
              marginBottom: 6,
            }}
          >
            {filter.label}
          </label>
          <select
            value={filters[filter.key]}
            onChange={(e) => onFiltersChange(filter.key, e.target.value)}
            style={{
              width: "100%",
              background: "#f9f8f3",
              border: "1.5px solid #e2e8e1",
              borderRadius: 12,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 500,
              outline: "none",
              fontFamily: "Manrope, sans-serif",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#4f645b";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e2e8e1";
            }}
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      {hasFilters && (
        <button
          onClick={onClearFilters}
          style={{
            padding: "9px 14px",
            borderRadius: 12,
            background: "#fee2e2",
            border: "1.5px solid #fecaca",
            color: "#dc2626",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
            fontFamily: "Manrope, sans-serif",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            filter_alt_off
          </span>
          Xóa lọc
        </button>
      )}
    </div>
  );
}

function RoomManagementTable({
  loading,
  paginatedRooms,
  rooms,
  page,
  pageSize,
  totalPages,
  hasFilters,
  onClearFilters,
  onPageChange,
  onDetail,
  onBusinessStatusChange,
  onCleaningStatusChange,
  SkeletonRows,
  StatusDropdown,
  businessStatusConfig,
  cleaningStatusConfig,
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        border: "1px solid #f1f0ea",
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(249,248,243,.6)", borderBottom: "1px solid #f1f0ea" }}>
              {["Số phòng", "Tầng", "Hạng phòng", "Trạng thái KD", "Vệ sinh", "Thao tác"].map((heading, index) => (
                <th
                  key={heading}
                  style={{
                    padding: "15px 24px",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    color: "#9ca3af",
                    textAlign: index === 5 ? "right" : "left",
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : paginatedRooms.length === 0 ? null : (
              paginatedRooms.map((room, index) => (
                <tr
                  key={room.id}
                  className="fade-row"
                  style={{ borderBottom: "1px solid #fafaf8", animationDelay: `${index * 20}ms` }}
                >
                  <td style={{ padding: "16px 24px" }}>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: "#1c1917",
                        fontFamily: "Manrope, sans-serif",
                      }}
                    >
                      {room.roomNumber}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#9ca3af" }}>#{room.id}</span>
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 14, color: "#4b5563", fontWeight: 500 }}>
                    {room.floor || "—"}
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 13, color: "#374151", fontWeight: 500 }}>
                    {room.roomTypeName || "—"}
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <StatusDropdown
                      options={["Available", "Occupied", "Disabled"]}
                      current={room.businessStatus}
                      onSelect={(value) => onBusinessStatusChange(room, value)}
                      configMap={businessStatusConfig}
                    />
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <StatusDropdown
                      options={["Clean", "Dirty"]}
                      current={room.cleaningStatus}
                      onSelect={(value) => onCleaningStatusChange(room, value)}
                      configMap={cleaningStatusConfig}
                    />
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right" }}>
                    <button
                      onClick={() => onDetail(room.id)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 10,
                        background: "#f0faf5",
                        border: "1.5px solid #a7f3d0",
                        color: "#059669",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        marginLeft: "auto",
                        fontFamily: "Manrope, sans-serif",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#4f645b";
                        e.currentTarget.style.color = "#e7fef3";
                        e.currentTarget.style.borderColor = "#4f645b";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#f0faf5";
                        e.currentTarget.style.color = "#059669";
                        e.currentTarget.style.borderColor = "#a7f3d0";
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                        visibility
                      </span>
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && paginatedRooms.length === 0 && (
        <div style={{ padding: "64px 0", textAlign: "center" }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 52, color: "#d1d5db", display: "block", marginBottom: 12 }}
          >
            meeting_room
          </span>
          <p style={{ color: "#9ca3af", fontWeight: 600, fontSize: 14 }}>Không tìm thấy phòng nào</p>
          {hasFilters && (
            <button
              onClick={onClearFilters}
              style={{
                marginTop: 12,
                padding: "7px 18px",
                borderRadius: 10,
                background: "#4f645b",
                color: "#e7fef3",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      {!loading && rooms.length > 0 && (
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #f1f0ea",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rooms.length)} / {rooms.length} phòng
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="pg-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                chevron_left
              </span>
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
              const pageNumber = totalPages <= 5 ? index + 1 : Math.max(1, page - 2) + index;
              if (pageNumber > totalPages) return null;
              return (
                <button
                  key={pageNumber}
                  className={`pg-btn${pageNumber === page ? " active" : ""}`}
                  onClick={() => onPageChange(pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            })}
            <button className="pg-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                chevron_right
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomManagementGrid({
  loading,
  paginatedRooms,
  rooms,
  page,
  pageSize,
  totalPages,
  onPageChange,
  RoomCard,
  onDetail,
}) {
  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14 }}>
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="skeleton" style={{ height: 130, borderRadius: 16 }} />
        ))}
      </div>
    );
  }

  if (paginatedRooms.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0" }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 52, color: "#d1d5db", display: "block", marginBottom: 12 }}
        >
          meeting_room
        </span>
        <p style={{ color: "#9ca3af", fontWeight: 600 }}>Không tìm thấy phòng nào</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14 }}>
        {paginatedRooms.map((room) => (
          <RoomCard key={room.id} room={room} onDetail={onDetail} />
        ))}
      </div>
      {rooms.length > pageSize && (
        <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 4 }}>
          <button className="pg-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              chevron_left
            </span>
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
            const pageNumber = Math.max(1, page - 2) + index;
            if (pageNumber > totalPages) return null;
            return (
              <button
                key={pageNumber}
                className={`pg-btn${pageNumber === page ? " active" : ""}`}
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </button>
            );
          })}
          <button className="pg-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              chevron_right
            </span>
          </button>
        </div>
      )}
    </>
  );
}

export {
  RoomManagementFilters,
  RoomManagementGrid,
  RoomManagementHeader,
  RoomManagementSummary,
  RoomManagementTable,
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function RoomManagementPage() {
    const permissions = useAdminAuthStore((s) => s.permissions);
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [roomTypes, setRoomTypes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState(() => {
        const saved = sessionStorage.getItem(ROOM_VIEW_MODE_STORAGE_KEY);
        return saved === "grid" ? "grid" : "table";
    }); // table | grid
    const [toasts, setToasts] = useState([]);
    const [filters, setFilters] = useState({ businessStatus: "", cleaningStatus: "", roomTypeId: "", floor: "" });
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(14);
    const showToast = useCallback((msg, type = "success") => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, msg, type }]);
    }, []);

    const dismissToast = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), []);
    const hasPermission = useCallback(
        (code) =>
            permissions.some(
                (p) =>
                    (typeof p === "string" && p === code) ||
                    (typeof p === "object" && p.permissionCode === code),
            ),
        [permissions],
    );
    const canManageInventory = hasPermission("MANAGE_INVENTORY");

    const loadRooms = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.businessStatus) params.businessStatus = filters.businessStatus;
            if (filters.cleaningStatus) params.cleaningStatus = filters.cleaningStatus;
            if (filters.roomTypeId) params.roomTypeId = parseInt(filters.roomTypeId);
            if (filters.floor) params.floor = parseInt(filters.floor);
            const res = await getRooms(params);
            setRooms(res.data?.data || []);
            setPage(1);
        } catch {
            showToast("Không thể tải danh sách phòng.", "error");
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const loadRoomTypes = useCallback(async () => {
        try {
            const res = await getAdminRoomTypes();
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setRoomTypes(data);
        } catch {
            setRoomTypes([]);
        }
    }, []);

    useEffect(() => { loadRooms(); }, [loadRooms]);
    useEffect(() => { loadRoomTypes(); }, [loadRoomTypes]);
    useEffect(() => { sessionStorage.setItem(ROOM_VIEW_MODE_STORAGE_KEY, viewMode); }, [viewMode]);

    // Stats
    const stats = {
        total: rooms.length,
        available: rooms.filter(r => (r.status || r.businessStatus) === "Available").length,
        occupied: rooms.filter(r => (r.status || r.businessStatus) === "Occupied").length,
        disabled: rooms.filter(r => (r.status || r.businessStatus) === "Maintenance" || r.businessStatus === "Disabled").length,
        dirty: rooms.filter(r => r.cleaningStatus === "Dirty").length,
    };

    // Pagination
    const totalPages = Math.max(1, Math.ceil(rooms.length / pageSize));
    const paginatedRooms = rooms.slice((page - 1) * pageSize, page * pageSize);

    // Unique floors for filter
    const floors = [...new Set(rooms.map(r => r.floor).filter(Boolean))].sort((a, b) => a - b);

    const clearFilters = () => setFilters({ businessStatus: "", cleaningStatus: "", roomTypeId: "", floor: "" });
    const hasFilters = Object.values(filters).some(Boolean);

    return (
        <>
            <style>{`        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        @keyframes toastProgress { from{width:100%} to{width:0} }
        @keyframes fadeRow { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .skeleton { background:linear-gradient(90deg,#e8e8e0 25%,#f2f2ea 50%,#e8e8e0 75%); background-size:600px; animation:shimmer 1.4s infinite; border-radius:6px; }
        .fade-row { animation:fadeRow .2s ease forwards; }
        tbody tr:hover td { background:#fafaf8 !important; }
        .pg-btn { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:#6b7280; background:transparent; border:none; cursor:pointer; transition:background .15s,color .15s; font-family:'Manrope',sans-serif; }
        .pg-btn:hover:not(:disabled) { background:#f3f4f6; }
        .pg-btn.active { background:#4f645b; color:#e7fef3; cursor:default; }
        .pg-btn:disabled { opacity:.35; cursor:not-allowed; }
      `}</style>

            {/* Khu v?c thông báo */}
            <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, pointerEvents: "none", minWidth: 280 }}>
                {toasts.map(t => <Toast key={t.id} {...t} onDismiss={dismissToast} />)}
            </div>

            {/* Create Wizard or List View */}
            {createModalOpen ? (
                <div style={{ maxWidth: 1400, margin: "0 auto", animation: "fadeRow .3s ease" }}>
                    <CreateRoomWizard
                        roomTypes={roomTypes}
                        allRooms={rooms}
                        onClose={() => setCreateModalOpen(false)}
                        onCreated={loadRooms}
                        showToast={showToast}
                        canManageInventory={canManageInventory}
                    />
                </div>
            ) : (
                <div style={{ maxWidth: 1400, margin: "0 auto", animation: "fadeRow .3s ease" }}>
                    <RoomManagementHeader
                        stats={stats}
                        hasFilters={hasFilters}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        onCreateRoom={() => setCreateModalOpen(true)}
                    />

                    <RoomManagementSummary stats={stats} />

                    <RoomManagementFilters
                        filters={filters}
                        roomTypes={roomTypes}
                        floors={floors}
                        hasFilters={hasFilters}
                        onFiltersChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                        onClearFilters={clearFilters}
                    />

                    {/* Table View */}
                    {viewMode === "table" && (
                        <RoomManagementTable
                            loading={loading}
                            paginatedRooms={paginatedRooms}
                            rooms={rooms}
                            page={page}
                            pageSize={pageSize}
                            totalPages={totalPages}
                            hasFilters={hasFilters}
                            onClearFilters={clearFilters}
                            onPageChange={setPage}
                            onDetail={(id) => navigate(`/admin/rooms/${id}`)}
                            onBusinessStatusChange={async (room, val) => {
                                try {
                                    await updateBusinessStatus(room.id, val);
                                    showToast(`Phòng ${room.roomNumber}: ${BUSINESS_STATUS_CONFIG[val]?.label}`, "success");
                                    loadRooms();
                                } catch (err) {
                                    showToast(err?.response?.data?.message || "Lỗi cập nhật trạng thái.", "error");
                                }
                            }}
                            onCleaningStatusChange={async (room, val) => {
                                try {
                                    await updateCleaningStatus(room.id, val);
                                    showToast(`Phòng ${room.roomNumber}: ${CLEANING_STATUS_CONFIG[val]?.label}`, "success");
                                    loadRooms();
                                } catch (err) {
                                    showToast(err?.response?.data?.message || "Lỗi cập nhật vệ sinh.", "error");
                                }
                            }}
                            SkeletonRows={SkeletonRows}
                            StatusDropdown={StatusDropdown}
                            businessStatusConfig={BUSINESS_STATUS_CONFIG}
                            cleaningStatusConfig={CLEANING_STATUS_CONFIG}
                        />
                    )}

                    {/* Grid View */}
                    {viewMode === "grid" && (
                        <RoomManagementGrid
                            loading={loading}
                            paginatedRooms={paginatedRooms}
                            rooms={rooms}
                            page={page}
                            pageSize={pageSize}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            RoomCard={RoomCard}
                            onDetail={(id) => navigate(`/admin/rooms/${id}`)}
                        />
                    )}
                </div>
            )}
        </>
    );
}





