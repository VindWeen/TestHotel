// src/pages/admin/RoomDetailPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAdminAuthStore } from "../../store/adminAuthStore";
import { getRoomById, updateBusinessStatus, updateCleaningStatus } from "../../api/roomsApi";
import {
    getInventoryByRoom,
    createInventory,
    updateInventory,
    deleteInventory,
    cloneInventory,
} from "../../api/roomInventoriesApi";
import { getEquipments } from "../../api/equipmentsApi";
import { getRooms } from "../../api/roomsApi";

// ─── Toast ────────────────────────────────────────────────────────────────────
const TOAST_CFG = {
    success: { bg: "#1e3a2f", border: "#2d5a45", text: "#a7f3d0", prog: "#34d399", icon: "check_circle" },
    error: { bg: "#3a1e1e", border: "#5a2d2d", text: "#fca5a5", prog: "#f87171", icon: "error" },
    warning: { bg: "#3a2e1a", border: "#5a4820", text: "#fcd34d", prog: "#fbbf24", icon: "warning" },
    info: { bg: "#1e2f3a", border: "#2d4a5a", text: "#93c5fd", prog: "#60a5fa", icon: "info" },
};

function Toast({ id, msg, type = "success", onDismiss }) {
    const s = TOAST_CFG[type] || TOAST_CFG.info;
    useEffect(() => {
        const t = setTimeout(() => onDismiss(id), 4000);
        return () => clearTimeout(t);
    }, []);
    return (
        <div style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.3)", marginBottom: 10, animation: "toastIn .35s cubic-bezier(.22,1,.36,1) forwards", minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 13px 9px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 19, flexShrink: 0, marginTop: 1, fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, margin: 0, flex: 1 }}>{msg}</p>
                <button onClick={() => onDismiss(id)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2, color: "inherit" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                </button>
            </div>
            <div style={{ margin: "0 12px 9px", height: 3, borderRadius: 9999, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 9999, background: s.prog, animation: "toastProgress 4000ms linear forwards" }} />
            </div>
        </div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skel = ({ w = "100%", h = 16, r = 8 }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#e8e8e0 25%,#f2f2ea 50%,#e8e8e0 75%)", backgroundSize: "600px", animation: "shimmer 1.4s infinite" }} />
);

// ─── Modal: Thêm/Sửa vật tư ──────────────────────────────────────────────────
function InventoryModal({ open, onClose, onSave, editItem, roomId, equipments }) {
    const [form, setForm] = useState({ equipmentId: "", itemType: "Asset", quantity: 1, priceIfLost: "", note: "" });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (editItem) {
            setForm({
                equipmentId: editItem.equipmentId || "",
                itemType: editItem.itemType || "Asset",
                quantity: editItem.quantity ?? 1,
                priceIfLost: editItem.priceIfLost ?? "",
                note: editItem.note || "",
            });
        } else {
            setForm({ equipmentId: "", itemType: "Asset", quantity: 1, priceIfLost: "", note: "" });
        }
        setErr("");
    }, [editItem, open]);

    if (!open) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.equipmentId) { setErr("Vui lòng chọn vật tư từ danh mục."); return; }
        setLoading(true); setErr("");
        try {
            const payload = {
                equipmentId: Number(form.equipmentId),
                itemType: form.itemType,
                quantity: Number(form.quantity),
                priceIfLost: form.priceIfLost ? Number(form.priceIfLost) : null,
                note: form.note?.trim() || null,
            };
            if (editItem) {
                await updateInventory(editItem.id, payload);
            } else {
                await createInventory({ roomId, ...payload });
            }
            onSave();
        } catch (e) {
            setErr(e?.response?.data?.message || "Có lỗi xảy ra.");
        } finally { setLoading(false); }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,.2)", animation: "modalIn .25s cubic-bezier(.22,1,.36,1)" }}>
                <div style={{ padding: "24px 28px 18px", borderBottom: "1px solid #f1f0ea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1c1917", margin: 0 }}>{editItem ? "Chỉnh sửa vật tư" : "Thêm vật tư mới"}</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#9ca3af", display: "flex" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>
                <form onSubmit={handleSubmit} style={{ padding: "20px 28px 24px" }}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 6 }}>Chọn vật tư *</label>
                        <select
                            value={form.equipmentId}
                            onChange={e => {
                                const equipmentId = e.target.value;
                                const selectedEquipment = equipments.find((x) => String(x.id) === equipmentId);
                                setForm((f) => ({
                                    ...f,
                                    equipmentId,
                                    priceIfLost: f.priceIfLost || selectedEquipment?.defaultPriceIfLost || "",
                                }));
                            }}
                            style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, background: "rgba(227,227,219,.5)", color: "#31332e", outline: "none", boxSizing: "border-box" }}
                        >
                            <option value="">Chọn từ danh mục thiết bị</option>
                            {equipments.map((equipment) => (
                                <option key={equipment.id} value={equipment.id}>
                                    {equipment.name} {equipment.itemCode ? `(${equipment.itemCode})` : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                        <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 6 }}>Loại</label>
                            <select value={form.itemType} onChange={e => setForm(f => ({ ...f, itemType: e.target.value }))}
                                style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, background: "rgba(227,227,219,.5)", color: "#31332e", outline: "none" }}>
                                <option value="Asset">Asset (Tài sản)</option>
                                <option value="Minibar">Minibar</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 6 }}>Số lượng</label>
                            <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                                style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, background: "rgba(227,227,219,.5)", color: "#31332e", outline: "none", boxSizing: "border-box" }} />
                        </div>
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 6 }}>Giá đền bù (VND)</label>
                        <input type="number" min="0" value={form.priceIfLost} onChange={e => setForm(f => ({ ...f, priceIfLost: e.target.value }))}
                            placeholder="5000000"
                            style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, background: "rgba(227,227,219,.5)", color: "#31332e", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 6 }}>Ghi chú</label>
                        <textarea
                            value={form.note}
                            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                            rows={3}
                            style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, background: "rgba(227,227,219,.5)", color: "#31332e", outline: "none", boxSizing: "border-box", resize: "vertical" }}
                        />
                    </div>
                    {err && (
                        <div style={{ marginBottom: 16, borderRadius: 12, padding: "10px 14px", background: "rgba(168,56,54,.1)", border: "1px solid rgba(168,56,54,.25)", color: "#a83836", fontSize: 13 }}>{err}</div>
                    )}
                    <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" onClick={onClose}
                            style={{ flex: 1, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: "none", border: "1.5px solid #e2e8e1", color: "#4b5563", cursor: "pointer" }}>
                            Hủy
                        </button>
                        <button type="submit" disabled={loading}
                            style={{ flex: 1, padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none", background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)", color: "#e7fef3", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                            {loading ? "Đang lưu..." : editItem ? "Cập nhật" : "Thêm vật tư"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Modal: Clone vật tư ──────────────────────────────────────────────────────
function CloneModal({ open, onClose, onSave, currentRoomId }) {
    const [rooms, setRooms] = useState([]);
    const [sourceRoomId, setSourceRoomId] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (open) {
            setFetching(true);
            getRooms().then(res => {
                const list = (res.data?.data || []).filter(r => r.id !== currentRoomId);
                setRooms(list);
            }).catch(() => { }).finally(() => setFetching(false));
            setSourceRoomId("");
            setErr("");
        }
    }, [open]);

    if (!open) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!sourceRoomId) { setErr("Vui lòng chọn phòng nguồn."); return; }
        setLoading(true); setErr("");
        try {
            await cloneInventory(Number(sourceRoomId), [currentRoomId]);
            onSave();
        } catch (e) {
            setErr(e?.response?.data?.message || "Không thể clone vật tư.");
        } finally { setLoading(false); }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,.2)" }}>
                <div style={{ padding: "24px 28px 18px", borderBottom: "1px solid #f1f0ea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1c1917", margin: 0 }}>Clone vật tư từ phòng mẫu</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#9ca3af", display: "flex" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>
                <form onSubmit={handleSubmit} style={{ padding: "20px 28px 24px" }}>
                    <div style={{ marginBottom: 8, padding: "12px 14px", background: "#fef3c7", borderRadius: 10, fontSize: 12, color: "#92400e", display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0 }}>warning</span>
                        Thao tác này sẽ sao chép toàn bộ vật tư từ phòng nguồn vào phòng hiện tại. Không ảnh hưởng đến phòng nguồn.
                    </div>
                    <div style={{ marginBottom: 20, marginTop: 16 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 6 }}>Chọn phòng nguồn</label>
                        {fetching ? <Skel h={44} r={12} /> : (
                            <select value={sourceRoomId} onChange={e => setSourceRoomId(e.target.value)}
                                style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, background: "rgba(227,227,219,.5)", color: "#31332e", outline: "none" }}>
                                <option value="">-- Chọn phòng --</option>
                                {rooms.map(r => (
                                    <option key={r.id} value={r.id}>Phòng {r.roomNumber} {r.roomTypeName ? `(${r.roomTypeName})` : ""}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    {err && <div style={{ marginBottom: 14, borderRadius: 10, padding: "10px 14px", background: "rgba(168,56,54,.1)", color: "#a83836", fontSize: 13 }}>{err}</div>}
                    <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: "none", border: "1.5px solid #e2e8e1", color: "#4b5563", cursor: "pointer" }}>Hủy</button>
                        <button type="submit" disabled={loading} style={{ flex: 1, padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none", background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)", color: "#e7fef3", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                            {loading ? "Đang clone..." : "Clone vật tư"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RoomDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const permissions = useAdminAuthStore((s) => s.permissions);

    const [activeTab, setActiveTab] = useState("basic");
    const [room, setRoom] = useState(null);
    const [inventory, setInventory] = useState([]);
    const [equipments, setEquipments] = useState([]);
    const [loadingRoom, setLoadingRoom] = useState(true);
    const [loadingInv, setLoadingInv] = useState(false);
    const [savingStatus, setSavingStatus] = useState(false);
    const [businessStatus, setBusinessStatus] = useState("");
    const [cleaningStatus, setCleaningStatus] = useState("");
    const [toasts, setToasts] = useState([]);

    // Modal states
    const [invModal, setInvModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [cloneModal, setCloneModal] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    // Pagination
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 8;

    const showToast = useCallback((msg, type = "success") => {
        const tid = Date.now() + Math.random();
        setToasts(prev => [...prev, { id: tid, msg, type }]);
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

    // Load room info
    const loadRoom = useCallback(async () => {
        setLoadingRoom(true);
        try {
            const res = await getRoomById(id);
            const data = res.data;
            setRoom(data);
            setBusinessStatus(data.businessStatus || "Available");
            setCleaningStatus(data.cleaningStatus || "Clean");
        } catch (e) {
            showToast(e?.response?.data?.message || "Không thể tải thông tin phòng.", "error");
        } finally { setLoadingRoom(false); }
    }, [id]);

    // Load inventory
    const loadInventory = useCallback(async () => {
        if (!canManageInventory) return;
        setLoadingInv(true);
        try {
            const res = await getInventoryByRoom(id);
            // Flatten grouped data
            const grouped = res.data?.data || [];
            const items = grouped.flatMap(g => g.items || []);
            setInventory(items);
        } catch (e) {
            showToast(e?.response?.data?.message || "Không thể tải vật tư.", "error");
        } finally { setLoadingInv(false); }
    }, [canManageInventory, id]);

    const loadEquipments = useCallback(async () => {
        if (!canManageInventory) return;
        try {
            const res = await getEquipments();
            setEquipments(res.data?.data || []);
        } catch (e) {
            showToast(e?.response?.data?.message || "Không thể tải danh mục vật tư.", "error");
        }
    }, [canManageInventory, showToast]);

    useEffect(() => { loadRoom(); }, [loadRoom]);

    useEffect(() => {
        if (activeTab === "inventory") loadInventory();
    }, [activeTab, loadInventory]);

    useEffect(() => {
        if (canManageInventory) loadEquipments();
        else if (activeTab === "inventory") setActiveTab("basic");
    }, [activeTab, canManageInventory, loadEquipments]);

    // Save status
    const handleSaveStatus = async () => {
        setSavingStatus(true);
        try {
            const tasks = [];
            if (businessStatus !== room?.businessStatus)
                tasks.push(updateBusinessStatus(id, businessStatus));
            if (cleaningStatus !== room?.cleaningStatus)
                tasks.push(updateCleaningStatus(id, cleaningStatus));
            if (tasks.length === 0) { showToast("Không có thay đổi.", "info"); setSavingStatus(false); return; }
            await Promise.all(tasks);
            showToast("Đã lưu trạng thái thành công.", "success");
            loadRoom();
        } catch (e) {
            showToast(e?.response?.data?.message || "Không thể lưu trạng thái.", "error");
        } finally { setSavingStatus(false); }
    };

    // Delete inventory item
    const handleDelete = async (itemId, equipmentName) => {
        if (!window.confirm(`Bạn có chắc muốn xóa vật tư "${equipmentName}"?`)) return;
        setDeletingId(itemId);
        try {
            await deleteInventory(itemId);
            showToast(`Đã xóa vật tư "${equipmentName}".`, "success");
            loadInventory();
        } catch (e) {
            showToast(e?.response?.data?.message || "Không thể xóa vật tư.", "error");
        } finally { setDeletingId(null); }
    };

    const fmtCurrency = (n) => n == null ? "—" : new Intl.NumberFormat("vi-VN").format(n);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(inventory.length / PAGE_SIZE));
    const paginatedInv = inventory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const STATUS_BS = {
        Available: { label: "Sẵn sàng đón khách", dot: "#10b981", badge: "#d1fae5", badgeText: "#065f46" },
        Occupied: { label: "Đang có khách", dot: "#3b82f6", badge: "#dbeafe", badgeText: "#1d4ed8" },
        Disabled: { label: "Ngưng kinh doanh", dot: "#94a3b8", badge: "#f1f5f9", badgeText: "#475569" },
    };

    const STATUS_CS = {
        Clean: { label: "Đã dọn dẹp", dot: "#10b981", badge: "#d1fae5", badgeText: "#065f46" },
        Dirty: { label: "Phòng bẩn (Dirty)", dot: "#f59e0b", badge: "#fef3c7", badgeText: "#92400e" },
    };

    const statusKey = room?.status || room?.businessStatus;
    const bsCfg =
        (statusKey === "Cleaning"
            ? { label: "Đang dọn phòng", dot: "#2563eb", badge: "#dbeafe", badgeText: "#1d4ed8" }
            : statusKey === "Maintenance"
                ? { label: "Đang bảo trì", dot: "#8b5cf6", badge: "#ede9fe", badgeText: "#6d28d9" }
                : STATUS_BS[statusKey]) || STATUS_BS.Available;
    const csCfg = STATUS_CS[room?.cleaningStatus] || STATUS_CS.Clean;

    return (
        <>
            <style>{`
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        @keyframes toastIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes toastProgress { from{width:100%} to{width:0} }
        @keyframes modalIn { from{transform:scale(.95);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes fadeRow { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .fade-row { animation: fadeRow .2s ease forwards; }
        .pg-btn { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:#6b7280; background:transparent; border:none; cursor:pointer; transition:background .15s; }
        .pg-btn:hover:not(:disabled) { background:#f3f4f6; }
        .pg-btn.active { background:#4f645b; color:#e7fef3; cursor:default; }
        .pg-btn:disabled { opacity:.35; cursor:not-allowed; }
        .action-btn { padding:7px 8px; border:none; background:none; cursor:pointer; border-radius:8px; transition:all .15s; display:flex; align-items:center; }
        .action-btn:hover { background:#f3f4f6; }
        .tab-btn { padding:0 4px 16px; font-size:14px; font-weight:600; background:none; border:none; cursor:pointer; transition:all .15s; position:relative; }
        tr.inv-row:hover td { background:rgba(249,248,243,.6); }
      `}</style>

            {/* Toast Container */}
            <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, pointerEvents: "none" }}>
                {toasts.map(t => <Toast key={t.id} {...t} onDismiss={dismissToast} />)}
            </div>

            {/* Modals */}
            <InventoryModal
                open={invModal}
                onClose={() => { setInvModal(false); setEditItem(null); }}
                onSave={() => { setInvModal(false); setEditItem(null); showToast(editItem ? "Cập nhật vật tư thành công." : "Thêm vật tư thành công."); loadInventory(); }}
                editItem={editItem}
                roomId={Number(id)}
                equipments={equipments}
            />
            <CloneModal
                open={cloneModal}
                onClose={() => setCloneModal(false)}
                onSave={() => { setCloneModal(false); showToast("Clone vật tư thành công."); loadInventory(); }}
                currentRoomId={Number(id)}
            />

            {/* Page Content */}
            <div style={{ maxWidth: 1300, margin: "0 auto" }}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
                    <div>
                        <button
                            onClick={() => navigate(-1)}
                            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "#4f645b", background: "none", border: "none", cursor: "pointer", marginBottom: 12, padding: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                            Quay lại danh sách
                        </button>
                        {loadingRoom ? (
                            <Skel w={280} h={34} r={8} />
                        ) : (
                            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.03em", margin: 0 }}>
                                Chi tiết phòng — {room?.roomNumber}
                            </h1>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                        <button
                            onClick={() => window.print()}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "white", color: "#1c1917", border: "1px solid #e2e8e1", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>print</span>
                            In báo cáo
                        </button>
                        {activeTab === "basic" && (
                            <button
                                onClick={handleSaveStatus}
                                disabled={savingStatus}
                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)", color: "#e7fef3", border: "none", cursor: "pointer", opacity: savingStatus ? 0.7 : 1, boxShadow: "0 4px 12px rgba(79,100,91,.25)" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
                                {savingStatus ? "Đang lưu..." : "Lưu thay đổi"}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: 32, marginBottom: 28, borderBottom: "1px solid #f1f0ea" }}>
                    {[
                        { key: "basic", label: "Thông tin cơ bản", icon: "info" },
                        ...(canManageInventory ? [{ key: "inventory", label: "Quản lý vật tư", icon: "inventory_2", count: inventory.length }] : []),
                    ].map(tab => (
                        <button
                            key={tab.key}
                            className="tab-btn"
                            onClick={() => setActiveTab(tab.key)}
                            style={{ color: activeTab === tab.key ? "#4f645b" : "#9ca3af" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 17, fontVariationSettings: activeTab === tab.key ? "'FILL' 1" : "'FILL' 0" }}>{tab.icon}</span>
                                {tab.label}
                                {tab.count > 0 && (
                                    <span style={{ fontSize: 11, fontWeight: 700, background: activeTab === tab.key ? "rgba(79,100,91,.15)" : "#f3f4f6", color: activeTab === tab.key ? "#4f645b" : "#9ca3af", padding: "1px 7px", borderRadius: 9999 }}>{tab.count}</span>
                                )}
                            </span>
                            {activeTab === tab.key && (
                                <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "#4f645b", borderRadius: "3px 3px 0 0" }} />
                            )}
                        </button>
                    ))}
                </div>

                {/* ── TAB: Thông tin cơ bản ── */}
                {activeTab === "basic" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {/* Tổng quan phòng */}
                        <div style={{ background: "white", borderRadius: 16, padding: "28px 32px", boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #f1f0ea" }}>
                            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1c1917", margin: "0 0 24px", display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ width: 4, height: 20, background: "#4f645b", borderRadius: 2 }} />
                                Tổng quan phòng
                            </h3>
                            {loadingRoom ? (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
                                    {Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={70} r={12} />)}
                                </div>
                            ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
                                    {[
                                        { label: "Số phòng", value: room?.roomNumber, icon: "door_front" },
                                        { label: "Tầng", value: room?.floor ? `Tầng ${room.floor}` : "—", icon: "apartment" },
                                        { label: "Hạng phòng", value: room?.roomTypeName || "—", icon: "bed" },
                                        { label: "View phòng", value: room?.viewType || "—", icon: "landscape" },
                                    ].map((field, i) => (
                                        <div key={i} style={{ background: "#fafaf8", borderRadius: 14, padding: "16px 18px", border: "1px solid #f1f0ea" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 15, color: "#9ca3af" }}>{field.icon}</span>
                                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "#9ca3af" }}>{field.label}</span>
                                            </div>
                                            <p style={{ fontSize: 16, fontWeight: 700, color: "#1c1917", margin: 0 }}>{field.value}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Trạng thái vận hành */}
                        <div style={{ background: "white", borderRadius: 16, padding: "28px 32px", boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #f1f0ea" }}>
                            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1c1917", margin: "0 0 24px", display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ width: 4, height: 20, background: "#4f645b", borderRadius: 2 }} />
                                Trạng thái vận hành
                            </h3>

                            {/* Current status badges */}
                            {!loadingRoom && (
                                <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 9999, background: bsCfg.badge }}>
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: bsCfg.dot }} />
                                        <span style={{ fontSize: 12, fontWeight: 700, color: bsCfg.badgeText }}>Kinh doanh: {bsCfg.label}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 9999, background: csCfg.badge }}>
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: csCfg.dot }} />
                                        <span style={{ fontSize: 12, fontWeight: 700, color: csCfg.badgeText }}>Vệ sinh: {csCfg.label}</span>
                                    </div>
                                </div>
                            )}

                            {loadingRoom ? (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                                    <Skel h={52} r={12} /><Skel h={52} r={12} />
                                </div>
                            ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 8 }}>
                                            Trạng thái kinh doanh
                                        </label>
                                        <select
                                            value={businessStatus}
                                            onChange={e => setBusinessStatus(e.target.value)}
                                            style={{ width: "100%", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 14, fontWeight: 600, color: "#31332e", background: "rgba(227,227,219,.5)", outline: "none" }}>
                                            <option value="Available">Sẵn sàng đón khách</option>
                                            <option value="Occupied">Đang có khách</option>
                                            <option value="Disabled">Ngưng kinh doanh</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5e6059", marginBottom: 8 }}>
                                            Trạng thái buồng phòng
                                        </label>
                                        <select
                                            value={cleaningStatus}
                                            onChange={e => setCleaningStatus(e.target.value)}
                                            style={{ width: "100%", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 14, fontWeight: 600, color: "#31332e", background: "rgba(227,227,219,.5)", outline: "none" }}>
                                            <option value="Clean">Đã dọn dẹp (Clean)</option>
                                            <option value="Dirty">Phòng bẩn (Dirty)</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        {!loadingRoom && room?.notes && (
                            <div style={{ background: "white", borderRadius: 16, padding: "24px 32px", boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #f1f0ea" }}>
                                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1c1917", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ width: 4, height: 20, background: "#4f645b", borderRadius: 2 }} />
                                    Ghi chú
                                </h3>
                                <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.7, margin: 0 }}>{room.notes}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: Quản lý vật tư ── */}
                {activeTab === "inventory" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {/* Action Bar */}
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "20px 24px", background: "white", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #f1f0ea" }}>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <button
                                    onClick={() => { setEditItem(null); setInvModal(true); }}
                                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)", color: "#e7fef3", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(79,100,91,.25)" }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>add</span>
                                    Thêm vật tư
                                </button>
                                <button
                                    onClick={() => loadInventory()}
                                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "white", color: "#1c1917", border: "1px solid #e2e8e1", cursor: "pointer" }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>sync</span>
                                    Làm mới
                                </button>
                                <button
                                    onClick={() => setCloneModal(true)}
                                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "white", color: "#1c1917", border: "1px solid #e2e8e1", cursor: "pointer" }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>content_copy</span>
                                    Clone từ phòng mẫu
                                </button>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af", fontSize: 12 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
                                Tổng số vật tư: <strong style={{ color: "#4f645b", marginLeft: 4 }}>{inventory.length}</strong>
                            </div>
                        </div>

                        {/* Table */}
                        <div style={{ background: "white", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #f1f0ea", overflow: "hidden" }}>
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                                    <thead>
                                        <tr style={{ background: "rgba(249,248,243,.5)" }}>
                                            {["Mã VT", "Tên vật tư", "Loại", "Số lượng", "Giá đền bù (VND)", "Thao tác"].map((h, i) => (
                                                <th key={h} style={{ padding: "14px 20px", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#9ca3af", textAlign: i === 3 ? "center" : i === 4 ? "right" : "left", borderBottom: "1px solid #f1f0ea", whiteSpace: "nowrap" }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingInv ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <tr key={i}>
                                                    {Array.from({ length: 6 }).map((_, j) => (
                                                        <td key={j} style={{ padding: "16px 20px" }}><Skel h={13} w={j === 0 ? 60 : j === 3 ? 40 : j === 4 ? 90 : 130} /></td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : paginatedInv.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ padding: "56px 0", textAlign: "center" }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#d1d5db", display: "block", marginBottom: 12 }}>inventory_2</span>
                                                    <p style={{ color: "#9ca3af", fontWeight: 500, fontSize: 14, margin: 0 }}>Chưa có vật tư nào trong phòng này</p>
                                                    <button onClick={() => { setEditItem(null); setInvModal(true); }}
                                                        style={{ marginTop: 16, padding: "8px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "#4f645b", color: "#e7fef3", border: "none", cursor: "pointer" }}>
                                                        + Thêm vật tư đầu tiên
                                                    </button>
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedInv.map((item, i) => {
                                                const code = `VT-${String(item.id).padStart(4, "0")}`;
                                                return (
                                                    <tr key={item.id} className="inv-row fade-row" style={{ borderBottom: "1px solid #fafaf8", animationDelay: `${i * 25}ms` }}>
                                                        <td style={{ padding: "16px 20px" }}>
                                                            <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#4f645b", letterSpacing: ".05em" }}>{code}</span>
                                                        </td>
                                                        <td style={{ padding: "16px 20px", fontSize: 14, fontWeight: 500, color: "#1c1917" }}>{item.equipmentName}</td>
                                                        <td style={{ padding: "16px 20px" }}>
                                                            <span style={{
                                                                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 9999,
                                                                background: item.itemType === "Asset" ? "#dbeafe" : "#fef3c7",
                                                                color: item.itemType === "Asset" ? "#1d4ed8" : "#92400e",
                                                            }}>
                                                                {item.itemType}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: "16px 20px", textAlign: "center" }}>
                                                            <span style={{ fontSize: 13, fontWeight: 700, padding: "3px 12px", borderRadius: 9999, background: "#e8f0ee", color: "#4f645b" }}>
                                                                {String(item.quantity ?? 0).padStart(2, "0")}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: "16px 20px", textAlign: "right", fontSize: 14, fontWeight: 600, color: "#1c1917" }}>
                                                            {fmtCurrency(item.priceIfLost)}
                                                        </td>
                                                        <td style={{ padding: "16px 20px" }}>
                                                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                                                                <button
                                                                    className="action-btn"
                                                                    onClick={() => { setEditItem(item); setInvModal(true); }}
                                                                    title="Chỉnh sửa"
                                                                    style={{ color: "#4f645b" }}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>edit</span>
                                                                </button>
                                                                <button
                                                                    className="action-btn"
                                                                    onClick={() => handleDelete(item.id, item.equipmentName)}
                                                                    disabled={deletingId === item.id}
                                                                    title="Xóa"
                                                                    style={{ color: deletingId === item.id ? "#d1d5db" : "#ef4444" }}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                                                                        {deletingId === item.id ? "hourglass_empty" : "delete"}
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

                            {/* Pagination */}
                            {!loadingInv && inventory.length > PAGE_SIZE && (
                                <div style={{ padding: "14px 20px", borderTop: "1px solid #f1f0ea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: 12, color: "#9ca3af" }}>
                                        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, inventory.length)} / {inventory.length} vật tư
                                    </span>
                                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                        <button className="pg-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                                        </button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                                            <button key={n} className={`pg-btn${n === page ? " active" : ""}`} onClick={() => setPage(n)}>{n}</button>
                                        ))}
                                        <button className="pg-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
