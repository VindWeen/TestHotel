import { useCallback, useEffect, useMemo, useState } from "react";
import { createEquipment, getEquipments, toggleEquipmentActive, updateEquipment } from "../../api/equipmentsApi";

const fmtCurrency = (value) =>
  value == null ? "—" : new Intl.NumberFormat("vi-VN").format(value) + "đ";

const INPUT_STYLE = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #e2e8e1",
  background: "#fff",
  fontSize: 14,
  outline: "none",
};

const emptyForm = {
  itemCode: "",
  name: "",
  category: "",
  unit: "",
  totalQuantity: "",
  basePrice: "",
  defaultPriceIfLost: "",
  supplier: "",
  imageFile: null,
  currentImageUrl: "",
};

function Toast({ message, type = "success", onClose }) {
  const palette = {
    success: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
    error: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
  };
  const s = palette[type] || palette.success;

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 300,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 700,
        boxShadow: "0 8px 20px rgba(0,0,0,.12)",
      }}
    >
      {message}
    </div>
  );
}

function EquipmentModal({ open, mode, form, setForm, loading, error, onClose, onSubmit }) {
  if (!open) return null;

  const title = mode === "edit" ? "Chỉnh sửa vật tư" : "Thêm vật tư";
  const submitLabel = loading ? "Đang lưu..." : mode === "edit" ? "Cập nhật" : "Thêm vật tư";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 220,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          background: "white",
          borderRadius: 18,
          boxShadow: "0 24px 64px rgba(0,0,0,.2)",
          border: "1px solid #f1f0ea",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 22px",
            borderBottom: "1px solid #f1f0ea",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1c1917" }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ padding: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>Mã VT *</label>
              <input value={form.itemCode} onChange={(e) => setForm((p) => ({ ...p, itemCode: e.target.value }))} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>Tên vật tư *</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>Danh mục *</label>
              <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>ĐVT *</label>
              <input value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>Tổng số lượng *</label>
              <input type="number" min="0" value={form.totalQuantity} onChange={(e) => setForm((p) => ({ ...p, totalQuantity: e.target.value }))} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>Giá gốc *</label>
              <input type="number" min="0" value={form.basePrice} onChange={(e) => setForm((p) => ({ ...p, basePrice: e.target.value }))} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>Giá đền bù *</label>
              <input type="number" min="0" value={form.defaultPriceIfLost} onChange={(e) => setForm((p) => ({ ...p, defaultPriceIfLost: e.target.value }))} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>Nhà cung cấp</label>
              <input value={form.supplier} onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))} style={INPUT_STYLE} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>Ảnh từ máy (optional)</label>
            {mode === "edit" && form.currentImageUrl ? (
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center", marginBottom: 8 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 12, overflow: "hidden",
                  border: "1.5px solid #e2e8e1", flexShrink: 0,
                  background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <img src={form.currentImageUrl} alt="current" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 8px", fontWeight: 600 }}>Ảnh hiện tại</p>
                  <label
                    htmlFor="equipment-img-upload"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "7px 14px", borderRadius: 10,
                      border: "1.5px dashed #a7c4bb", background: "#f5f8f6",
                      color: "#4f645b", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
                    Thay ảnh
                  </label>
                  {form.imageFile && (
                    <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{form.imageFile.name}</p>
                  )}
                </div>
              </div>
            ) : (
              <label
                htmlFor="equipment-img-upload"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "8px 16px", borderRadius: 10,
                  border: "1.5px dashed #a7c4bb", background: "#f5f8f6",
                  color: "#4f645b", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  marginBottom: 6,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload_file</span>
                Chọn ảnh
                {form.imageFile && (
                  <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, marginLeft: 4 }}>{form.imageFile.name}</span>
                )}
              </label>
            )}
            <input
              id="equipment-img-upload"
              type="file"
              accept="image/*"
              onChange={(e) => setForm((p) => ({ ...p, imageFile: e.target.files?.[0] || null }))}
              style={{ display: "none" }}
            />
          </div>

          {error && (
            <div
              style={{
                marginTop: 12,
                borderRadius: 10,
                padding: "10px 12px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 20px",
                borderRadius: 10,
                border: "1px solid #e2e8e1",
                background: "white",
                color: "#4b5563",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 20px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)",
                color: "#e7fef3",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                opacity: loading ? 0.65 : 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {loading && (
                <div style={{ width: 13, height: 13, border: "2px solid rgba(231,254,243,.4)", borderTopColor: "#e7fef3", borderRadius: "50%", animation: "spin .65s linear infinite" }} />
              )}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EquipmentPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    active: "all",
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [togglingId, setTogglingId] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast({ message: "", type: "success" });
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getEquipments({ includeInactive: true });
      setItems(res.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Không thể tải danh sách vật tư.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(),
    [items]
  );

  const filteredItems = items.filter((item) => {
    const search = filters.search.trim().toLowerCase();
    const matchesSearch =
      !search ||
      item.name?.toLowerCase().includes(search) ||
      item.itemCode?.toLowerCase().includes(search) ||
      item.supplier?.toLowerCase().includes(search);
    const matchesCategory = !filters.category || item.category === filters.category;
    const matchesActive =
      filters.active === "all" ||
      (filters.active === "active" && item.isActive) ||
      (filters.active === "inactive" && !item.isActive);
    return matchesSearch && matchesCategory && matchesActive;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.category, filters.active]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setForm(emptyForm);
    setSubmitError("");
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setModalMode("edit");
    setEditingId(item.id);
    setForm({
      itemCode: item.itemCode || "",
      name: item.name || "",
      category: item.category || "",
      unit: item.unit || "",
      totalQuantity: item.totalQuantity ?? 0,
      basePrice: item.basePrice ?? 0,
      defaultPriceIfLost: item.defaultPriceIfLost ?? 0,
      supplier: item.supplier || "",
      imageFile: null,
      currentImageUrl: item.imageUrl || "",
    });
    setSubmitError("");
    setModalOpen(true);
  };

  const validateForm = () => {
    if (!form.itemCode?.trim()) return "Mã VT không được để trống.";
    if (!form.name?.trim()) return "Tên vật tư không được để trống.";
    if (!form.category?.trim()) return "Danh mục không được để trống.";
    if (!form.unit?.trim()) return "ĐVT không được để trống.";

    const totalQty = Number(form.totalQuantity);
    const basePrice = Number(form.basePrice);
    const lostPrice = Number(form.defaultPriceIfLost);

    if (!Number.isFinite(totalQty) || totalQty < 0) return "Tổng số lượng phải >= 0.";
    if (!Number.isFinite(basePrice) || basePrice < 0) return "Giá gốc phải >= 0.";
    if (!Number.isFinite(lostPrice) || lostPrice < 0) return "Giá đền bù phải >= 0.";

    return "";
  };

  const handleSubmitModal = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitLoading(true);
    setSubmitError("");
    try {
      const payload = new FormData();
      payload.append("itemCode", form.itemCode.trim());
      payload.append("name", form.name.trim());
      payload.append("category", form.category.trim());
      payload.append("unit", form.unit.trim());
      payload.append("totalQuantity", String(Number(form.totalQuantity)));
      payload.append("basePrice", String(Number(form.basePrice)));
      payload.append("defaultPriceIfLost", String(Number(form.defaultPriceIfLost)));
      if (form.supplier?.trim()) payload.append("supplier", form.supplier.trim());
      if (form.imageFile) payload.append("imageFile", form.imageFile);

      if (modalMode === "edit" && editingId) {
        await updateEquipment(editingId, payload);
        showToast("Cập nhật vật tư thành công.", "success");
      } else {
        await createEquipment(payload);
        showToast("Thêm vật tư thành công.", "success");
      }

      setModalOpen(false);
      await loadItems();
    } catch (e) {
      setSubmitError(e?.response?.data?.message || "Không thể lưu vật tư.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleToggleActive = async (item) => {
    setTogglingId(item.id);
    try {
      const res = await toggleEquipmentActive(item.id);
      showToast(res?.data?.message || "Cập nhật trạng thái thành công.", "success");
      await loadItems();
    } catch (e) {
      showToast(e?.response?.data?.message || "Không thể cập nhật trạng thái.", "error");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <Toast message={toast.message} type={toast.type} onClose={closeToast} />

      <EquipmentModal
        open={modalOpen}
        mode={modalMode}
        form={form}
        setForm={setForm}
        loading={submitLoading}
        error={submitError}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitModal}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#1c1917", margin: "0 0 6px" }}>
            Vật tư & Minibar
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            Tổng <strong style={{ color: "#1c1917" }}>{filteredItems.length}</strong> vật tư hiển thị từ bảng Equipments
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={openCreateModal}
            style={{
              padding: "10px 18px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)",
              color: "#e7fef3",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Thêm vật tư
          </button>
          <button
            onClick={loadItems}
            style={{
              padding: "10px 18px",
              borderRadius: 12,
              border: "1px solid #e2e8e1",
              background: "white",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Làm mới
          </button>
        </div>
      </div>

      <div style={{ background: "white", borderRadius: 18, padding: 20, border: "1px solid #f1f0ea", boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 20, display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}>
        <input
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          placeholder="Tìm theo tên, mã vật tư, nhà cung cấp..."
          style={INPUT_STYLE}
        />
        <select
          value={filters.category}
          onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
          style={INPUT_STYLE}
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select
          value={filters.active}
          onChange={(e) => setFilters((prev) => ({ ...prev, active: e.target.value }))}
          style={INPUT_STYLE}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Đã tắt</option>
        </select>
      </div>

      <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
        {error ? (
          <div style={{ padding: 32, color: "#dc2626", fontWeight: 600 }}>{error}</div>
        ) : loading ? (
          <div style={{ padding: 32, color: "#6b7280" }}>Đang tải dữ liệu vật tư...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 32, color: "#6b7280" }}>Không có vật tư phù hợp bộ lọc.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1300 }}>
              <thead>
                <tr style={{ background: "#f9f8f3" }}>
                  {[
                    "Mã VT",
                    "Tên vật tư",
                    "Danh mục",
                    "ĐVT",
                    "Tổng",
                    "Đang dùng",
                    "Hỏng",
                    "Thanh lý",
                    "Tồn kho",
                    "Giá gốc",
                    "Đền bù",
                    "Nhà cung cấp",
                    "Trạng thái",
                    "Thao tác",
                  ].map((title) => (
                    <th key={title} style={{ padding: "14px 16px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#9ca3af", textAlign: "left", borderBottom: "1px solid #f1f0ea" }}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "16px", fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#4f645b" }}>{item.itemCode}</td>
                    <td style={{ padding: "16px", fontSize: 14, fontWeight: 700, color: "#1c1917" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover", border: "1px solid #f1f0ea" }} />
                        ) : (
                          <div style={{ width: 42, height: 42, borderRadius: 10, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>inventory_2</span>
                          </div>
                        )}
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "16px", fontSize: 13, color: "#475569" }}>{item.category || "—"}</td>
                    <td style={{ padding: "16px", fontSize: 13, color: "#475569" }}>{item.unit || "—"}</td>
                    <td style={{ padding: "16px", fontSize: 13, fontWeight: 700 }}>{item.totalQuantity ?? 0}</td>
                    <td style={{ padding: "16px", fontSize: 13, fontWeight: 700 }}>{item.inUseQuantity ?? 0}</td>
                    <td style={{ padding: "16px", fontSize: 13, fontWeight: 700 }}>{item.damagedQuantity ?? 0}</td>
                    <td style={{ padding: "16px", fontSize: 13, fontWeight: 700 }}>{item.liquidatedQuantity ?? 0}</td>
                    <td style={{ padding: "16px", fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{item.inStockQuantity ?? 0}</td>
                    <td style={{ padding: "16px", fontSize: 13, color: "#475569" }}>{fmtCurrency(item.basePrice)}</td>
                    <td style={{ padding: "16px", fontSize: 13, color: "#dc2626", fontWeight: 700 }}>{fmtCurrency(item.defaultPriceIfLost)}</td>
                    <td style={{ padding: "16px", fontSize: 13, color: "#475569" }}>{item.supplier || "—"}</td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          disabled={togglingId === item.id}
                          aria-label={item.isActive ? "Tắt vật tư" : "Bật vật tư"}
                          style={{
                            width: 46,
                            height: 26,
                            border: "none",
                            borderRadius: 9999,
                            padding: 3,
                            cursor: togglingId === item.id ? "not-allowed" : "pointer",
                            background: item.isActive ? "#4f645b" : "#d1d5db",
                            opacity: togglingId === item.id ? 0.65 : 1,
                            transition: "background .18s ease",
                            position: "relative",
                          }}
                        >
                          <span
                            style={{
                              display: "block",
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: "white",
                              boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                              transform: item.isActive ? "translateX(20px)" : "translateX(0)",
                              transition: "transform .18s ease",
                            }}
                          />
                        </button>
                        <span style={{ fontSize: 11, fontWeight: 700, color: item.isActive ? "#4f645b" : "#6b7280" }}>
                          {togglingId === item.id ? "Đang đổi..." : item.isActive ? "Bật" : "Tắt"}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        title="Chỉnh sửa"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 9,
                          border: "1.5px solid rgba(79,100,91,.2)",
                          background: "#f0faf5",
                          color: "#1a3826",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all .15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#4f645b"; e.currentTarget.style.color = "#e7fef3"; e.currentTarget.style.borderColor = "#4f645b"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#f0faf5"; e.currentTarget.style.color = "#1a3826"; e.currentTarget.style.borderColor = "rgba(79,100,91,.2)"; }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 17, fontVariationSettings: "'FILL' 0" }}>edit_note</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !error && filteredItems.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, gap: 16, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
            Trang <strong style={{ color: "#1c1917" }}>{page}</strong> / {totalPages}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: "#6b7280", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.35 : 1 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
            </button>
            {Array.from({ length: totalPages }).map((_, index) => {
              const pageNumber = index + 1;
              const active = pageNumber === page;
              return (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "none",
                    cursor: active ? "default" : "pointer",
                    background: active ? "#4f645b" : "transparent",
                    color: active ? "#e7fef3" : "#6b7280",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {pageNumber}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: "#6b7280", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.35 : 1 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

