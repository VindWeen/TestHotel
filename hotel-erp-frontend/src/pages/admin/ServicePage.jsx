import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createService,
  createServiceCategory,
  deleteService,
  deleteServiceCategory,
  getServiceCategories,
  getServices,
  toggleService,
  toggleServiceCategory,
  updateService,
  updateServiceCategory,
} from "../../api/servicesApi";
import { formatCurrency } from "../../utils";

const panelStyle = {
  background: "white",
  borderRadius: 16,
  border: "1px solid #f1f0ea",
  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
};

const inputStyle = {
  width: "100%",
  background: "#f9f8f3",
  border: "1px solid #e2e8e1",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#6b7280",
  marginBottom: 8,
};

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,25,23,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "white",
          borderRadius: 24,
          border: "1px solid #ede7dd",
          boxShadow: "0 24px 60px rgba(28,25,23,.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "22px 24px 16px",
            borderBottom: "1px solid #f1f0ea",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 22, color: "#1c1917" }}>{title}</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78716c" }}>
              Giao diện đồng bộ với admin hiện tại.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#78716c" }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

export default function ServicePage() {
  const [categoryRows, setCategoryRows] = useState([]);
  const [serviceRows, setServiceRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoryKeyword, setCategoryKeyword] = useState("");
  const [serviceKeyword, setServiceKeyword] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [serviceForm, setServiceForm] = useState({
    categoryId: "",
    name: "",
    description: "",
    price: "",
    unit: "",
    imageUrl: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeCategories = useMemo(
    () => categoryRows.filter((item) => item.isActive),
    [categoryRows],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [categoryRes, serviceRes] = await Promise.all([
        getServiceCategories({
          page: 1,
          pageSize: 100,
          keyword: categoryKeyword,
          includeInactive,
        }),
        getServices({
          page: 1,
          pageSize: 200,
          keyword: serviceKeyword,
          categoryId: selectedCategoryId || null,
          includeInactive,
        }),
      ]);

      setCategoryRows(categoryRes.data?.data || []);
      setServiceRows(serviceRes.data?.data || []);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể tải dữ liệu dịch vụ.");
    } finally {
      setLoading(false);
    }
  }, [categoryKeyword, serviceKeyword, selectedCategoryId, includeInactive]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setErrorMessage("");
  };

  const resetServiceForm = () => {
    setEditingService(null);
    setServiceForm({
      categoryId: "",
      name: "",
      description: "",
      price: "",
      unit: "",
      imageUrl: "",
    });
    setErrorMessage("");
  };

  const openCategoryModal = (category = null) => {
    setEditingCategory(category);
    setCategoryName(category?.name || "");
    setErrorMessage("");
    setCategoryModalOpen(true);
  };

  const openServiceModal = (service = null) => {
    setEditingService(service);
    setServiceForm({
      categoryId: service?.categoryId?.toString() || "",
      name: service?.name || "",
      description: service?.description || "",
      price: service?.price?.toString() || "",
      unit: service?.unit || "",
      imageUrl: service?.imageUrl || "",
    });
    setErrorMessage("");
    setServiceModalOpen(true);
  };

  const submitCategory = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    try {
      if (editingCategory) {
        await updateServiceCategory(editingCategory.id, { name: categoryName });
      } else {
        await createServiceCategory({ name: categoryName });
      }
      setCategoryModalOpen(false);
      resetCategoryForm();
      await loadData();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể lưu nhóm dịch vụ.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitService = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    const payload = {
      categoryId: serviceForm.categoryId ? Number(serviceForm.categoryId) : null,
      name: serviceForm.name,
      description: serviceForm.description || null,
      price: Number(serviceForm.price),
      unit: serviceForm.unit || null,
      imageUrl: serviceForm.imageUrl || null,
    };
    try {
      if (editingService) {
        await updateService(editingService.id, payload);
      } else {
        await createService(payload);
      }
      setServiceModalOpen(false);
      resetServiceForm();
      await loadData();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể lưu dịch vụ.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCategoryAction = async (handler, id, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await handler(id);
      await loadData();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể cập nhật nhóm dịch vụ.");
    }
  };

  const handleServiceAction = async (handler, id, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await handler(id);
      await loadData();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể cập nhật dịch vụ.");
    }
  };

  return (
    <>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 24,
            gap: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#1c1917" }}>
              Quản lý Dịch vụ
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#6b7280" }}>
              Quản lý đồng thời nhóm dịch vụ và dịch vụ phát sinh theo cùng theme admin.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => openCategoryModal()}
              style={primaryButton(false)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>category</span>
              Thêm nhóm
            </button>
            <button
              onClick={() => openServiceModal()}
              style={primaryButton(true)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>room_service</span>
              Thêm dịch vụ
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div style={{ ...panelStyle, marginBottom: 20, padding: 16, color: "#b91c1c", background: "#fff7f7" }}>
            {errorMessage}
          </div>
        ) : null}

        <section style={{ ...panelStyle, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 0.9fr auto", gap: 16, alignItems: "end" }}>
            <div>
              <label style={labelStyle}>Tìm nhóm dịch vụ</label>
              <input value={categoryKeyword} onChange={(e) => setCategoryKeyword(e.target.value)} style={inputStyle} placeholder="Nhà hàng, Spa..." />
            </div>
            <div>
              <label style={labelStyle}>Tìm dịch vụ</label>
              <input value={serviceKeyword} onChange={(e) => setServiceKeyword(e.target.value)} style={inputStyle} placeholder="Buffet, giặt ủi..." />
            </div>
            <div>
              <label style={labelStyle}>Lọc theo nhóm</label>
              <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} style={inputStyle}>
                <option value="">Tất cả nhóm</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                color: "#44403c",
                paddingBottom: 10,
              }}
            >
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Hiện cả dữ liệu đã ẩn
            </label>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.35fr", gap: 24 }}>
          <section style={{ ...panelStyle, overflow: "hidden" }}>
            <SectionHeader
              icon="category"
              title="Nhóm dịch vụ"
              subtitle={`${categoryRows.length} nhóm`}
            />
            <div style={{ padding: 18 }}>
              {loading ? (
                <EmptyState label="Đang tải nhóm dịch vụ..." icon="hourglass_top" />
              ) : categoryRows.length === 0 ? (
                <EmptyState label="Chưa có nhóm dịch vụ nào." icon="inventory_2" />
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {categoryRows.map((category) => (
                    <div key={category.id} style={rowCardStyle(category.isActive)}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <strong style={{ fontSize: 15, color: "#1c1917" }}>{category.name}</strong>
                          <StatusChip active={category.isActive} />
                        </div>
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#78716c" }}>
                          {category.serviceCount ?? 0} dịch vụ đang hoạt động
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <IconButton icon="edit" title="Sửa" onClick={() => openCategoryModal(category)} />
                        <IconButton
                          icon={category.isActive ? "visibility_off" : "visibility"}
                          title={category.isActive ? "Ẩn" : "Hiện"}
                          onClick={() => handleCategoryAction(toggleServiceCategory, category.id)}
                        />
                        <IconButton
                          icon="delete"
                          title="Xóa mềm"
                          danger
                          onClick={() =>
                            handleCategoryAction(
                              deleteServiceCategory,
                              category.id,
                              `Xóa mềm nhóm "${category.name}"?`,
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section style={{ ...panelStyle, overflow: "hidden" }}>
            <SectionHeader
              icon="room_service"
              title="Dịch vụ"
              subtitle={`${serviceRows.length} dịch vụ`}
            />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#faf8f3", borderBottom: "1px solid #f1f0ea" }}>
                    {["Dịch vụ", "Nhóm", "Giá", "Đơn vị", "Trạng thái", "Thao tác"].map((heading, idx) => (
                      <th
                        key={heading}
                        style={{
                          padding: "16px 18px",
                          textAlign: idx === 5 ? "right" : "left",
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: ".08em",
                          color: "#78716c",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 48 }}>
                        <EmptyState label="Đang tải dịch vụ..." icon="hourglass_top" />
                      </td>
                    </tr>
                  ) : serviceRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 48 }}>
                        <EmptyState label="Chưa có dịch vụ phù hợp bộ lọc." icon="search_off" />
                      </td>
                    </tr>
                  ) : (
                    serviceRows.map((service) => (
                      <tr key={service.id} style={{ borderBottom: "1px solid #f7f4ee" }}>
                        <td style={{ padding: "16px 18px" }}>
                          <div>
                            <div style={{ fontWeight: 700, color: "#1c1917", fontSize: 14 }}>{service.name}</div>
                            <div style={{ color: "#78716c", fontSize: 12, marginTop: 4 }}>
                              {service.description || "Chưa có mô tả"}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "16px 18px", color: "#57534e", fontSize: 14 }}>
                          {service.categoryName || "Chưa gán nhóm"}
                        </td>
                        <td style={{ padding: "16px 18px", color: "#1f2937", fontWeight: 700 }}>
                          {formatCurrency(service.price)}
                        </td>
                        <td style={{ padding: "16px 18px", color: "#57534e" }}>
                          {service.unit || "—"}
                        </td>
                        <td style={{ padding: "16px 18px" }}>
                          <StatusChip active={service.isActive} label={service.isActive ? "Đang bán" : "Đã ẩn"} />
                        </td>
                        <td style={{ padding: "16px 18px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8 }}>
                            <IconButton icon="edit" title="Sửa" onClick={() => openServiceModal(service)} />
                            <IconButton
                              icon={service.isActive ? "visibility_off" : "visibility"}
                              title={service.isActive ? "Ẩn" : "Hiện"}
                              onClick={() => handleServiceAction(toggleService, service.id)}
                            />
                            <IconButton
                              icon="delete"
                              title="Xóa mềm"
                              danger
                              onClick={() =>
                                handleServiceAction(deleteService, service.id, `Xóa mềm dịch vụ "${service.name}"?`)
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={categoryModalOpen}
        title={editingCategory ? "Cập nhật nhóm dịch vụ" : "Tạo nhóm dịch vụ"}
        onClose={() => {
          setCategoryModalOpen(false);
          resetCategoryForm();
        }}
      >
        <form onSubmit={submitCategory}>
          <label style={labelStyle}>Tên nhóm</label>
          <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} style={inputStyle} placeholder="Ví dụ: Spa & Massage" />
          {errorMessage ? <p style={{ color: "#b91c1c", marginTop: 12 }}>{errorMessage}</p> : null}
          <FormFooter submitting={submitting} onClose={() => setCategoryModalOpen(false)} />
        </form>
      </Modal>

      <Modal
        open={serviceModalOpen}
        title={editingService ? "Cập nhật dịch vụ" : "Tạo dịch vụ"}
        onClose={() => {
          setServiceModalOpen(false);
          resetServiceForm();
        }}
      >
        <form onSubmit={submitService}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Tên dịch vụ</label>
              <input
                value={serviceForm.name}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, name: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Nhóm dịch vụ</label>
              <select
                value={serviceForm.categoryId}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                style={inputStyle}
              >
                <option value="">Chưa gán nhóm</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Giá</label>
              <input
                type="number"
                min="0"
                value={serviceForm.price}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Đơn vị</label>
              <input
                value={serviceForm.unit}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, unit: e.target.value }))}
                style={inputStyle}
                placeholder="Suất, lượt, kg..."
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Mô tả</label>
              <textarea
                value={serviceForm.description}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
                style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Ảnh dịch vụ</label>
              <input
                value={serviceForm.imageUrl}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                style={inputStyle}
                placeholder="https://..."
              />
            </div>
          </div>
          {errorMessage ? <p style={{ color: "#b91c1c", marginTop: 12 }}>{errorMessage}</p> : null}
          <FormFooter submitting={submitting} onClose={() => setServiceModalOpen(false)} />
        </form>
      </Modal>
    </>
  );
}

function primaryButton(soft) {
  return {
    padding: "10px 18px",
    borderRadius: 12,
    border: soft ? "1px solid #d8dfd7" : "none",
    background: soft ? "white" : "#4f645b",
    color: soft ? "#1c1917" : "#e7fef3",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: soft ? "0 1px 3px rgba(0,0,0,.06)" : "0 8px 18px rgba(79,100,91,.18)",
  };
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div
      style={{
        padding: "18px 20px",
        borderBottom: "1px solid #f1f0ea",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background: "rgba(79,100,91,.12)",
          color: "#4f645b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <div style={{ fontWeight: 700, color: "#1c1917" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#78716c", marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function EmptyState({ label, icon }) {
  return (
    <div style={{ textAlign: "center", color: "#9ca3af" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 42 }}>{icon}</span>
      <p style={{ margin: "10px 0 0", fontWeight: 500 }}>{label}</p>
    </div>
  );
}

function StatusChip({ active, label }) {
  return (
    <span
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        background: active ? "#ecfdf5" : "#f5f5f4",
        color: active ? "#047857" : "#78716c",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: ".06em",
      }}
    >
      {label || (active ? "Hoạt động" : "Đã ẩn")}
    </span>
  );
}

function IconButton({ icon, title, onClick, danger = false }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        border: "1px solid #ece7de",
        background: danger ? "#fff7f7" : "white",
        color: danger ? "#dc2626" : "#57534e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
    </button>
  );
}

function rowCardStyle(active) {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    border: "1px solid #f1ede7",
    background: active ? "#fffdfa" : "#f8fafc",
    gap: 12,
  };
}

function FormFooter({ submitting, onClose }) {
  return (
    <div
      style={{
        marginTop: 20,
        display: "flex",
        justifyContent: "flex-end",
        gap: 12,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          padding: "10px 16px",
          borderRadius: 12,
          border: "1px solid #e7e5e4",
          background: "white",
          color: "#57534e",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Đóng
      </button>
      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "10px 18px",
          borderRadius: 12,
          border: "none",
          background: "#4f645b",
          color: "#e7fef3",
          fontWeight: 700,
          cursor: "pointer",
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </div>
  );
}
