import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createServiceCategory,
  deleteServiceCategory,
  getServiceCategories,
  toggleServiceCategory,
  updateServiceCategory,
} from "../../api/servicesApi";
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

export default function ServiceCategoryPage() {
  const [categoryRows, setCategoryRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState("");
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
    withServices: 0,
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
    sessionStorage.setItem(SERVICE_VIEW_STORAGE_KEY, "categories");
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const categoryParams = {
        page,
        pageSize,
        keyword,
      };

      if (statusFilter === "all") {
        categoryParams.includeInactive = true;
      } else if (statusFilter === "inactive") {
        categoryParams.includeInactive = true;
        categoryParams.isActive = false;
      } else {
        categoryParams.includeInactive = false;
      }

      const response = await getServiceCategories(categoryParams);

      setCategoryRows(response.data?.data || []);
      setPagination(
        response.data?.pagination || {
          currentPage: 1,
          pageSize,
          totalItems: 0,
          totalPages: 1,
        },
      );
      setSummary(
        response.data?.summary || {
          totalItems: 0,
          activeItems: 0,
          inactiveItems: 0,
          withServices: 0,
        },
      );
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || "Không thể tải nhóm dịch vụ.",
      );
    } finally {
      setLoading(false);
    }
  }, [keyword, page, pageSize, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [keyword, statusFilter]);

  useEffect(() => {
    const maxPage = Math.max(1, pagination.totalPages || 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, pagination.totalPages]);

  const stats = useMemo(
    () => [
      {
        label: "Tổng nhóm",
        value: summary.totalItems || 0,
        description: "Số nhóm theo bộ lọc hiện tại",
        icon: "category",
      },
      {
        label: "Nhóm hiển thị",
        value: summary.activeItems || 0,
        description: "Nhóm đang dùng cho biểu mẫu dịch vụ",
        icon: "visibility",
      },
      {
        label: "Có dịch vụ",
        value: summary.withServices || 0,
        description: "Nhóm đã có ít nhất một dịch vụ",
        icon: "dataset",
      },
    ],
    [summary],
  );

  const resetForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setErrorMessage("");
  };

  const openModal = (category = null) => {
    setEditingCategory(category);
    setCategoryName(category?.name || "");
    setErrorMessage("");
    setModalOpen(true);
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
      setModalOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || "Không thể lưu nhóm dịch vụ.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`Xóa mềm nhóm "${category.name}"?`)) return;
    try {
      await deleteServiceCategory(category.id);
      await loadData();
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || "Không thể xóa mềm nhóm dịch vụ.",
      );
    }
  };

  const handleToggle = async (id) => {
    const targetCategory = categoryRows.find((item) => item.id === id);
    setTogglingIds((prev) => [...prev, id]);
    try {
      await toggleServiceCategory(id);
      pushToast({
        msg: `${targetCategory?.name || "Nhóm dịch vụ"} đã được ${
          targetCategory?.isActive ? "ẩn" : "hiện"
        }.`,
        type: targetCategory?.isActive ? "warning" : "success",
      });
      await loadData();
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || "Không thể cập nhật trạng thái nhóm.",
      );
      pushToast({
        msg:
          error?.response?.data?.message ||
          `Không thể cập nhật hiển thị cho ${targetCategory?.name || "nhóm dịch vụ"}.`,
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
        view="categories"
        title="Quản lý nhóm dịch vụ"
        subtitle="Tách riêng màn nhóm để giảm rối và tập trung vào cấu trúc danh mục."
        stats={stats}
        primaryAction={
          <button onClick={() => openModal()} style={primaryButton(false)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              category
            </span>
            Thêm nhóm
          </button>
        }
        filterContent={
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 0.85fr",
              gap: 16,
              alignItems: "end",
            }}
          >
            <div>
              <label style={labelStyle}>Tìm nhóm dịch vụ</label>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={inputStyle}
                placeholder="Nhà hàng, Spa, Đưa đón..."
              />
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
              <div style={{ fontWeight: 700, color: "#1c1917" }}>
                Danh sách nhóm dịch vụ
              </div>
              <div style={{ fontSize: 12, color: "#78716c", marginTop: 2 }}>
                {pagination.totalItems || 0} nhóm theo bộ lọc hiện tại
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
                    "Nhóm",
                    "Số dịch vụ",
                    "Trạng thái",
                    "Ẩn / Hiện",
                    "Thao tác",
                  ].map((heading, idx) => (
                    <th
                      key={heading}
                      style={{
                        padding: "16px 18px",
                        textAlign: idx === 4 ? "right" : "left",
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
                    <td colSpan={5} style={{ padding: 48 }}>
                      <EmptyState
                        label="Đang tải nhóm dịch vụ..."
                        icon="hourglass_top"
                      />
                    </td>
                  </tr>
                ) : categoryRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 48 }}>
                      <EmptyState
                        label="Chưa có nhóm dịch vụ phù hợp bộ lọc."
                        icon="search_off"
                      />
                    </td>
                  </tr>
                ) : (
                  categoryRows.map((category) => (
                    <tr key={category.id} style={{ borderBottom: "1px solid #f7f4ee" }}>
                      <td style={{ padding: "16px 18px" }}>
                        <div style={{ fontWeight: 700, color: "#1c1917" }}>
                          {category.name}
                        </div>
                      </td>
                      <td style={{ padding: "16px 18px", color: "#57534e" }}>
                        {category.serviceCount ?? 0}
                      </td>
                      <td style={{ padding: "16px 18px" }}>
                        <StatusChip active={category.isActive} />
                      </td>
                      <td style={{ padding: "16px 18px" }}>
                        <VisibilitySwitch
                          checked={category.isActive}
                          disabled={togglingIds.includes(category.id)}
                          onChange={() => handleToggle(category.id)}
                        />
                      </td>
                      <td style={{ padding: "16px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <IconButton
                            icon="edit"
                            title="Sửa"
                            onClick={() => openModal(category)}
                          />
                          <IconButton
                            icon="delete"
                            title="Xóa mềm"
                            danger
                            onClick={() => handleDelete(category)}
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
        open={modalOpen}
        title={editingCategory ? "Cập nhật nhóm dịch vụ" : "Tạo nhóm dịch vụ"}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
      >
        <form onSubmit={submitCategory}>
          <label style={labelStyle}>Tên nhóm</label>
          <input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            style={inputStyle}
            placeholder="Ví dụ: Spa & Massage"
          />
          {errorMessage ? (
            <p style={{ color: "#b91c1c", marginTop: 12 }}>{errorMessage}</p>
          ) : null}
          <FormFooter
            submitting={submitting}
            onClose={() => setModalOpen(false)}
          />
        </form>
      </Modal>
    </>
  );
}
