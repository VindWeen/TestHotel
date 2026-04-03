import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createOrderService,
  deleteOrderService,
  getOrderServiceById,
  getOrderServices,
  toggleOrderService,
  updateOrderService,
  updateOrderServiceStatus,
} from "../../api/orderServicesApi";
import { getServices } from "../../api/servicesApi";
import { formatCurrency, formatDate } from "../../utils";

const cardStyle = {
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

const ghostButtonStyle = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #e7e5e4",
  background: "white",
  color: "#57534e",
  fontWeight: 600,
  cursor: "pointer",
};

const primaryButtonStyle = {
  padding: "10px 18px",
  borderRadius: 12,
  border: "none",
  background: "#4f645b",
  color: "#e7fef3",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #e7e5e4",
  background: "white",
  color: "#57534e",
  fontWeight: 600,
  cursor: "pointer",
};

const ORDER_STATUSES = ["Pending", "Delivered", "Cancelled"];

export default function OrderServicePage() {
  const [rows, setRows] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({
    bookingDetailId: "",
    note: "",
    items: [{ serviceId: "", quantity: 1, unitPriceOverride: "" }],
  });

  const activeServiceOptions = useMemo(
    () => serviceOptions.filter((service) => service.isActive),
    [serviceOptions],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [orderRes, serviceRes] = await Promise.all([
        getOrderServices({
          page: 1,
          pageSize: 200,
          keyword,
          status,
          includeInactive,
        }),
        getServices({ page: 1, pageSize: 200, includeInactive: false }),
      ]);
      setRows(orderRes.data?.data || []);
      setServiceOptions(serviceRes.data?.data || []);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể tải đơn dịch vụ.");
    } finally {
      setLoading(false);
    }
  }, [includeInactive, keyword, status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingItem(null);
    setForm({
      bookingDetailId: "",
      note: "",
      items: [{ serviceId: "", quantity: 1, unitPriceOverride: "" }],
    });
    setErrorMessage("");
    setModalOpen(true);
  };

  const openEditModal = async (item) => {
    try {
      const res = await getOrderServiceById(item.id, { includeInactive: true });
      const detail = res.data;
      setEditingItem(item);
      setForm({
        bookingDetailId: detail.bookingDetailId?.toString() || "",
        note: detail.note || "",
        items:
          detail.details?.map((line) => ({
            serviceId: line.serviceId?.toString() || "",
            quantity: line.quantity || 1,
            unitPriceOverride: line.unitPrice?.toString() || "",
          })) || [{ serviceId: "", quantity: 1, unitPriceOverride: "" }],
      });
      setErrorMessage("");
      setModalOpen(true);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể tải chi tiết đơn dịch vụ.");
    }
  };

  const openDetail = async (id) => {
    try {
      const res = await getOrderServiceById(id, { includeInactive: true });
      setDetailItem(res.data);
      setDetailOpen(true);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể tải chi tiết đơn dịch vụ.");
    }
  };

  const updateItemField = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { serviceId: "", quantity: 1, unitPriceOverride: "" }],
    }));
  };

  const removeLine = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    const payload = {
      bookingDetailId: Number(form.bookingDetailId),
      note: form.note || null,
      items: form.items.map((item) => ({
        serviceId: Number(item.serviceId),
        quantity: Number(item.quantity),
        unitPriceOverride:
          item.unitPriceOverride === "" ? null : Number(item.unitPriceOverride),
      })),
    };

    try {
      if (editingItem) {
        await updateOrderService(editingItem.id, {
          note: payload.note,
          items: payload.items,
        });
      } else {
        await createOrderService(payload);
      }
      setModalOpen(false);
      await loadData();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể lưu đơn dịch vụ.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (runner, id, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await runner(id);
      await loadData();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể cập nhật đơn dịch vụ.");
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
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 24, color: "#1c1917", fontWeight: 700 }}>
              Quản lý Đơn dịch vụ
            </h2>
            <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
              Theo dõi các đơn dịch vụ gắn với booking detail và thao tác ngay trong admin.
            </p>
          </div>
          <button onClick={openCreateModal} style={primaryButtonStyle}>
            Tạo đơn dịch vụ
          </button>
        </div>

        {errorMessage ? (
          <div style={{ ...cardStyle, padding: 14, marginBottom: 20, color: "#b91c1c", background: "#fff7f7" }}>
            {errorMessage}
          </div>
        ) : null}

        <section style={{ ...cardStyle, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr auto", gap: 16, alignItems: "end" }}>
            <div>
              <label style={labelStyle}>Tìm booking / khách / phòng</label>
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} style={inputStyle} placeholder="Booking code, khách, số phòng..." />
            </div>
            <div>
              <label style={labelStyle}>Trạng thái</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                <option value="">Tất cả</option>
                {ORDER_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#44403c", paddingBottom: 10 }}>
              <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
              Hiện cả đơn đã ẩn
            </label>
          </div>
        </section>

        <section style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f0ea" }}>
            <strong style={{ color: "#1c1917" }}>Danh sách đơn dịch vụ</strong>
            <p style={{ margin: "4px 0 0", color: "#78716c", fontSize: 13 }}>Tổng cộng {rows.length} đơn.</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#faf8f3", borderBottom: "1px solid #f1f0ea" }}>
                  {["Booking", "Khách / Phòng", "Ngày tạo", "Tổng tiền", "Trạng thái", "Hiển thị", "Thao tác"].map((heading, idx) => (
                    <th key={heading} style={{ padding: "16px 18px", textAlign: idx === 6 ? "right" : "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#78716c" }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: "center", color: "#9ca3af" }}>Đang tải dữ liệu...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: "center", color: "#9ca3af" }}>Chưa có đơn dịch vụ nào.</td></tr>
                ) : (
                  rows.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f7f4ee" }}>
                      <td style={{ padding: "16px 18px" }}>
                        <strong style={{ color: "#1c1917" }}>{item.bookingCode || `#${item.bookingId || "—"}`}</strong>
                        <div style={{ marginTop: 4, fontSize: 12, color: "#78716c" }}>Order #{item.id}</div>
                      </td>
                      <td style={{ padding: "16px 18px", color: "#57534e" }}>
                        <div>{item.guestName || "—"}</div>
                        <div style={{ fontSize: 12, color: "#78716c", marginTop: 4 }}>Phòng: {item.roomNumber || "—"}</div>
                      </td>
                      <td style={{ padding: "16px 18px", color: "#57534e" }}>{formatDate(item.orderDate)}</td>
                      <td style={{ padding: "16px 18px", fontWeight: 700, color: "#1f2937" }}>{formatCurrency(item.totalAmount)}</td>
                      <td style={{ padding: "16px 18px" }}>
                        <select
                          value={item.status || ""}
                          onChange={(e) => updateOrderServiceStatus(item.id, e.target.value).then(loadData)}
                          style={{ ...inputStyle, minWidth: 150 }}
                          disabled={!item.isActive}
                        >
                          {ORDER_STATUSES.map((orderStatus) => (
                            <option key={orderStatus} value={orderStatus}>{orderStatus}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "16px 18px" }}>
                        <span style={{ padding: "5px 10px", borderRadius: 999, background: item.isActive ? "#ecfdf5" : "#f5f5f4", color: item.isActive ? "#047857" : "#78716c", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                          {item.isActive ? "Đang dùng" : "Đã ẩn"}
                        </span>
                      </td>
                      <td style={{ padding: "16px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <ActionButton icon="visibility" onClick={() => openDetail(item.id)} />
                          <ActionButton icon="edit" onClick={() => openEditModal(item)} />
                          <ActionButton icon={item.isActive ? "visibility_off" : "visibility"} onClick={() => handleAction(toggleOrderService, item.id)} />
                          <ActionButton icon="delete" danger onClick={() => handleAction(deleteOrderService, item.id, `Xóa mềm đơn dịch vụ #${item.id}?`)} />
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

      {modalOpen ? (
        <Overlay onClose={() => setModalOpen(false)} title={editingItem ? "Cập nhật đơn dịch vụ" : "Tạo đơn dịch vụ"}>
          <form onSubmit={submitForm}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Booking Detail ID</label>
                <input type="number" value={form.bookingDetailId} onChange={(e) => setForm((prev) => ({ ...prev, bookingDetailId: e.target.value }))} style={inputStyle} disabled={Boolean(editingItem)} />
              </div>
              <div>
                <label style={labelStyle}>Ghi chú</label>
                <input value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} style={inputStyle} placeholder="Ghi chú giao dịch vụ" />
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <strong style={{ color: "#1c1917" }}>Dòng dịch vụ</strong>
                <button type="button" onClick={addLine} style={secondaryButtonStyle}>Thêm dòng</button>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {form.items.map((item, index) => (
                  <div key={`${index}-${item.serviceId}`} style={{ padding: 14, borderRadius: 14, border: "1px solid #f1ede7", background: "#fffdfa", display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.9fr auto", gap: 12, alignItems: "end" }}>
                    <div>
                      <label style={labelStyle}>Dịch vụ</label>
                      <select value={item.serviceId} onChange={(e) => updateItemField(index, "serviceId", e.target.value)} style={inputStyle}>
                        <option value="">Chọn dịch vụ</option>
                        {activeServiceOptions.map((service) => (
                          <option key={service.id} value={service.id}>{service.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Số lượng</label>
                      <input type="number" min="1" value={item.quantity} onChange={(e) => updateItemField(index, "quantity", e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Đơn giá override</label>
                      <input type="number" min="0" value={item.unitPriceOverride} onChange={(e) => updateItemField(index, "unitPriceOverride", e.target.value)} style={inputStyle} placeholder="Để trống = giá gốc" />
                    </div>
                    <button type="button" onClick={() => removeLine(index)} disabled={form.items.length === 1} style={{ ...secondaryButtonStyle, opacity: form.items.length === 1 ? 0.5 : 1 }}>
                      Xóa dòng
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {errorMessage ? <p style={{ color: "#b91c1c", marginTop: 12 }}>{errorMessage}</p> : null}
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button type="button" onClick={() => setModalOpen(false)} style={ghostButtonStyle}>Đóng</button>
              <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Đang lưu..." : "Lưu đơn"}
              </button>
            </div>
          </form>
        </Overlay>
      ) : null}

      {detailOpen && detailItem ? (
        <Overlay onClose={() => setDetailOpen(false)} title={`Chi tiết Order #${detailItem.id}`}>
          <div style={{ display: "grid", gap: 12 }}>
            <DetailGrid label="Booking" value={detailItem.bookingCode || `#${detailItem.bookingId || "—"}`} />
            <DetailGrid label="Khách" value={detailItem.guestName || "—"} />
            <DetailGrid label="Phòng" value={detailItem.roomNumber || "—"} />
            <DetailGrid label="Loại phòng" value={detailItem.roomTypeName || "—"} />
            <DetailGrid label="Ngày tạo" value={formatDate(detailItem.orderDate)} />
            <DetailGrid label="Trạng thái" value={detailItem.status || "—"} />
            <DetailGrid label="Tổng tiền" value={formatCurrency(detailItem.totalAmount)} />
            <div style={{ marginTop: 8 }}>
              <strong style={{ color: "#1c1917" }}>Dòng dịch vụ</strong>
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {(detailItem.details || []).map((line) => (
                  <div key={line.id} style={{ padding: 14, borderRadius: 14, border: "1px solid #f1ede7", background: "#fffdfa", display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#1c1917" }}>{line.serviceName || `#${line.serviceId}`}</div>
                      <div style={{ color: "#78716c", fontSize: 12, marginTop: 4 }}>
                        Số lượng: {line.quantity} · Đơn giá: {formatCurrency(line.unitPrice)}
                      </div>
                    </div>
                    <strong style={{ color: "#1f2937" }}>{formatCurrency(line.lineTotal)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Overlay>
      ) : null}
    </>
  );
}

function ActionButton({ icon, onClick, danger = false }) {
  return (
    <button
      type="button"
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

function Overlay({ onClose, title, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }} onClick={onClose}>
      <div style={{ width: "min(920px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: 24, border: "1px solid #ede7dd", boxShadow: "0 24px 60px rgba(28,25,23,.18)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid #f1f0ea", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 22, color: "#1c1917" }}>{title}</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78716c" }}>Thiết kế đồng bộ với nhóm trang admin hiện tại.</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function DetailGrid({ label, value }) {
  return (
    <div style={{ padding: 14, borderRadius: 14, border: "1px solid #f1ede7", background: "#fffdfa" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#78716c" }}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: 700, color: "#1c1917" }}>{value}</div>
    </div>
  );
}
