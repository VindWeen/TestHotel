import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { cancelBooking, checkIn, checkOut, confirmBooking, getBookings } from "../../api/bookingsApi";
import { formatDate, formatCurrency } from "../../utils";

const ALLOWED_ACTIONS = {
  Pending: ["confirm", "cancel"],
  Confirmed: ["checkin", "cancel"],
  Checked_in: ["checkout"],
  Completed: [],
  Cancelled: [],
};

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
    <div
      style={{
        background: s.bg, border: `1px solid ${s.border}`, color: s.text,
        borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,.35)",
        pointerEvents: "auto", marginBottom: 10, minWidth: 280,
        animation: "toastIn .32s cubic-bezier(.22,1,.36,1) forwards",
      }}
    >
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

// ─── Hộp thoại hủy ──────────────────────────────────────────────────────────────
function CancelModal({ open, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("Admin cancelled");

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20 }} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: "white", borderRadius: 24, width: "100%", maxWidth: 400, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)", animation: "modalSlideUp .3s ease-out", padding: 32 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1c1917", margin: "0 0 8px" }}>Hủy Đặt Phòng</h3>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>Vui lòng nhập lý do hủy phòng bên dưới:</p>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lý do hủy..."
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e2e8e1", background: "#f9f8f3", fontSize: 13, fontWeight: 500, fontFamily: "inherit", resize: "none", height: 80, outline: "none", color: "#1c1917", marginBottom: 20 }}
          onFocus={(e) => e.target.style.borderColor = "#4f645b"}
          onBlur={(e) => e.target.style.borderColor = "#e2e8e1"}
        />
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1.5px solid #e2e8e1", background: "white", fontWeight: 700, color: "#6b7280", cursor: "pointer", fontSize: 14 }}>Hủy bỏ</button>
          <button onClick={() => onConfirm(reason)} disabled={loading || !reason.trim()} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "#ef4444", fontWeight: 700, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, opacity: (!reason.trim() || loading) ? 0.6 : 1 }}>
            {loading ? <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin .65s linear infinite" }} /> : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cancel</span>}
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Nhãn trạng thái ─────────────────────────────────────────────────────────────
const BookingStatusBadge = ({ status }) => {
  const map = {
    Pending: { bg: "#fef3c7", text: "#d97706", icon: "schedule" },
    Confirmed: { bg: "#e0e7ff", text: "#4338ca", icon: "verified" },
    Checked_in: { bg: "#ecfdf5", text: "#059669", icon: "login" },
    Completed: { bg: "#f3f4f6", text: "#4b5563", icon: "done_all" },
    Cancelled: { bg: "#fef2f2", text: "#dc2626", icon: "block" }
  };
  const s = map[status] || { bg: "#f1f5f9", text: "#64748b", icon: "help" };
  return (
    <span className="badge-p" style={{ background: s.bg, color: s.text }}>
      <span className="material-symbols-outlined" style={{ fontSize: 13, fontWeight: 700 }}>{s.icon}</span>
      {status}
    </span>
  );
};

export default function BookingListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [busyId, setBusyId] = useState(null);
  
  // Trạng thái hộp thoại tùy chỉnh
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [filters, setFilters] = useState({
    bookingCode: "",
    guest: "",
    status: "",
    fromDate: "",
    toDate: "",
  });

  const showToast = useCallback((msg, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, msg, type }]);
  }, []);
  const dismissToast = useCallback((id) => {
    setToasts((p) => p.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBookings({ page: 1, pageSize: 200 });
      const payload = res.data || {};
      setRows(payload.data || []);
    } catch (e) {
      showToast(e?.response?.data?.message || "Không thể tải danh sách booking.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      const code = (item.bookingCode || "").toLowerCase();
      const guestName = (item.guestName || "").toLowerCase();
      const guestPhone = (item.guestPhone || "").toLowerCase();
      const status = item.status || "";
      const checkInDate = item.bookingDetails?.[0]?.checkInDate ? new Date(item.bookingDetails[0].checkInDate) : null;

      if (filters.bookingCode && !code.includes(filters.bookingCode.toLowerCase())) return false;
      if (filters.guest) {
        const keyword = filters.guest.toLowerCase();
        if (!guestName.includes(keyword) && !guestPhone.includes(keyword)) return false;
      }
      if (filters.status && status !== filters.status) return false;
      if (filters.fromDate && checkInDate && checkInDate < new Date(filters.fromDate)) return false;
      if (filters.toDate && checkInDate && checkInDate > new Date(filters.toDate)) return false;
      return true;
    });
  }, [rows, filters]);

  const runAction = async (id, action) => {
    // Nếu là cancel thì mở modal, không chạy trực tiếp
    if (action === "cancel") {
      setCancelTarget(id);
      return;
    }

    setBusyId(id);
    try {
      if (action === "confirm") { await confirmBooking(id); showToast("Đã xác nhận booking."); }
      if (action === "checkin") { await checkIn(id); showToast("Đã Check-in thành công."); }
      if (action === "checkout") { await checkOut(id); showToast("Đã Check-out thành công."); }
      await load();
    } catch (e) {
      showToast(e?.response?.data?.message || "Thao tác thất bại.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const executeCancel = async (reason) => {
    const normalizedReason = reason.trim();
    if (!normalizedReason) return;
    
    setCancelLoading(true);
    try {
      await cancelBooking(cancelTarget, normalizedReason);
      showToast("Đã hủy booking thành công.");
      setCancelTarget(null);
      await load();
    } catch (e) {
      showToast(e?.response?.data?.message || "Hủy thất bại.", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  const canRun = (status, action) => (ALLOWED_ACTIONS[status] || []).includes(action);

  // Reusable input style for toolbar
  const inputStyle = {
    border: "1.5px solid #e2e8e1", background: "#f9f8f3", padding: "10px 14px",
    borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#1c1917", outline: "none",
    width: "100%", boxSizing: "border-box", fontFamily: "Manrope, sans-serif",
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <style>{`        * { font-family: 'Manrope', sans-serif; }        @keyframes toastIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes toastProgress { from{width:100%} to{width:0} }
        @keyframes modalSlideUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .table-row { transition: background 0.1s; border-bottom: 1px solid #f1f0ea; }
        .table-row:hover { background: #fafaf8 !important; }
        .btn-icon-p { width: 34px; height: 34px; border-radius: 9px; border: 1.5px solid #f1f0ea; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; color: #6b7280; }
        .btn-icon-p:hover:not(:disabled) { border-color: #4f645b; color: #4f645b; background: #f0faf5; transform: scale(1.05); }
        .btn-icon-p:disabled { opacity: 0.35; cursor: not-allowed; }
        .badge-p { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
      `}</style>

      {/* Khu vực thông báo */}
      <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, pointerEvents: "none", minWidth: 280 }}>
        {toasts.map((t) => <Toast key={t.id} {...t} onDismiss={dismissToast} />)}
      </div>

      <CancelModal
        key={cancelTarget || "closed"}
        open={!!cancelTarget}
        onConfirm={executeCancel}
        onCancel={() => setCancelTarget(null)}
        loading={cancelLoading}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.025em", margin: "0 0 4px" }}>
            Quản lý Đặt phòng
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Tổng <span style={{ fontWeight: 700, color: "#1c1917" }}>{rows.length}</span> booking trong hệ thống
          </p>
        </div>
        <button
          onClick={load}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "white", color: "#1c1917", border: "1.5px solid #e2e8e1", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span> Làm mới
        </button>
      </div>

      <div style={{ background: "white", borderRadius: 18, padding: "18px 22px", border: "1px solid #f1f0ea", boxShadow: "0 1px 4px rgba(0,0,0,.06)", display: "grid", gridTemplateColumns: "repeat(5, 1fr) auto", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <input placeholder="Mã booking" value={filters.bookingCode} onChange={(e) => setFilters((f) => ({ ...f, bookingCode: e.target.value }))} style={inputStyle} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"} />
        <input placeholder="Tên / SĐT Khách" value={filters.guest} onChange={(e) => setFilters((f) => ({ ...f, guest: e.target.value }))} style={inputStyle} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"} />
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"}>
          <option value="">Tất cả trạng thái</option>
          <option value="Pending">Pending</option>
          <option value="Confirmed">Đã xác nhận</option>
          <option value="Checked_in">Checked_in</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Đã hủy</option>
        </select>
        <div style={{ position: "relative" }}>
          <input type="date" value={filters.fromDate} onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))} style={inputStyle} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"} />
          <div style={{ position: "absolute", top: -8, left: 10, background: "white", padding: "0 4px", fontSize: 10, fontWeight: 700, color: "#9ca3af" }}>Từ ngày</div>
        </div>
        <div style={{ position: "relative" }}>
          <input type="date" value={filters.toDate} onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))} style={inputStyle} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"} />
          <div style={{ position: "absolute", top: -8, left: 10, background: "white", padding: "0 4px", fontSize: 10, fontWeight: 700, color: "#9ca3af" }}>Đến ngày</div>
        </div>
        <button
          onClick={() => { setFilters({ bookingCode: "", guest: "", status: "", fromDate: "", toDate: "" }); load(); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "1.5px solid #e2e8e1", background: "white", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,.04)", fontFamily: "Manrope, sans-serif" }}
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
              <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>Mã Code</th>
              <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>Khách hàng</th>
              <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>Check-in</th>
              <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>Tổng tiền</th>
              <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>Trạng thái</th>
              <th style={{ padding: "16px 24px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filteredRows.length === 0 && (
              <tr>
                <td style={{ padding: "40px 24px", textAlign: "center", color: "#9ca3af", fontSize: 14 }} colSpan={6}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12, opacity: 0.5, display: "block" }}>search_off</span>
                  Không tìm thấy bookings nào
                </td>
              </tr>
            )}
            {filteredRows.map((item) => (
              <tr key={item.id} className="table-row">
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#1c1917" }}>{item.bookingCode}</div>
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1c1917" }}>{item.guestName || "-"}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{item.guestPhone || "-"}</div>
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1c1917" }}>{formatDate(item.bookingDetails?.[0]?.checkInDate).split(' ')[0]}</div>
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>{formatCurrency(item.totalEstimatedAmount)}</div>
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <BookingStatusBadge status={item.status} />
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button className="btn-icon-p" title="Chi tiết" onClick={() => navigate(`/admin/bookings/${item.id}`)}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span></button>
                    <button className="btn-icon-p" title="Xác nhận" disabled={!canRun(item.status, "confirm") || busyId === item.id} onClick={() => runAction(item.id, "confirm")}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span></button>
                    <button className="btn-icon-p" title="Check-in" disabled={!canRun(item.status, "checkin") || busyId === item.id} onClick={() => runAction(item.id, "checkin")}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>login</span></button>
                    <button className="btn-icon-p" title="Check-out" disabled={!canRun(item.status, "checkout") || busyId === item.id} onClick={() => runAction(item.id, "checkout")}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span></button>
                    <button className="btn-icon-p" title="Hủy" disabled={!canRun(item.status, "cancel") || busyId === item.id} onClick={() => runAction(item.id, "cancel")} style={{ color: canRun(item.status, "cancel") ? "#dc2626" : "#cbd5e1", borderColor: canRun(item.status, "cancel") ? "#fecaca" : "#f1f0ea" }} onMouseEnter={(e) => { if (canRun(item.status, "cancel")) { e.currentTarget.style.background = "#fef2f2"; } }} onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>cancel</span></button>
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





