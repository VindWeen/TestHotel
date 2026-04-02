import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getInvoices } from "../../api/invoicesApi";
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

export default function InvoiceListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [status, setStatus] = useState("");

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
      const res = await getInvoices({ page: 1, pageSize: 200, status });
      setRows(res.data?.data || []);
    } catch (e) {
      showToast(e?.response?.data?.message || "Không thể tải danh sách hóa đơn.", "error");
    } finally {
      setLoading(false);
    }
  }, [status, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const finalTotal = rows.reduce((sum, x) => sum + (x.finalTotal || 0), 0);
    const outstanding = rows.reduce((sum, x) => sum + (x.outstandingAmount || 0), 0);
    return { finalTotal, outstanding };
  }, [rows]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <style>{`        * { font-family: 'Manrope', sans-serif; }        @keyframes toastIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes toastProgress { from{width:100%} to{width:0} }
        .table-row { transition: background 0.1s; border-bottom: 1px solid #f1f0ea; }
        .table-row:hover { background: #fafaf8 !important; }
        .btn-icon-p { width: 34px; height: 34px; border-radius: 9px; border: 1.5px solid #f1f0ea; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; color: #6b7280; }
        .btn-icon-p:hover { border-color: #4f645b; color: #4f645b; background: #f0faf5; }
        .badge-p { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
      `}</style>

      <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, pointerEvents: "none", minWidth: 280 }}>
        {toasts.map((t) => <Toast key={t.id} {...t} onDismiss={dismissToast} />)}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.025em", margin: "0 0 4px" }}>
            Quản lý Hóa đơn
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Quản lý tình trạng thanh toán và dư nợ
          </p>
        </div>
        <button
          onClick={load}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "white", color: "#1c1917", border: "1.5px solid #e2e8e1", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span> Làm mới
        </button>
      </div>

      {/* Dashboard Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        <div style={{ background: "white", border: "1.5px solid #f1f0ea", borderRadius: 16, padding: "20px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#9ca3af", margin: "0 0 8px" }}>TỔNG SỐ HÓA ĐƠN</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: "#1c1917", margin: 0 }}>{rows.length}</p>
        </div>
        <div style={{ background: "white", border: "1.5px solid #f1f0ea", borderRadius: 16, padding: "20px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#9ca3af", margin: "0 0 8px" }}>TỔNG (ĐÃ TÍNH TRONG BỘ LỌC)</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: "#16a34a", margin: 0 }}>{formatCurrency(totals.finalTotal)}</p>
        </div>
        <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 16, padding: "20px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#dc2626", margin: "0 0 8px", opacity: 0.8 }}>TỔNG DƯ NỢ CẦN THU</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: "#dc2626", margin: 0 }}>{formatCurrency(totals.outstanding)}</p>
        </div>
      </div>

      <div style={{ background: "white", borderRadius: 18, padding: "18px 22px", border: "1px solid #f1f0ea", boxShadow: "0 1px 4px rgba(0,0,0,.06)", display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ border: "1.5px solid #e2e8e1", background: "#f9f8f3", padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#1c1917", outline: "none", width: 200, fontFamily: "Manrope, sans-serif", cursor: "pointer" }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="Unpaid">Unpaid (Chưa thanh toán)</option>
          <option value="Partially_Paid">Partially Paid (TT một phần)</option>
          <option value="Paid">Paid (Đã thanh toán)</option>
          <option value="Refunded">Refunded (Đã hoàn tiền)</option>
        </select>
        <button
          onClick={() => { setStatus(""); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "1.5px solid #e2e8e1", background: "white", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Manrope, sans-serif" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#4f645b"; e.currentTarget.style.color = "#4f645b"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8e1"; e.currentTarget.style.color = "#6b7280"; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt_off</span> Xóa lọc
        </button>
      </div>

      <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(249,248,243,.6)" }}>
              <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>ID Hóa đơn</th>
              <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>Mã Booking</th>
              <th style={{ padding: "16px 24px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>Tổng Tiền</th>
              <th style={{ padding: "16px 24px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>Dư nợ</th>
              <th style={{ padding: "16px 24px", textAlign: "center", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>Trạng thái</th>
              <th style={{ padding: "16px 24px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>Ngày tạo</th>
              <th style={{ padding: "16px 24px", textAlign: "center", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "40px 24px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12, opacity: 0.5, display: "block" }}>search_off</span>
                  Không tìm thấy hóa đơn nào
                </td>
              </tr>
            )}
            {rows.map((item) => (
              <tr key={item.id} className="table-row">
                <td style={{ padding: "16px 24px" }}><div style={{ fontSize: 14, fontWeight: 800, color: "#1c1917" }}>#{item.id}</div></td>
                <td style={{ padding: "16px 24px" }}><div style={{ fontSize: 14, fontWeight: 700, color: "#4f645b" }}>{item.bookingCode || item.bookingId || "-"}</div></td>
                <td style={{ padding: "16px 24px", textAlign: "right" }}><div style={{ fontSize: 14, fontWeight: 800, color: "#16a34a" }}>{formatCurrency(item.finalTotal)}</div></td>
                <td style={{ padding: "16px 24px", textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: item.outstandingAmount > 0 ? "#dc2626" : "#6b7280" }}>
                    {formatCurrency(item.outstandingAmount)}
                  </div>
                </td>
                <td style={{ padding: "16px 24px", textAlign: "center" }}><InvoiceStatusBadge status={item.status} /></td>
                <td style={{ padding: "16px 24px", textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>{formatDate(item.createdAt).split(' ')[0]}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{formatDate(item.createdAt).split(' ')[1]}</div>
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button className="btn-icon-p" title="Xem chi tiết" onClick={() => navigate(`/admin/invoices/${item.id}`)}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}




