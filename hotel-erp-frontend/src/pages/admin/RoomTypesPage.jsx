// src/pages/admin/RoomTypesPage.jsx
import { useState, useEffect, useCallback } from "react";
import {
    getAdminRoomTypes,
    getAdminRoomTypeById,
    createRoomType,
    updateRoomType,
    uploadRoomTypeImage,
    setPrimaryImage,
    toggleRoomTypeActive,
} from "../../api/roomTypesApi";

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

function CreateRoomTypeModal({ onClose, onCreated, showToast }) {
    const [submitting, setSubmitting] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [form, setForm] = useState({
        name: "",
        basePrice: "",
        capacityAdults: "",
        capacityChildren: "0",
        areaSqm: "",
        bedType: "",
        viewType: "",
        description: "",
    });

    const updateField = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        if (!imageFile) {
            setImagePreview("");
            return;
        }

        const previewUrl = URL.createObjectURL(imageFile);
        setImagePreview(previewUrl);

        return () => URL.revokeObjectURL(previewUrl);
    }, [imageFile]);

    const submit = async () => {
        if (!form.name.trim()) {
            showToast("Vui lòng nhập tên hạng phòng.", "warning");
            return;
        }
        if (!form.basePrice || Number(form.basePrice) <= 0) {
            showToast("Giá cơ bản phải lớn hơn 0.", "warning");
            return;
        }
        if (!form.capacityAdults || Number(form.capacityAdults) <= 0) {
            showToast("Sức chứa người lớn phải lớn hơn 0.", "warning");
            return;
        }
        if (form.capacityChildren !== "" && Number(form.capacityChildren) < 0) {
            showToast("Sức chứa trẻ em không được âm.", "warning");
            return;
        }

        setSubmitting(true);
        try {
            const res = await createRoomType({
                name: form.name.trim(),
                basePrice: Number(form.basePrice),
                capacityAdults: Number(form.capacityAdults),
                capacityChildren: Number(form.capacityChildren || 0),
                areaSqm: form.areaSqm ? Number(form.areaSqm) : null,
                bedType: form.bedType.trim() || null,
                viewType: form.viewType.trim() || null,
                description: form.description.trim() || null,
            });

            const roomTypeId = res?.data?.id;
            if (imageFile && roomTypeId) {
                await uploadRoomTypeImage(roomTypeId, imageFile);
            }

            showToast("Đã thêm hạng phòng mới.", "success");
            onCreated();
            onClose();
        } catch (err) {
            showToast(err?.response?.data?.message || "Không thể thêm hạng phòng.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 220, padding: 16 }}
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div style={{ background: "white", borderRadius: 24, width: "100%", maxWidth: 640, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,.18)" }}>
                <div style={{ padding: "22px 28px 16px", borderBottom: "1px solid #f1f0ea", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1c1917", margin: 0, fontFamily: "Manrope, sans-serif" }}>Thêm hạng phòng</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#9ca3af", display: "flex" }}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div style={{ padding: "20px 28px", overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                        ["Tên hạng phòng *", "name", "text", "Vd: Deluxe City View"],
                        ["Giá cơ bản *", "basePrice", "number", "VND/đêm"],
                        ["Sức chứa người lớn *", "capacityAdults", "number", "Vd: 2"],
                        ["Sức chứa trẻ em", "capacityChildren", "number", "Mặc định: 0"],
                        ["Diện tích (m²)", "areaSqm", "number", "Vd: 28"],
                        ["Loại giường", "bedType", "text", "Vd: King bed"],
                        ["Hướng nhìn", "viewType", "text", "Ví dụ: City view"],
                    ].map(([label, key, type, placeholder]) => (
                        <label key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <span style={{ fontSize: 12, color: "#4b5563", fontWeight: 700 }}>{label}</span>
                            <input
                                type={type}
                                value={form[key]}
                                placeholder={placeholder}
                                onChange={e => updateField(key, e.target.value)}
                                style={{ height: 40, borderRadius: 10, border: "1.5px solid #d6d3d1", padding: "0 12px", fontSize: 13, outline: "none" }}
                            />
                        </label>
                    ))}

                    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                        <span style={{ fontSize: 12, color: "#4b5563", fontWeight: 700 }}>Hình ảnh hạng phòng</span>
                        <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
                            <label style={{ minWidth: 180, height: 144, borderRadius: 14, border: "1.5px dashed #b8c8be", background: "#f8faf9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "#4f645b", fontSize: 12, fontWeight: 700 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>upload</span>
                                Chọn ảnh
                                <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: "none" }}
                                    onChange={e => setImageFile(e.target.files?.[0] || null)}
                                />
                            </label>
                            <div style={{ flex: 1, height: 144, borderRadius: 14, overflow: "hidden", background: "#f1f5f3", border: "1px solid #e2e8e1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                    <div style={{ textAlign: "center", color: "#94a3b8" }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 34, display: "block", marginBottom: 6 }}>image</span>
                                        <span style={{ fontSize: 12, fontWeight: 600 }}>Chưa chọn ảnh</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {imageFile && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#f5f8f6", border: "1px solid #d9e4dd" }}>
                                <span style={{ fontSize: 12, color: "#4b5563", fontWeight: 600, wordBreak: "break-all" }}>{imageFile.name}</span>
                                <button type="button" onClick={() => setImageFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 12, fontWeight: 700 }}>
                                    Bỏ ảnh
                                </button>
                            </div>
                        )}
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                            Ảnh sẽ được tải lên Cloudinary ngay sau khi thêm hạng phòng thành công.
                        </span>
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                        <span style={{ fontSize: 12, color: "#4b5563", fontWeight: 700 }}>Mô tả</span>
                        <textarea
                            value={form.description}
                            placeholder="Mô tả ngắn về hạng phòng..."
                            onChange={e => updateField("description", e.target.value)}
                            rows={4}
                            style={{ borderRadius: 10, border: "1.5px solid #d6d3d1", padding: "10px 12px", fontSize: 13, outline: "none", resize: "vertical" }}
                        />
                    </label>
                </div>

                <div style={{ padding: "14px 28px 22px", borderTop: "1px solid #f1f0ea", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
                    <button onClick={onClose} disabled={submitting} style={{ padding: "9px 16px", borderRadius: 12, background: "#f5f5f4", border: "1.5px solid #e7e5e4", color: "#57534e", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: submitting ? 0.6 : 1 }}>
                        Hủy
                    </button>
                    <button onClick={submit} disabled={submitting} style={{ padding: "9px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#4f645b,#43574f)", color: "#e7fef3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, opacity: submitting ? 0.6 : 1 }}>
                        {submitting && <div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "currentColor", borderRadius: "50%", animation: "spin .65s linear infinite" }} />}
                        Thêm hạng phòng
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditRoomTypeModal({ roomType, onClose, onUpdated, showToast }) {
    const [submitting, setSubmitting] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [form, setForm] = useState({
        name: roomType?.name || "",
        basePrice: roomType?.basePrice ?? "",
        capacityAdults: roomType?.capacityAdults ?? "",
        capacityChildren: roomType?.capacityChildren ?? "0",
        areaSqm: roomType?.areaSqm ?? "",
        bedType: roomType?.bedType || "",
        viewType: roomType?.viewType || "",
        description: roomType?.description || "",
    });

    const updateField = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        if (!imageFile) {
            setImagePreview("");
            return;
        }

        const previewUrl = URL.createObjectURL(imageFile);
        setImagePreview(previewUrl);

        return () => URL.revokeObjectURL(previewUrl);
    }, [imageFile]);

    const submit = async () => {
        if (!form.name.trim()) {
            showToast("Vui lòng nhập tên h?ng phòng.", "warning");
            return;
        }
        if (!form.basePrice || Number(form.basePrice) <= 0) {
            showToast("Giá cơ bản phải lớn hơn 0.", "warning");
            return;
        }
        if (!form.capacityAdults || Number(form.capacityAdults) <= 0) {
            showToast("Sức chứa người lớn phải lớn hơn 0.", "warning");
            return;
        }
        if (form.capacityChildren !== "" && Number(form.capacityChildren) < 0) {
            showToast("Sức chứa trẻ em không được âm.", "warning");
            return;
        }

        setSubmitting(true);
        try {
            await updateRoomType(roomType.id, {
                name: form.name.trim(),
                basePrice: Number(form.basePrice),
                capacityAdults: Number(form.capacityAdults),
                capacityChildren: Number(form.capacityChildren || 0),
                areaSqm: form.areaSqm ? Number(form.areaSqm) : null,
                bedType: form.bedType.trim() || null,
                viewType: form.viewType.trim() || null,
                description: form.description.trim() || null,
            });

            if (imageFile) {
                await uploadRoomTypeImage(roomType.id, imageFile);
            }

            showToast("Cập nhật hạng phòng thành công.", "success");
            onUpdated();
            onClose();
        } catch (err) {
            showToast(err?.response?.data?.message || "Không thể cập nhật hạng phòng.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 230, padding: 16 }}
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div style={{ background: "white", borderRadius: 24, width: "100%", maxWidth: 640, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,.18)" }}>
                <div style={{ padding: "22px 28px 16px", borderBottom: "1px solid #f1f0ea", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1c1917", margin: 0, fontFamily: "Manrope, sans-serif" }}>Chỉnh sửa hạng phòng</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#9ca3af", display: "flex" }}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div style={{ padding: "20px 28px", overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                        ["Tên hạng phòng *", "name", "text", "Vd: Deluxe City View"],
                        ["Giá cơ bản *", "basePrice", "number", "VND/đêm"],
                        ["Sức chứa người lớn *", "capacityAdults", "number", "Vd: 2"],
                        ["Sức chứa trẻ em", "capacityChildren", "number", "Mặc định: 0"],
                        ["Diện tích (m²)", "areaSqm", "number", "Vd: 28"],
                        ["Loại giường", "bedType", "text", "Vd: King bed"],
                        ["Hướng nhìn", "viewType", "text", "Vd: City view"],
                    ].map(([label, key, type, placeholder]) => (
                        <label key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <span style={{ fontSize: 12, color: "#4b5563", fontWeight: 700 }}>{label}</span>
                            <input
                                type={type}
                                value={form[key]}
                                placeholder={placeholder}
                                onChange={e => updateField(key, e.target.value)}
                                style={{ height: 40, borderRadius: 10, border: "1.5px solid #d6d3d1", padding: "0 12px", fontSize: 13, outline: "none" }}
                            />
                        </label>
                    ))}

                    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                        <span style={{ fontSize: 12, color: "#4b5563", fontWeight: 700 }}>Hình ảnh hạng phòng</span>
                        <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
                            <label style={{ minWidth: 180, height: 144, borderRadius: 14, border: "1.5px dashed #b8c8be", background: "#f8faf9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "#4f645b", fontSize: 12, fontWeight: 700 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>upload</span>
                                Chọn ảnh mới
                                <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: "none" }}
                                    onChange={e => setImageFile(e.target.files?.[0] || null)}
                                />
                            </label>
                            <div style={{ flex: 1, height: 144, borderRadius: 14, overflow: "hidden", background: "#f1f5f3", border: "1px solid #e2e8e1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : roomType?.images?.[0]?.imageUrl ? (
                                    <img src={roomType.images[0].imageUrl} alt={roomType.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                    <div style={{ textAlign: "center", color: "#94a3b8" }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 34, display: "block", marginBottom: 6 }}>image</span>
                                        <span style={{ fontSize: 12, fontWeight: 600 }}>Ch?a c? ?nh</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {imageFile && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#f5f8f6", border: "1px solid #d9e4dd" }}>
                                <span style={{ fontSize: 12, color: "#4b5563", fontWeight: 600, wordBreak: "break-all" }}>{imageFile.name}</span>
                                <button type="button" onClick={() => setImageFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 12, fontWeight: 700 }}>
                                    Bỏ ảnh
                                </button>
                            </div>
                        )}
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                            Khi lưu, ảnh mới sẽ được tải lên Cloudinary và thêm vào gallery của hạng phòng này.
                        </span>
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                        <span style={{ fontSize: 12, color: "#4b5563", fontWeight: 700 }}>Mô tả</span>
                        <textarea
                            value={form.description}
                            placeholder="Mô tả ngắn về hạng phòng..."
                            onChange={e => updateField("description", e.target.value)}
                            rows={4}
                            style={{ borderRadius: 10, border: "1.5px solid #d6d3d1", padding: "10px 12px", fontSize: 13, outline: "none", resize: "vertical" }}
                        />
                    </label>
                </div>

                <div style={{ padding: "14px 28px 22px", borderTop: "1px solid #f1f0ea", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
                    <button onClick={onClose} disabled={submitting} style={{ padding: "9px 16px", borderRadius: 12, background: "#f5f5f4", border: "1.5px solid #e7e5e4", color: "#57534e", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: submitting ? 0.6 : 1 }}>
                        Hủy
                    </button>
                    <button onClick={submit} disabled={submitting} style={{ padding: "9px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#4f645b,#43574f)", color: "#e7fef3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, opacity: submitting ? 0.6 : 1 }}>
                        {submitting && <div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "currentColor", borderRadius: "50%", animation: "spin .65s linear infinite" }} />}
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
    );
}

//  Room Type Detail Modal ────────────────────────────────────────────────────
function RoomTypeDetailModal({ roomTypeId, onClose, onUpdated, showToast }) {
    const [rt, setRt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [settingPrimaryId, setSettingPrimaryId] = useState(null);
    const [selectedImg, setSelectedImg] = useState(null);
    const [editOpen, setEditOpen] = useState(false);


    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getAdminRoomTypeById(roomTypeId);
            setRt(res.data);
            setSelectedImg(res.data?.images?.find(i => i.isPrimary) || res.data?.images?.[0] || null);
        } catch {
            showToast("Không thể tải hạng phòng.", "error");
            onClose();
        } finally {
            setLoading(false);
        }
    }, [roomTypeId]);

    useEffect(() => { load(); }, [load]);

    const handleToggle = async () => {
        setToggling(true);
        try {
            const res = await toggleRoomTypeActive(roomTypeId);
            showToast(res.data?.message || "Đã cập nhật trạng thái.", "success");
            load();
            onUpdated();
        } catch (err) {
            showToast(err?.response?.data?.message || "Không thể đổi trạng thái.", "error");
        } finally {
            setToggling(false);
        }
    };

    const handleSelectImage = async (img) => {
        setSelectedImg(img);

        if (img?.isPrimary || settingPrimaryId) {
            return;
        }

        setSettingPrimaryId(img.id);
        try {
            const res = await setPrimaryImage(roomTypeId, img.id);
            showToast(res.data?.message || "Đã cập nhật ảnh chính.", "success");
            await load();
            onUpdated();
        } catch (err) {
            showToast(err?.response?.data?.message || "Không thể đặt ảnh chính.", "error");
        } finally {
            setSettingPrimaryId(null);
        }
    };

    return (
        <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            {editOpen && rt && (
                <EditRoomTypeModal
                    roomType={rt}
                    onClose={() => setEditOpen(false)}
                    onUpdated={async () => {
                        await load();
                        onUpdated();
                    }}
                    showToast={showToast}
                />
            )}
            <div style={{ background: "white", borderRadius: 24, width: "100%", maxWidth: 640, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,.18)" }}>
                {/* Header */}
                <div style={{ padding: "22px 28px 16px", borderBottom: "1px solid #f1f0ea", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                    <div>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1c1917", margin: 0, fontFamily: "Manrope, sans-serif" }}>
                            {loading ? "Đang tải..." : rt?.name}
                        </h3>
                        {rt && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                                <span style={{
                                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
                                    background: rt.isActive ? "#ecfdf5" : "#f3f4f6",
                                    color: rt.isActive ? "#059669" : "#6b7280",
                                }}>
                                    {rt.isActive ? "Đang hoạt động" : "Đã tắt"}
                                </span>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#9ca3af", display: "flex" }}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: "20px 28px", overflowY: "auto", flex: 1 }}>
                    {loading ? (
                        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                            <div style={{ width: 28, height: 28, border: "3px solid rgba(79,100,91,.2)", borderTopColor: "#4f645b", borderRadius: "50%", animation: "spin .65s linear infinite" }} />
                        </div>
                    ) : rt ? (
                        <>
                            {/* Image Gallery */}
                            {rt.images && rt.images.length > 0 && (
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ height: 200, borderRadius: 16, overflow: "hidden", background: "#f1f0ea", marginBottom: 8 }}>
                                        {selectedImg ? (
                                            <img src={selectedImg.imageUrl} alt={rt.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        ) : (
                                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#d1d5db" }}>bed</span>
                                            </div>
                                        )}
                                    </div>
                                    {rt.images.length > 1 && (
                                        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                                            {rt.images.map(img => (
                                                <div
                                                    key={img.id}
                                                    onClick={() => handleSelectImage(img)}
                                                    style={{
                                                        width: 56, height: 42, flexShrink: 0, borderRadius: 8, overflow: "hidden", cursor: "pointer",
                                                        border: selectedImg?.id === img.id ? "2px solid #4f645b" : "2px solid transparent",
                                                        opacity: selectedImg?.id === img.id ? 1 : 0.6,
                                                        transition: "all .15s",
                                                        position: "relative",
                                                    }}
                                                >
                                                    <img src={img.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                    {img.isPrimary && (
                                                        <span style={{ position: "absolute", top: 3, right: 3, width: 10, height: 10, borderRadius: 9999, background: "#10b981", border: "2px solid white", boxShadow: "0 1px 4px rgba(0,0,0,.18)" }} />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <p style={{ fontSize: 12, color: "#6b7280", margin: "8px 0 0" }}>
                                        Chọn ảnh nhỏ bên dưới để xem nhanh và đặt làm ảnh chính cho thẻ hạng phòng.
                                        {settingPrimaryId && " Đang cập nhật ảnh chính..."}
                                    </p>
                                </div>
                            )}

                            {/* Info Grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                                {[
                                    ["Giá cơ bản", new Intl.NumberFormat("vi-VN").format(rt.basePrice) + "đ/đêm"],
                                    ["Loại giường", rt.bedType || "—"],
                                    ["Diện tích", rt.areaSqm ? `${rt.areaSqm} m²` : "—"],
                                    ["Hướng nhìn", rt.viewType || "—"],
                                    ["Sức chứa người lớn", rt.capacityAdults || "—"],
                                    ["Sức chứa trẻ em", rt.capacityChildren != null ? rt.capacityChildren : "—"],
                                ].map(([k, v]) => (
                                    <div key={k} style={{ padding: "10px 14px", background: "#f9f8f3", borderRadius: 12 }}>
                                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#9ca3af", margin: "0 0 3px" }}>{k}</p>
                                        <p style={{ fontSize: 14, fontWeight: 600, color: "#1c1917", margin: 0 }}>{v}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Amenities */}
                            {rt.amenities && rt.amenities.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#9ca3af", margin: "0 0 10px" }}>
                                        Tiện nghi ({rt.amenities.length})
                                    </p>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {rt.amenities.map(a => (
                                            <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#e8f5f0", color: "#2f433c", borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>
                                                    {a.iconUrl || "star"}
                                                </span>
                                                {a.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            {rt.description && (
                                <div style={{ padding: "12px 14px", background: "#f9f8f3", borderRadius: 12, marginBottom: 16 }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#9ca3af", margin: "0 0 6px" }}>Mô tả</p>
                                    <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.6 }}>{rt.description}</p>
                                </div>
                            )}

                        </>
                    ) : null}
                </div>

                {/* Footer */}
                {!loading && rt && (
                    <div style={{ padding: "14px 28px 22px", borderTop: "1px solid #f1f0ea", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
                        <button
                            onClick={() => setEditOpen(true)}
                            style={{ padding: "9px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "#eef7f1", color: "#355347", border: "1.5px solid #b8d1c3", cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                            Chỉnh sửa
                        </button>
                        <button
                            onClick={handleToggle}
                            disabled={toggling}
                            style={{ padding: "9px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: rt.isActive ? "#fff7ed" : "linear-gradient(135deg,#4f645b,#43574f)", color: rt.isActive ? "#ea580c" : "#e7fef3", border: rt.isActive ? "1.5px solid #fed7aa" : "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, opacity: toggling ? 0.6 : 1 }}
                        >
                            {toggling && <div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "currentColor", borderRadius: "50%", animation: "spin .65s linear infinite" }} />}
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{rt.isActive ? "toggle_off" : "toggle_on"}</span>
                            {rt.isActive ? "Tắt hạng phòng" : "Bật hạng phòng"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function RoomTypesPage() {
    const [roomTypes, setRoomTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toasts, setToasts] = useState([]);
    const [detailId, setDetailId] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [filterActive, setFilterActive] = useState("all"); // all | active | inactive

    const showToast = useCallback((msg, type = "success") => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, msg, type }]);
    }, []);

    const dismissToast = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), []);

    const loadRoomTypes = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getAdminRoomTypes();
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setRoomTypes(data);
        } catch {
            showToast("Không thể tải danh sách hạng phòng.", "error");
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { loadRoomTypes(); }, [loadRoomTypes]);

    const filtered = roomTypes.filter(rt => {
        if (filterActive === "active") return rt.isActive;
        if (filterActive === "inactive") return !rt.isActive;
        return true;
    });

    const stats = {
        total: roomTypes.length,
        active: roomTypes.filter(r => r.isActive).length,
        inactive: roomTypes.filter(r => !r.isActive).length,
    };

    return (
        <>
            <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes toastProgress { from{width:100%} to{width:0} }
        @keyframes fadeRow { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .rt-card { transition:all .18s; cursor:pointer; }
        .rt-card:hover { transform:translateY(-3px); box-shadow:0 12px 28px rgba(0,0,0,.09) !important; }
        .skeleton { background:linear-gradient(90deg,#e8e8e0 25%,#f2f2ea 50%,#e8e8e0 75%); background-size:600px; animation:shimmer 1.4s infinite; border-radius:12px; }
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
      `}</style>

            {/* Khu v?c thông báo */}
            <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, pointerEvents: "none", minWidth: 280 }}>
                {toasts.map(t => <Toast key={t.id} {...t} onDismiss={dismissToast} />)}
            </div>

            {/* H?p tho?i chi ti?t */}
            {detailId && (
                <RoomTypeDetailModal
                    roomTypeId={detailId}
                    onClose={() => setDetailId(null)}
                    onUpdated={loadRoomTypes}
                    showToast={showToast}
                />
            )}
            {createOpen && (
                <CreateRoomTypeModal
                    onClose={() => setCreateOpen(false)}
                    onCreated={loadRoomTypes}
                    showToast={showToast}
                />
            )}

            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                {/* Page Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                    <div>
                        <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.025em", margin: "0 0 4px", fontFamily: "Manrope, sans-serif" }}>
                            Hạng phòng
                        </h2>
                        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                            Tổng <span style={{ fontWeight: 700, color: "#1c1917" }}>{stats.total}</span> hạng phòng
                        </p>
                    </div>
                    <button
                        onClick={() => setCreateOpen(true)}
                        style={{ height: 40, padding: "0 16px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#4f645b,#43574f)", color: "#e7fef3", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                        Thêm hạng phòng
                    </button>
                </div>

                {/* Stat Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
                    {[
                        { label: "TỔNG", value: stats.total, bg: "#f8f9fa", color: "#6b7280", border: "#f1f0ea", filter: "all" },
                        { label: "ĐANG HOẠT ĐỘNG", value: stats.active, bg: "#ecfdf5", color: "#059669", border: "#a7f3d0", filter: "active" },
                        { label: "ĐÃ TẮT", value: stats.inactive, bg: "#f9fafb", color: "#9ca3af", border: "#e5e7eb", filter: "inactive" },
                    ].map(s => (
                        <div
                            key={s.label}
                            onClick={() => setFilterActive(s.filter)}
                            style={{
                                background: s.bg, border: `1.5px solid ${filterActive === s.filter ? s.color : s.border}`,
                                borderRadius: 16, padding: "16px 18px", textAlign: "center", cursor: "pointer", transition: "all .15s",
                                boxShadow: filterActive === s.filter ? `0 0 0 3px ${s.color}22` : "none",
                            }}
                        >
                            <p style={{ fontSize: 24, fontWeight: 800, color: s.color, margin: "0 0 4px", fontFamily: "Manrope, sans-serif" }}>{s.value}</p>
                            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: s.color, margin: 0, opacity: 0.7 }}>{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Cards Grid */}
                {loading ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="skeleton" style={{ height: 220 }} />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "80px 0" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 52, color: "#d1d5db", display: "block", marginBottom: 12 }}>category</span>
                        <p style={{ color: "#9ca3af", fontWeight: 600, fontSize: 14 }}>Không có hạng phòng nào</p>
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                        {filtered.map(rt => {
                            const primaryImg = rt.primaryImage?.imageUrl;
                            return (
                                <div
                                    key={rt.id}
                                    className="rt-card"
                                    onClick={() => setDetailId(rt.id)}
                                    style={{
                                        background: "white", borderRadius: 20, overflow: "hidden",
                                        border: "1.5px solid #f1f0ea", boxShadow: "0 2px 8px rgba(0,0,0,.04)",
                                        opacity: rt.isActive ? 1 : 0.65,
                                    }}
                                >
                                    {/* Image */}
                                    <div style={{ height: 140, background: "linear-gradient(135deg,#d1e8dd,#c3dacf)", position: "relative", overflow: "hidden" }}>
                                        {primaryImg ? (
                                            <img src={primaryImg} alt={rt.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                                        ) : (
                                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 44, color: "#4f645b", opacity: 0.5 }}>bed</span>
                                            </div>
                                        )}
                                        {/* Status badge */}
                                        <div style={{ position: "absolute", top: 10, right: 10 }}>
                                            <span style={{
                                                fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 9999,
                                                background: rt.isActive ? "#ecfdf5" : "#f3f4f6",
                                                color: rt.isActive ? "#059669" : "#6b7280",
                                                backdropFilter: "blur(6px)",
                                            }}>
                                                {rt.isActive ? "Hoạt động" : "Đã tắt"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div style={{ padding: "14px 16px 16px" }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1c1917", margin: "0 0 4px", fontFamily: "Manrope, sans-serif" }}>{rt.name}</h3>
                                        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
                                            {rt.bedType} · {rt.areaSqm}m²{rt.viewType ? ` · ${rt.viewType}` : ""}
                                        </p>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontSize: 15, fontWeight: 800, color: "#4f645b", fontFamily: "Manrope, sans-serif" }}>
                                                {new Intl.NumberFormat("vi-VN").format(rt.basePrice)}đ
                                                <span style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af" }}>/đêm</span>
                                            </span>
                                            {rt.amenities && rt.amenities.length > 0 && (
                                                <span style={{ fontSize: 11, color: "#6b7280", background: "#f9f8f3", padding: "3px 8px", borderRadius: 8 }}>
                                                    {rt.amenities.length} tiện nghi
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

