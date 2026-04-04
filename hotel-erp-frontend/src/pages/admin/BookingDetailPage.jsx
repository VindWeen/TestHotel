import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cancelBooking, checkIn, checkOut, confirmBooking, getBookingDetail } from "../../api/bookingsApi";
import { formatCurrency, formatDate } from "../../utils";

const ALLOWED_ACTIONS = {
  Pending: ["confirm", "cancel"],
  Confirmed: ["checkin", "cancel"],
  Checked_in: ["checkout"],
  Checked_out_pending_settlement: [],
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
    Checked_out_pending_settlement: { bg: "#fff7ed", text: "#c2410c", icon: "payments" },
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

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [toasts, setToasts] = useState([]);
  
  // Trạng thái hộp thoại tùy chỉnh
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

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
      const res = await getBookingDetail(id);
      const payload = res.data || {};
      setBooking(payload.data || payload);
      setTimeline(payload.timeline || []);
    } catch (e) {
      showToast(e?.response?.data?.message || "Không thể tải chi tiết booking.", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const canRun = (action) => (ALLOWED_ACTIONS[booking?.status] || []).includes(action);

  const runAction = async (action) => {
    if (action === "cancel") {
      setCancelModalOpen(true);
      return;
    }

    try {
      if (action === "confirm") { await confirmBooking(id); showToast("Đã xác nhận booking."); }
      if (action === "checkin") { await checkIn(id); showToast("Đã Check-in thành công."); }
      if (action === "checkout") { await checkOut(id); showToast("Đã Check-out thành công."); }
      await load();
    } catch (e) {
      showToast(e?.response?.data?.message || "Thao tác thất bại.", "error");
    }
  };

  const executeCancel = async (reason) => {
    const normalizedReason = reason.trim();
    if (!normalizedReason) return;
    
    setCancelLoading(true);
    try {
      await cancelBooking(id, normalizedReason);
      showToast("Đã hủy booking thành công.");
      setCancelModalOpen(false);
      await load();
    } catch (e) {
      showToast(e?.response?.data?.message || "Hủy thất bại.", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  const timelineItems = useMemo(() => (timeline || []).slice().sort((a, b) => new Date(a.at) - new Date(b.at)), [timeline]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <style>{`        * { font-family: 'Manrope', sans-serif; }        @keyframes toastIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes toastProgress { from{width:100%} to{width:0} }
        @keyframes modalSlideUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .table-row { transition: background 0.1s; border-bottom: 1px solid #f1f0ea; }
        .table-row:hover { background: #fafaf8 !important; }
        .badge-p { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
        .action-btn { display: inline-flex; alignItems: center; gap: 8px; padding: 10px 22px; borderRadius: 12px; font-size: 14px; font-weight: 700; background: white; color: #1c1917; border: 1.5px solid #e2e8e1; cursor: pointer; transition: all 0.15s; }
        .action-btn:hover:not(:disabled) { border-color: #4f645b; color: #4f645b; background: #f0faf5; }
        .action-btn.primary { background: linear-gradient(135deg,#4f645b 0%,#43574f 100%); color: #e7fef3; border: none; }
        .action-btn.primary:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(79,100,91,0.25); }
        .action-btn.danger { color: #dc2626; border-color: #fecaca; }
        .action-btn.danger:hover:not(:disabled) { background: #fef2f2; }
        .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      {/* Khu vực thông báo */}
      <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, pointerEvents: "none", minWidth: 280 }}>
        {toasts.map((t) => <Toast key={t.id} {...t} onDismiss={dismissToast} />)}
      </div>

      <CancelModal
        key={cancelModalOpen ? "open" : "closed"}
        open={cancelModalOpen}
        onConfirm={executeCancel}
        onCancel={() => setCancelModalOpen(false)}
        loading={cancelLoading}
      />

      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => navigate("/admin/bookings")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6b7280", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 12 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Quay lại danh sách
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.025em", margin: 0 }}>
            Chi tiết Đặt phòng
            {booking && <span style={{ marginLeft: 12, color: "#9ca3af", fontWeight: 600, fontSize: 16 }}>#{booking.bookingCode}</span>}
          </h2>
          {booking && <BookingStatusBadge status={booking.status} />}
        </div>
      </div>

      {!loading && booking && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
          {/* Main Info Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Summary Card */}
            <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1c1917", margin: "0 0 20px" }}>Thông tin khách hàng & Báo giá</h3>
              {booking.status === "Checked_out_pending_settlement" && (
                <div style={{ marginBottom: 20, padding: "12px 14px", borderRadius: 12, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", fontSize: 13, fontWeight: 700 }}>
                  Khách đã check-out. Booking này đang chờ quyết toán hóa đơn trước khi chuyển sang Completed.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 24px" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Tên khách hàng</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1c1917" }}>{booking.guestName || "-"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Số điện thoại</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1c1917" }}>{booking.guestPhone || "-"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Tổng dự kiến</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>{formatCurrency(booking.totalEstimatedAmount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Đã đặt cọc</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#4f645b" }}>{formatCurrency(booking.depositAmount)}</div>
                </div>
                {booking.status === "Cancelled" && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Lý do hủy</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#b91c1c", background: "#fef2f2", padding: "10px 14px", borderRadius: 10, border: "1px dashed #fecaca" }}>{booking.cancellationReason || "-"}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Rooms Table */}
            <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f0ea", background: "rgba(249,248,243,.6)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1c1917", margin: 0 }}>Danh sách hạng phòng booking</h3>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "white" }}>
                    <th style={{ padding: "14px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea", textTransform: "uppercase", letterSpacing: ".05em" }}>Hạng phòng</th>
                    <th style={{ padding: "14px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea", textTransform: "uppercase", letterSpacing: ".05em" }}>Phòng (N/A nếu chưa gán)</th>
                    <th style={{ padding: "14px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea", textTransform: "uppercase", letterSpacing: ".05em" }}>Thời gian</th>
                    <th style={{ padding: "14px 24px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f1f0ea", textTransform: "uppercase", letterSpacing: ".05em" }}>Giá/Đêm</th>
                  </tr>
                </thead>
                <tbody>
                  {(booking.bookingDetails || []).map((detail) => (
                    <tr key={detail.id} className="table-row">
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#1c1917" }}>{detail.roomTypeName || "-"}</div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ padding: "3px 10px", borderRadius: 8, background: "#f0faf5", color: "#1a3826", fontWeight: 800, fontSize: 14, display: "inline-block", border: "1.5px solid #a7f3d0" }}>
                          {detail.roomName || "-"}
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>In: {formatDate(detail.checkInDate)}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginTop: 4 }}>Out: {formatDate(detail.checkOutDate)}</div>
                      </td>
                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#4f645b" }}>{formatCurrency(detail.pricePerNight)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Actions & Timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Actions Card */}
            <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1c1917", margin: "0 0 16px" }}>Hành động</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button className="action-btn primary" disabled={!canRun("confirm")} onClick={() => runAction("confirm")}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span> Xác nhận booking
                </button>
                <button className="action-btn" disabled={!canRun("checkin")} onClick={() => runAction("checkin")}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>login</span> Khách Check-in
                </button>
                <button className="action-btn" disabled={!canRun("checkout")} onClick={() => runAction("checkout")}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span> Khách Check-out
                </button>
                <button className="action-btn danger" disabled={!canRun("cancel")} onClick={() => runAction("cancel")}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cancel</span> Hủy đặt phòng
                </button>
              </div>
            </div>

            {/* Timeline Card */}
            <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1c1917", margin: "0 0 20px" }}>Lịch sử hoạt động</h3>
              {timelineItems.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af" }}>Chưa có hoạt động nào.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {timelineItems.map((item, index) => (
                  <div key={`${item.type}-${index}`} style={{ display: "flex", gap: 14, position: "relative" }}>
                    {/* Line */}
                    {index < timelineItems.length - 1 && (
                      <div style={{ position: "absolute", left: 7, top: 20, bottom: -10, width: 2, background: "#f1f0ea" }} />
                    )}
                    {/* Dot */}
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#e7fef3", border: "2px solid #4f645b", flexShrink: 0, marginTop: 4, zIndex: 1 }} />
                    {/* Content */}
                    <div style={{ paddingBottom: 20 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1c1917" }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{formatDate(item.at)} • {item.type}</div>
                      {item.note && <div style={{ fontSize: 13, color: "#4b5563", background: "#f9f8f3", padding: "8px 12px", borderRadius: 8, marginTop: 8 }}>{item.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




