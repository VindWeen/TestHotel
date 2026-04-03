import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createService,
  deleteService,
  getServiceCategories,
  getServices,
  toggleService,
  updateService,
} from "../../api/servicesApi";
import { formatCurrency } from "../../utils";
import {
  EmptyState,
  FormFooter,
  IconButton,
  Modal,
  ServiceAdminShell,
  ServicePagination,
  SERVICE_VIEW_STORAGE_KEY,
  StatusChip,
  ServiceToastContainer,
  VisibilitySwitch,
  inputStyle,
  labelStyle,
  panelStyle,
  primaryButton,
  statusFilterOptions,
} from "./ServiceAdminShared";

export default function ServiceItemsPage() {
  const [serviceRows, setServiceRows] = useState([]);
  const [categoryRows, setCategoryRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceKeyword, setServiceKeyword] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
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
  const [togglingIds, setTogglingIds] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize,
    totalItems: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState({
    totalItems: 0,
    activeItems: 0,
    inactiveItems: 0,
    usedCategories: 0,
  });

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ msg, type = "success", dur = 4000 }) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, msg, type, dur }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, dur);
    },
    [dismissToast],
  );

  useEffect(() => {
    sessionStorage.setItem(SERVICE_VIEW_STORAGE_KEY, "items");
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const serviceParams = {
        page,
        pageSize,
        keyword: serviceKeyword,
        categoryId: selectedCategoryId || null,
      };

      if (statusFilter === "all") {
        serviceParams.includeInactive = true;
      } else if (statusFilter === "inactive") {
        serviceParams.includeInactive = true;
        serviceParams.isActive = false;
      } else {
        serviceParams.includeInactive = false;
      }

      const [serviceRes, categoryRes] = await Promise.all([
        getServices(serviceParams),
        getServiceCategories({
          page: 1,
          pageSize: 100,
          includeInactive: true,
        }),
      ]);

      setServiceRows(serviceRes.data?.data || []);
      setPagination(
        serviceRes.data?.pagination || {
          currentPage: 1,
          pageSize,
          totalItems: 0,
          totalPages: 1,
        },
      );
      setSummary(
        serviceRes.data?.summary || {
          totalItems: 0,
          activeItems: 0,
          inactiveItems: 0,
          usedCategories: 0,
        },
      );
      setCategoryRows(categoryRes.data?.data || []);
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || "Không thể tải dữ liệu dịch vụ.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, selectedCategoryId, serviceKeyword, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [serviceKeyword, selectedCategoryId, statusFilter]);

  useEffect(() => {
    const maxPage = Math.max(1, pagination.totalPages || 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, pagination.totalPages]);

  const activeCategories = useMemo(
    () => categoryRows.filter((item) => item.isActive),
    [categoryRows],
  );

  const stats = useMemo(
    () => [
      {
        label: "Tổng dịch vụ",
        value: summary.totalItems || 0,
        description: "Số dịch vụ theo bộ lọc hiện tại",
        icon: "room_service",
      },
      {
        label: "Đang hiển thị",
        value: summary.activeItems || 0,
        description: "Dịch vụ đang mở bán",
        icon: "visibility",
      },
      {
        label: "Nhóm đang dùng",
        value: summary.usedCategories || 0,
        description: "Số nhóm có ít nhất một dịch vụ",
        icon: "category",
      },
    ],
    [summary],
  );

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
      setErrorMessage(
        error?.response?.data?.message || "Không thể lưu dịch vụ.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, serviceName) => {
    if (!window.confirm(`Xóa mềm dịch vụ "${serviceName}"?`)) return;
    try {
      await deleteService(id);
      await loadData();
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || "Không thể xóa mềm dịch vụ.",
      );
    }
  };

  const handleToggle = async (id) => {
    const targetService = serviceRows.find((item) => item.id === id);
    setTogglingIds((prev) => [...prev, id]);
    try {
      await toggleService(id);
      pushToast({
        msg: `${targetService?.name || "Dịch vụ"} đã được ${
          targetService?.isActive ? "ẩn" : "hiện"
        }.`,
        type: targetService?.isActive ? "warning" : "success",
      });
      await loadData();
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || "Không thể cập nhật trạng thái dịch vụ.",
      );
      pushToast({
        msg:
          error?.response?.data?.message ||
          `Không thể cập nhật hiển thị cho ${targetService?.name || "dịch vụ"}.`,
        type: "error",
      });
    } finally {
      setTogglingIds((prev) => prev.filter((item) => item !== id));
    }
  };

  return (
    <>
      <ServiceToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
      />
      <ServiceAdminShell
        view="items"
        title="Quản lý dịch vụ"
        subtitle="Tập trung thao tác trên danh mục dịch vụ với route và bộ lọc rõ ràng hơn."
        stats={stats}
        primaryAction={
          <button onClick={() => openServiceModal()} style={primaryButton(false)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              room_service
            </span>
            Thêm dịch vụ
          </button>
        }
        filterContent={
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.25fr 1fr 0.85fr",
              gap: 16,
              alignItems: "end",
            }}
          >
            <div>
              <label style={labelStyle}>Tìm dịch vụ</label>
              <input
                value={serviceKeyword}
                onChange={(e) => setServiceKeyword(e.target.value)}
                style={inputStyle}
                placeholder="Buffet, giặt ủi, đưa đón..."
              />
            </div>
            <div>
              <label style={labelStyle}>Lọc theo nhóm</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Tất cả nhóm</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Trạng thái hiển thị</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={inputStyle}
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      >
        {errorMessage ? (
          <div
            style={{
              ...panelStyle,
              marginBottom: 20,
              padding: 16,
              color: "#b91c1c",
              background: "#fff7f7",
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <section style={{ ...panelStyle, overflow: "hidden" }}>
          <div
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid #f1f0ea",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: "#1c1917" }}>Danh sách dịch vụ</div>
              <div style={{ fontSize: 12, color: "#78716c", marginTop: 2 }}>
                {pagination.totalItems || 0} dịch vụ theo bộ lọc hiện tại
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    background: "#faf8f3",
                    borderBottom: "1px solid #f1f0ea",
                  }}
                >
                  {[
                    "Dịch vụ",
                    "Nhóm",
                    "Giá",
                    "Đơn vị",
                    "Trạng thái",
                    "Ẩn / Hiện",
                    "Thao tác",
                  ].map((heading, idx) => (
                    <th
                      key={heading}
                      style={{
                        padding: "16px 18px",
                        textAlign: idx === 6 ? "right" : "left",
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
                    <td colSpan={7} style={{ padding: 48 }}>
                      <EmptyState label="Đang tải dịch vụ..." icon="hourglass_top" />
                    </td>
                  </tr>
                ) : serviceRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 48 }}>
                      <EmptyState
                        label="Chưa có dịch vụ phù hợp bộ lọc."
                        icon="search_off"
                      />
                    </td>
                  </tr>
                ) : (
                  serviceRows.map((service) => (
                    <tr key={service.id} style={{ borderBottom: "1px solid #f7f4ee" }}>
                      <td style={{ padding: "16px 18px" }}>
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              color: "#1c1917",
                              fontSize: 14,
                            }}
                          >
                            {service.name}
                          </div>
                          <div
                            style={{
                              color: "#78716c",
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            {service.description || "Chưa có mô tả"}
                          </div>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "16px 18px",
                          color: "#57534e",
                          fontSize: 14,
                        }}
                      >
                        {service.categoryName || "Chưa gán nhóm"}
                      </td>
                      <td
                        style={{
                          padding: "16px 18px",
                          color: "#1f2937",
                          fontWeight: 700,
                        }}
                      >
                        {formatCurrency(service.price)}
                      </td>
                      <td style={{ padding: "16px 18px", color: "#57534e" }}>
                        {service.unit || "—"}
                      </td>
                      <td style={{ padding: "16px 18px" }}>
                        <StatusChip
                          active={service.isActive}
                          label={service.isActive ? "Đang bán" : "Đã ẩn"}
                        />
                      </td>
                      <td style={{ padding: "16px 18px" }}>
                        <VisibilitySwitch
                          checked={service.isActive}
                          disabled={togglingIds.includes(service.id)}
                          onChange={() => handleToggle(service.id)}
                        />
                      </td>
                      <td style={{ padding: "16px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <IconButton
                            icon="edit"
                            title="Sửa"
                            onClick={() => openServiceModal(service)}
                          />
                          <IconButton
                            icon="delete"
                            title="Xóa mềm"
                            danger
                            onClick={() => handleDelete(service.id, service.name)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ServicePagination
            page={page}
            pageSize={pageSize}
            totalItems={pagination.totalItems || 0}
            totalPages={Math.max(1, pagination.totalPages || 1)}
            onPageChange={setPage}
          />
        </section>
      </ServiceAdminShell>

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
                onChange={(e) =>
                  setServiceForm((prev) => ({ ...prev, name: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Nhóm dịch vụ</label>
              <select
                value={serviceForm.categoryId}
                onChange={(e) =>
                  setServiceForm((prev) => ({
                    ...prev,
                    categoryId: e.target.value,
                  }))
                }
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
                onChange={(e) =>
                  setServiceForm((prev) => ({ ...prev, price: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Đơn vị</label>
              <input
                value={serviceForm.unit}
                onChange={(e) =>
                  setServiceForm((prev) => ({ ...prev, unit: e.target.value }))
                }
                style={inputStyle}
                placeholder="Suất, lượt, kg..."
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Mô tả</label>
              <textarea
                value={serviceForm.description}
                onChange={(e) =>
                  setServiceForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Ảnh dịch vụ</label>
              <input
                value={serviceForm.imageUrl}
                onChange={(e) =>
                  setServiceForm((prev) => ({
                    ...prev,
                    imageUrl: e.target.value,
                  }))
                }
                style={inputStyle}
                placeholder="https://..."
              />
            </div>
          </div>
          {errorMessage ? (
            <p style={{ color: "#b91c1c", marginTop: 12 }}>{errorMessage}</p>
          ) : null}
          <FormFooter
            submitting={submitting}
            onClose={() => setServiceModalOpen(false)}
          />
        </form>
      </Modal>
    </>
  );
}
