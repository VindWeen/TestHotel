import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addInvoiceAdjustment, finalizeInvoice, getInvoiceDetail, removeInvoiceAdjustment } from "../../api/invoicesApi";
import { recordPayment } from "../../api/paymentsApi";
import { formatCurrency, formatDate } from "../../utils";

// ─── Thông báo ────────────────────────────────────────────────────────────────────
const TOAST_STYLES = {
  success: { bg: "#1e3a2f", border: "#2d5a45", text: "#a7f3d0", prog: "#34d399", icon: "check_circle" },
  error:   { bg: "#3a1e1e", border: "#5a2d2d", text: "#fca5a5", prog: "#f87171", icon: "error" },
  warning: { bg: "#3a2e1a", border: "#5a4820", text: "#fcd34d", prog: "#fbbf24", icon: "warning" },
  info:    { bg: "#1e2f3a", border: "#2d4a5a", text: "#93c5fd", prog: "#60a5fa", icon: "info" },
};

function Toast({ id, msg, type = "success", dur = 3500, onDismiss }) {
  const s = TOAST_STYLES[type] || TOAST_STYLES.info;
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), dur);
    return () => clearTimeout(t);
  }, [id, dur, onDismiss]);
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,.35)", pointerEvents: "auto", marginBottom: 10, minWidth: 280, animation: "toastIn .32s cubic-bezier(.22,1,.36,1) forwards" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 12px 8px" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, flexShrink: 0, marginTop: 1, fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
        <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, margin: 0, flex: 1 }}>{msg}</p>
        <button onClick={() => onDismiss(id)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, color: "inherit", padding: 2 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
        </button>
      </div>
      <div style={{ margin: "0 12px 8px", height: 3, borderRadius: 9999, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
        <div style={{ height: "100%", background: s.prog, animation: `toastProgress ${dur}ms linear forwards` }} />
      </div>
    </div>
  );
}

// ─── Nhãn trạng thái ─────────────────────────────────────────────────────────────
const InvoiceStatusBadge = ({ status }) => {
  const map = {
    Draft: { bg: "#e0f2fe", text: "#0369a1", icon: "draft" },
    Ready_To_Collect: { bg: "#ede9fe", text: "#6d28d9", icon: "point_of_sale" },
    Unpaid: { bg: "#fef2f2", text: "#dc2626", icon: "pending_actions" },
    Partially_Paid: { bg: "#fef3c7", text: "#d97706", icon: "hourglass_half" },
    Paid: { bg: "#ecfdf5", text: "#059669", icon: "check_circle" },
    Refunded: { bg: "#f3f4f6", text: "#6b7280", icon: "replay" }
  };
  const s = map[status] || { bg: "#f1f5f9", text: "#64748b", icon: "help" };
  return (
    <span className="badge-p" style={{ background: s.bg, color: s.text }}>
      <span className="material-symbols-outlined" style={{ fontSize: 13, fontWeight: 700 }}>{s.icon}</span>
      {status}
    </span>
  );
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [form, setForm] = useState({
    amountPaid: "",
    paymentType: "Final_Settlement",
    paymentMethod: "Cash",
    transactionCode: "",
    note: "",
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    adjustmentType: "Surcharge",
    amount: "",
    reason: "",
    note: "",
  });

  const showToast = useCallback((msg, type = "success") => {
    const toastId = Date.now() + Math.random();
    setToasts((p) => [...p, { id: toastId, msg, type }]);
  }, []);
  const dismissToast = useCallback((toastId) => {
    setToasts((p) => p.filter((t) => t.id !== toastId));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInvoiceDetail(id);
      setInvoice(res.data?.data || null);
    } catch (e) {
      showToast(e?.response?.data?.message || "Không thể tải chi tiết hóa đơn.", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const outstanding = useMemo(() => invoice?.outstandingAmount || 0, [invoice]);

  const submitPayment = async (e) => {
    e.preventDefault();
    if (Number(form.amountPaid) <= 0) {
      showToast("Vui lòng nhập số tiền hợp lệ", "error");
      return;
    }
    try {
      await recordPayment({
        invoiceId: Number(id),
        paymentType: form.paymentType,
        paymentMethod: form.paymentMethod,
        amountPaid: Number(form.amountPaid),
        transactionCode: form.transactionCode || null,
        note: form.note || null,
      });
      setForm((s) => ({ ...s, amountPaid: "", transactionCode: "", note: "" }));
      showToast("Đã lưu thanh toán thành công.", "success");
      await load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Không thể ghi nhận thanh toán.", "error");
    }
  };

  const runFinalize = async () => {
    try {
      await finalizeInvoice(id);
      showToast("Đã chốt hóa đơn thành công.", "success");
      await load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Không thể chốt hóa đơn.", "error");
    }
  };

  const submitAdjustment = async (e) => {
    e.preventDefault();
    if (Number(adjustmentForm.amount) <= 0 || !adjustmentForm.reason.trim()) {
      showToast("Vui lòng nhập số tiền và lý do điều chỉnh hợp lệ.", "error");
      return;
    }

    try {
      await addInvoiceAdjustment(id, {
        adjustmentType: adjustmentForm.adjustmentType,
        amount: Number(adjustmentForm.amount),
        reason: adjustmentForm.reason,
        note: adjustmentForm.note || null,
      });
      setAdjustmentForm({
        adjustmentType: "Surcharge",
        amount: "",
        reason: "",
        note: "",
      });
      showToast("Đã cập nhật điều chỉnh hóa đơn.", "success");
      await load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Không thể thêm điều chỉnh hóa đơn.", "error");
    }
  };

  const handleRemoveAdjustment = async (adjustmentId) => {
    try {
      await removeInvoiceAdjustment(id, adjustmentId);
      showToast("Đã xóa điều chỉnh hóa đơn.", "success");
      await load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Không thể xóa điều chỉnh hóa đơn.", "error");
    }
  };

  const printInvoiceDocument = (mode = "final") => {
    if (!invoice) return;

    const title = mode === "draft" ? `BAN NHAP HOA DON #${invoice.id}` : `HOA DON THANH TOAN #${invoice.id}`;
    const adjustmentRows = (invoice.adjustments || []).map((item) => `
      <tr>
        <td>${item.adjustmentType === "Discount" ? "Giam tru" : "Phu phi"}</td>
        <td>${item.reason || "-"}</td>
        <td style="text-align:right;">${item.adjustmentType === "Discount" ? "-" : "+"}${formatCurrency(item.amount)}</td>
      </tr>
    `).join("");

    const paymentRows = (invoice.payments || []).map((item) => `
      <tr>
        <td>${formatDate(item.paymentDate || "")}</td>
        <td>${item.paymentType || "-"}</td>
        <td>${item.paymentMethod || "-"}</td>
        <td style="text-align:right;">${formatCurrency(item.amountPaid || 0)}</td>
      </tr>
    `).join("");

    const detailRows = (invoice.bookingDetails || []).map((item) => `
      <tr>
        <td>${item.roomNumber || "-"}</td>
        <td>${item.roomTypeName || "-"}</td>
        <td>${formatDate(item.checkInDate).split(" ")[0]}</td>
        <td>${formatDate(item.checkOutDate).split(" ")[0]}</td>
        <td style="text-align:right;">${formatCurrency(item.pricePerNight || 0)}</td>
      </tr>
    `).join("");

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      showToast("Trình duyệt đang chặn cửa sổ in.", "warning");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 32px; }
            h1, h2, h3, p { margin: 0; }
            .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 24px; }
            .badge { display:inline-block; padding:6px 12px; border-radius:999px; background:#f3f4f6; font-size:12px; font-weight:700; }
            .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
            .card { border:1px solid #e5e7eb; border-radius:16px; padding:16px; }
            .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; color:#6b7280; margin-bottom: 12px; }
            table { width:100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border-bottom:1px solid #e5e7eb; padding:10px 8px; text-align:left; font-size:13px; }
            th { color:#6b7280; font-size:12px; text-transform:uppercase; }
            .summary-row { display:flex; justify-content:space-between; margin-bottom:10px; font-size:14px; }
            .summary-total { font-size:18px; font-weight:800; margin-top:12px; padding-top:12px; border-top:2px solid #111827; }
            .muted { color:#6b7280; }
            .watermark { color:#b91c1c; font-weight:800; letter-spacing: 0.2em; }
            @media print { body { padding: 16px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="font-size:28px; margin-bottom:6px;">${mode === "draft" ? "BẢN NHÁP HÓA ĐƠN" : "HÓA ĐƠN THANH TOÁN"}</h1>
              <p class="muted">Mã hóa đơn: #${invoice.id}</p>
              <p class="muted">Booking: ${invoice.bookingCode || invoice.bookingId || "-"}</p>
            </div>
            <div style="text-align:right;">
              ${mode === "draft" ? '<div class="watermark">DRAFT</div>' : '<div class="badge">ĐÃ CHỐT</div>'}
              <p class="muted" style="margin-top:8px;">Ngày in: ${formatDate(new Date())}</p>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="section-title">Thông tin khách</div>
              <p><strong>${invoice.booking?.guestName || "-"}</strong></p>
              <p class="muted">SĐT: ${invoice.booking?.guestPhone || "-"}</p>
              <p class="muted">Email: ${invoice.booking?.guestEmail || "-"}</p>
            </div>
            <div class="card">
              <div class="section-title">Trạng thái</div>
              <p><strong>${invoice.status || "-"}</strong></p>
              <p class="muted">Ngày tạo: ${formatDate(invoice.createdAt)}</p>
            </div>
          </div>

          <div class="card" style="margin-bottom: 24px;">
            <div class="section-title">Chi tiết lưu trú</div>
            <table>
              <thead>
                <tr>
                  <th>Phòng</th>
                  <th>Hạng phòng</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th style="text-align:right;">Giá/đêm</th>
                </tr>
              </thead>
              <tbody>
                ${detailRows || '<tr><td colspan="5">Không có dữ liệu</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="grid">
            <div class="card">
              <div class="section-title">Điều chỉnh hóa đơn</div>
              <table>
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Lý do</th>
                    <th style="text-align:right;">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${adjustmentRows || '<tr><td colspan="3">Không có điều chỉnh</td></tr>'}
                </tbody>
              </table>
            </div>
            <div class="card">
              <div class="section-title">Tổng hợp thanh toán</div>
              <div class="summary-row"><span>Tiền phòng</span><strong>${formatCurrency(invoice.totalRoomAmount || 0)}</strong></div>
              <div class="summary-row"><span>Tiền dịch vụ</span><strong>${formatCurrency(invoice.totalServiceAmount || 0)}</strong></div>
              <div class="summary-row"><span>Bồi thường</span><strong>${formatCurrency(invoice.totalDamageAmount || 0)}</strong></div>
              <div class="summary-row"><span>Phụ phí</span><strong>${formatCurrency(invoice.adjustmentAmount || 0)}</strong></div>
              <div class="summary-row"><span>Chiết khấu voucher</span><strong>- ${formatCurrency(invoice.discountAmount || 0)}</strong></div>
              <div class="summary-row"><span>Giảm trừ thủ công</span><strong>- ${formatCurrency(invoice.manualDiscountAmount || 0)}</strong></div>
              <div class="summary-row"><span>Thuế</span><strong>${formatCurrency(invoice.taxAmount || 0)}</strong></div>
              <div class="summary-row"><span>Đã thanh toán</span><strong>${formatCurrency(invoice.paidAmount || 0)}</strong></div>
              <div class="summary-row"><span>Tiền cọc</span><strong>${formatCurrency(invoice.depositAmount || 0)}</strong></div>
              <div class="summary-row summary-total"><span>Tổng cần thu</span><span>${formatCurrency(invoice.finalTotal || 0)}</span></div>
              <div class="summary-row" style="margin-top:12px;"><span>Còn lại</span><strong>${formatCurrency(invoice.outstandingAmount || 0)}</strong></div>
            </div>
          </div>

          <div class="card" style="margin-top: 24px;">
            <div class="section-title">Lịch sử thanh toán</div>
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Loại</th>
                  <th>Phương thức</th>
                  <th style="text-align:right;">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                ${paymentRows || '<tr><td colspan="4">Chưa có thanh toán</td></tr>'}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 200);
  };

  const inputStyle = { border: "1.5px solid #e2e8e1", background: "#f9f8f3", padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#1c1917", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "Manrope, sans-serif" };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingBottom: 40 }}>
      <style>{`        * { font-family: 'Manrope', sans-serif; }        @keyframes toastIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes toastProgress { from{width:100%} to{width:0} }
        .table-row { transition: background 0.1s; border-bottom: 1px solid #f1f0ea; }
        .table-row:hover { background: #fafaf8 !important; }
        .badge-p { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
        .action-btn { display: inline-flex; alignItems: center; gap: 8px; padding: 10px 22px; borderRadius: 12px; font-size: 14px; font-weight: 700; background: white; color: #1c1917; border: 1.5px solid #e2e8e1; cursor: pointer; transition: all 0.15s; justify-content: center; }
        .action-btn:hover:not(:disabled) { border-color: #4f645b; color: #4f645b; background: #f0faf5; }
        .action-btn.primary { background: linear-gradient(135deg,#4f645b 0%,#43574f 100%); color: #e7fef3; border: none; }
        .action-btn.primary:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(79,100,91,0.25); }
        .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      {/* Khu vực thông báo */}
      <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, pointerEvents: "none", minWidth: 280 }}>
        {toasts.map((t) => <Toast key={t.id} {...t} onDismiss={dismissToast} />)}
      </div>

      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => navigate("/admin/invoices")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6b7280", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 12 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Quay lại danh sách
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.025em", margin: 0 }}>
            Chi tiết Hóa đơn
            {invoice && <span style={{ marginLeft: 12, color: "#9ca3af", fontWeight: 600, fontSize: 16 }}>#{invoice.id}</span>}
          </h2>
          {invoice && <InvoiceStatusBadge status={invoice.status} />}
        </div>
      </div>

      {!loading && invoice && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
          {/* Left Column: Form & Table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1c1917", margin: "0 0 16px" }}>Phụ phí / Điều chỉnh hóa đơn</h3>
              <form onSubmit={submitAdjustment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 160px", gap: 14 }}>
                  <select value={adjustmentForm.adjustmentType} onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, adjustmentType: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="Surcharge">Phụ phí</option>
                    <option value="Discount">Giảm trừ thủ công</option>
                  </select>
                  <input
                    placeholder="Lý do, ví dụ: Phụ thu nhận phòng sớm"
                    value={adjustmentForm.reason}
                    onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, reason: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Số tiền"
                    value={adjustmentForm.amount}
                    onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, amount: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "start" }}>
                  <textarea
                    placeholder="Ghi chú thêm (tùy chọn)"
                    value={adjustmentForm.note}
                    onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, note: e.target.value }))}
                    style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                  />
                  <button type="submit" className="action-btn primary" style={{ minWidth: 180 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>
                    Thêm điều chỉnh
                  </button>
                </div>
              </form>
            </div>
            
            {/* Payment Form */}
            {invoice.status !== "Paid" && (
              <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1c1917", margin: "0 0 16px" }}>Ghi nhận thanh toán</h3>
                {(invoice.status === "Draft" || invoice.status === "Ready_To_Collect") && (
                  <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, border: "1px solid #bae6fd", background: "#f0f9ff", color: "#075985", fontSize: 13, fontWeight: 700 }}>
                    {invoice.status === "Draft"
                      ? "Hóa đơn này đang ở trạng thái nháp. Bạn có thể chốt hóa đơn trước hoặc thu tiền trực tiếp để hệ thống tự cập nhật trạng thái."
                      : "Hóa đơn đã sẵn sàng để thu tiền. Bạn có thể ghi nhận thanh toán từng phần hoặc thanh toán đủ."}
                  </div>
                )}
                <form onSubmit={submitPayment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>Số tiền (Dư nợ: {formatCurrency(outstanding)})</label>
                      <input type="number" min="0" step="1000" placeholder="VD: 1000000" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} required style={inputStyle} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>Loại thanh toán</label>
                      <select value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"}>
                        <option value="Final_Settlement">Thanh toán chốt (Final)</option>
                        <option value="Deposit">Đặt cọc (Deposit)</option>
                        <option value="Refund">Hoàn tiền (Refund)</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>Phương thức</label>
                      <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"}>
                        <option value="Cash">Tiền mặt (Cash)</option>
                        <option value="Momo">Momo</option>
                        <option value="VNPay_Mock">VNPay (Mock)</option>
                        <option value="Credit Card">Thẻ tín dụng</option>
                        <option value="Bank Transfer">Chuyển khoản (Bank)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>Mã giao dịch</label>
                      <input placeholder="VD: VNP1234..." value={form.transactionCode} onChange={(e) => setForm({ ...form, transactionCode: e.target.value })} style={inputStyle} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"} />
                    </div>
                  </div>
                  <div>
                    <textarea placeholder="Ghi chú (Tùy chọn)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ ...inputStyle, minHeight: 80, resize: "none" }} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                    <button type="submit" className="action-btn primary" disabled={!form.amountPaid}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>payments</span> Lưu thanh toán
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Payments Table */}
            <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f0ea", background: "rgba(249,248,243,.6)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1c1917", margin: 0 }}>Danh sách điều chỉnh</h3>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "white" }}>
                    <th style={{ padding: "14px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea", textTransform: "uppercase", letterSpacing: ".05em" }}>Thời gian</th>
                    <th style={{ padding: "14px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea", textTransform: "uppercase", letterSpacing: ".05em" }}>Lý do</th>
                    <th style={{ padding: "14px 24px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea", textTransform: "uppercase", letterSpacing: ".05em" }}>Giá trị</th>
                    <th style={{ padding: "14px 24px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea", textTransform: "uppercase", letterSpacing: ".05em" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.adjustments || []).length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: "32px 24px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                        Chưa có phụ phí hoặc giảm trừ thủ công.
                      </td>
                    </tr>
                  )}
                  {(invoice.adjustments || []).map((item) => (
                    <tr key={item.id} className="table-row">
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>{formatDate(item.createdAt).split(" ")[0]}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{formatDate(item.createdAt).split(" ")[1]}</div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#1c1917" }}>{item.reason}</div>
                        <div style={{ fontSize: 12, color: item.adjustmentType === "Discount" ? "#b45309" : "#6b7280", marginTop: 4 }}>
                          {item.adjustmentType === "Discount" ? "Giảm trừ thủ công" : "Phụ phí"}
                          {item.note ? ` • ${item.note}` : ""}
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: item.adjustmentType === "Discount" ? "#d97706" : "#b91c1c" }}>
                          {item.adjustmentType === "Discount" ? "-" : "+"}{formatCurrency(item.amount)}
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <button type="button" className="action-btn" style={{ padding: "8px 12px", fontSize: 12 }} onClick={() => handleRemoveAdjustment(item.id)}>
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f0ea", background: "rgba(249,248,243,.6)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1c1917", margin: 0 }}>Lịch sử thanh toán</h3>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "white" }}>
                    <th style={{ padding: "14px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea", textTransform: "uppercase", letterSpacing: ".05em" }}>Thời gian</th>
                    <th style={{ padding: "14px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea", textTransform: "uppercase", letterSpacing: ".05em" }}>Loại / PT</th>
                    <th style={{ padding: "14px 24px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea", textTransform: "uppercase", letterSpacing: ".05em" }}>Số tiền</th>
                    <th style={{ padding: "14px 24px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea", textTransform: "uppercase", letterSpacing: ".05em" }}>Mã Giao Dịch</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.payments || []).length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: "40px 24px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                        Chưa có lịch sử giao dịch.
                      </td>
                    </tr>
                  )}
                  {(invoice.payments || []).map((p) => (
                    <tr key={p.id} className="table-row">
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>{formatDate(p.paymentDate).split(' ')[0]}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{formatDate(p.paymentDate).split(' ')[1]}</div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#1c1917" }}>{p.paymentType}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{p.paymentMethod}</div>
                      </td>
                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: p.paymentType === "Refund" ? "#dc2626" : "#16a34a" }}>
                          {formatCurrency(p.amountPaid)}
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px", textAlign: "center" }}>
                        <div style={{ fontSize: 13, color: "#6b7280", fontFamily: "monospace", letterSpacing: 0.5 }}>{p.transactionCode || "-"}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Invoice Summary */}
          <div>
            <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,.06)", position: "sticky", top: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Liên kết Booking</p>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1c1917", display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#4f645b" }}>link</span>
                  {invoice.bookingCode || invoice.bookingId || "-"}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                <button type="button" className="action-btn" style={{ padding: "12px 14px", fontSize: 13 }} onClick={() => printInvoiceDocument("draft")}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>draft</span>
                  In bản nháp
                </button>
                <button type="button" className="action-btn primary" style={{ padding: "12px 14px", fontSize: 13 }} onClick={() => printInvoiceDocument("final")}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span>
                  In hóa đơn
                </button>
              </div>

              <div style={{ height: 1, background: "#f1f0ea", margin: "20px 0" }} />
              
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
                  <span>Tiền phòng:</span>
                  <span style={{ fontWeight: 700, color: "#1c1917" }}>{formatCurrency(invoice.totalRoomAmount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
                  <span>Tiền dịch vụ:</span>
                  <span style={{ fontWeight: 700, color: "#1c1917" }}>{formatCurrency(invoice.totalServiceAmount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
                  <span>Bồi thường thiết bị:</span>
                  <span style={{ fontWeight: 700, color: "#1c1917" }}>{formatCurrency(invoice.totalDamageAmount)}</span>
                </div>
                {invoice.adjustmentAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#b91c1c" }}>
                    <span>Phụ phí thủ công:</span>
                    <span style={{ fontWeight: 700 }}>+{formatCurrency(invoice.adjustmentAmount)}</span>
                  </div>
                )}
                {invoice.discountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#16a34a" }}>
                    <span>Chiết khấu:</span>
                    <span style={{ fontWeight: 700 }}>-{formatCurrency(invoice.discountAmount)}</span>
                  </div>
                )}
                {invoice.manualDiscountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#d97706" }}>
                    <span>Giảm trừ thủ công:</span>
                    <span style={{ fontWeight: 700 }}>-{formatCurrency(invoice.manualDiscountAmount)}</span>
                  </div>
                )}
                {invoice.taxAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
                    <span>Thuế:</span>
                    <span style={{ fontWeight: 700, color: "#1c1917" }}>{formatCurrency(invoice.taxAmount)}</span>
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: "#f1f0ea", margin: "20px 0", borderStyle: "dashed" }} />

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: "#1c1917", marginBottom: 12 }}>
                <span>Tổng cộng:</span>
                <span>{formatCurrency(invoice.finalTotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#16a34a", fontWeight: 700, marginBottom: 16 }}>
                <span>Đã thanh toán:</span>
                <span>{formatCurrency(invoice.paidAmount)}</span>
              </div>
              {invoice.depositAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4f645b", fontWeight: 700, marginBottom: 16 }}>
                  <span>Tiền cọc booking:</span>
                  <span>{formatCurrency(invoice.depositAmount)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: invoice.outstandingAmount > 0 ? "#dc2626" : "#6b7280", padding: "12px 14px", background: invoice.outstandingAmount > 0 ? "#fef2f2" : "#f1f5f9", borderRadius: 12, border: `1px solid ${invoice.outstandingAmount > 0 ? "#fecaca" : "#e2e8f0"}` }}>
                <span>Dư nợ / Còn lại:</span>
                <span>{formatCurrency(invoice.outstandingAmount)}</span>
              </div>

              {invoice.status !== "Paid" && invoice.status !== "Refunded" && (
                <div style={{ marginTop: 24 }}>
                  <button className="action-btn" style={{ width: "100%", background: "#1c1917", color: "white", padding: "14px", border: "none", fontSize: 15 }} onClick={runFinalize}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>verified</span> Chốt Hóa Đơn
                  </button>
                  <div style={{ fontSize: 12, textAlign: "center", color: "#9ca3af", marginTop: 8 }}>
                    Chỉ chốt (Finalize) khi khách đã thanh toán đủ hoặc không còn phát sinh giao dịch.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




