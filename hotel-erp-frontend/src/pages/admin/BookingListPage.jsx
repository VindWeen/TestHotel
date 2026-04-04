import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { cancelBooking, checkIn, checkOut, confirmBooking, createBooking, getBookings, getReceptionAvailability, getReceptionDashboard, getReceptionMemberSuggestions } from "../../api/bookingsApi";
import { getVouchers } from "../../api/vouchersApi";
import { formatDate, formatCurrency } from "../../utils";

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

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const sameDate = (a, b) => a && b && a.toDateString() === b.toDateString();
const toInputDate = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function ReceptionDateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
  const [draftStart, setDraftStart] = useState(value.checkInDate ? new Date(value.checkInDate) : null);

  useEffect(() => {
    setDraftStart(value.checkInDate ? new Date(value.checkInDate) : null);
  }, [value.checkInDate, value.checkOutDate]);

  const buildDays = (monthDate) => {
    const first = startOfMonth(monthDate);
    const last = endOfMonth(monthDate);
    const startWeekDay = (first.getDay() + 6) % 7;
    const days = [];

    for (let i = 0; i < startWeekDay; i += 1) {
      days.push(null);
    }
    for (let day = 1; day <= last.getDate(); day += 1) {
      days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
    }
    return days;
  };

  const handlePick = (day) => {
    if (!draftStart || (value.checkInDate && value.checkOutDate)) {
      setDraftStart(day);
      onChange({ checkInDate: toInputDate(day), checkOutDate: "" });
      return;
    }

    if (day < draftStart) {
      setDraftStart(day);
      onChange({ checkInDate: toInputDate(day), checkOutDate: "" });
      return;
    }

    onChange({
      checkInDate: toInputDate(draftStart),
      checkOutDate: toInputDate(day),
    });
    setDraftStart(null);
    setOpen(false);
  };

  const isInRange = (day) => {
    if (!day || !value.checkInDate || !value.checkOutDate) return false;
    const start = new Date(value.checkInDate);
    const end = new Date(value.checkOutDate);
    return day >= start && day <= end;
  };

  const renderMonth = (monthDate) => {
    const days = buildDays(monthDate);
    return (
      <div style={{ minWidth: 280 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <strong style={{ color: "#1c1917" }}>
            {monthDate.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}
          </strong>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => (
            <div key={label} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#6b7280", paddingBottom: 4 }}>{label}</div>
          ))}
          {days.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} />;
            }
            const selectedStart = value.checkInDate && sameDate(day, new Date(value.checkInDate));
            const selectedEnd = value.checkOutDate && sameDate(day, new Date(value.checkOutDate));
            return (
              <button
                key={day.toISOString()}
                onClick={() => handlePick(day)}
                style={{
                  height: 36,
                  borderRadius: 10,
                  border: selectedStart || selectedEnd ? "1.5px solid #4f645b" : "1px solid #e5e7eb",
                  background: selectedStart || selectedEnd ? "#4f645b" : isInRange(day) ? "#dcfce7" : "white",
                  color: selectedStart || selectedEnd ? "white" : "#1c1917",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: "100%",
          border: "1.5px solid #e2e8e1",
          background: "#f9f8f3",
          padding: "10px 14px",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          color: "#1c1917",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        {value.checkInDate ? `Check-in: ${value.checkInDate}` : "Chọn ngày check-in"}
        {"  "}
        {value.checkOutDate ? `• Check-out: ${value.checkOutDate}` : value.checkInDate ? "• Chọn tiếp ngày check-out" : ""}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 50, background: "white", border: "1px solid #e5e7eb", borderRadius: 16, boxShadow: "0 20px 40px rgba(15,23,42,.14)", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
            <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="btn-icon-p">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
            </button>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
              Chọn ngày bắt đầu rồi chọn tiếp ngày kết thúc
            </div>
            <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="btn-icon-p">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
            </button>
          </div>
          {renderMonth(viewDate)}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
            <button type="button" onClick={() => { setDraftStart(null); onChange({ checkInDate: "", checkOutDate: "" }); }} className="btn-icon-p" style={{ width: "auto", padding: "0 12px" }}>
              Xóa
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-icon-p" style={{ width: "auto", padding: "0 12px" }}>
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookingListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [dashboard, setDashboard] = useState({ todayArrivals: [], stayingGuests: [], pendingCheckouts: [], summary: {} });
  const [vouchers, setVouchers] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberSuggestOpen, setMemberSuggestOpen] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availableRoomTypes, setAvailableRoomTypes] = useState([]);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [activeTab, setActiveTab] = useState("manage");
  
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

  const [bookingForm, setBookingForm] = useState({
    customerType: "walk_in",
    userId: null,
    memberKeyword: "",
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    numAdults: 2,
    numChildren: 0,
    checkInDate: "",
    checkOutDate: "",
    voucherId: "",
    source: "walk_in",
    note: "",
    selectedRoomTypeId: "",
    selectedRoomId: "",
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
      const [bookingRes, dashboardRes, voucherRes] = await Promise.all([
        getBookings({ page: 1, pageSize: 200 }),
        getReceptionDashboard({ date: new Date().toISOString().slice(0, 10) }),
        getVouchers({ page: 1, pageSize: 100, status: "active" }),
      ]);

      const bookingPayload = bookingRes.data || {};
      const dashboardPayload = dashboardRes.data?.data || {};
      const voucherPayload = voucherRes.data || {};
      setRows(bookingPayload.data || []);
      setDashboard({
        todayArrivals: dashboardPayload.todayArrivals || [],
        stayingGuests: dashboardPayload.stayingGuests || [],
        pendingCheckouts: dashboardPayload.pendingCheckouts || [],
        summary: dashboardPayload.summary || {},
      });
      setVouchers(voucherPayload.data || []);
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
    const baseRows =
      activeTab === "arrivals"
        ? dashboard.todayArrivals || []
        : activeTab === "staying"
          ? dashboard.stayingGuests || []
          : activeTab === "checkout"
            ? dashboard.pendingCheckouts || []
            : rows;

    return baseRows.filter((item) => {
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
  }, [rows, filters, activeTab, dashboard]);

  const estimatedBookingAmount = useMemo(() => {
    const selectedRoomType = availableRoomTypes.find((item) => String(item.id) === String(bookingForm.selectedRoomTypeId));
    if (selectedRoomType?.suggestedTotal) {
      return Number(selectedRoomType.suggestedTotal);
    }

    if (!bookingForm.checkInDate || !bookingForm.checkOutDate || availableRoomTypes.length === 0) {
      return 0;
    }

    return Number(availableRoomTypes[0]?.suggestedTotal || 0);
  }, [availableRoomTypes, bookingForm.selectedRoomTypeId, bookingForm.checkInDate, bookingForm.checkOutDate]);

  const selectableVouchers = useMemo(() => {
    const now = new Date();
    const selectedRoomTypeId = bookingForm.selectedRoomTypeId ? Number(bookingForm.selectedRoomTypeId) : null;

    return vouchers.filter((voucher) => {
      if (!voucher.isActive) return false;

      if (voucher.validFrom && new Date(voucher.validFrom) > now) return false;
      if (voucher.validTo && new Date(voucher.validTo) < now) return false;
      if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) return false;
      if (voucher.minBookingValue != null && estimatedBookingAmount > 0 && estimatedBookingAmount < Number(voucher.minBookingValue)) return false;
      if (voucher.applicableRoomTypeId && selectedRoomTypeId && Number(voucher.applicableRoomTypeId) !== selectedRoomTypeId) return false;

      return true;
    });
  }, [vouchers, estimatedBookingAmount, bookingForm.selectedRoomTypeId]);

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

  const loadAvailability = useCallback(async () => {
    if (!bookingForm.checkInDate || !bookingForm.checkOutDate) {
      setAvailableRoomTypes([]);
      return;
    }

    setAvailabilityLoading(true);
    try {
      const res = await getReceptionAvailability({
        checkInDate: bookingForm.checkInDate,
        checkOutDate: bookingForm.checkOutDate,
        numAdults: bookingForm.numAdults,
        numChildren: bookingForm.numChildren,
      });
      const payload = res.data?.data || [];
      setAvailableRoomTypes(payload);
    } catch (e) {
      setAvailableRoomTypes([]);
      showToast(e?.response?.data?.message || "Không thể lấy danh sách phòng phù hợp.", "error");
    } finally {
      setAvailabilityLoading(false);
    }
  }, [bookingForm.checkInDate, bookingForm.checkOutDate, bookingForm.numAdults, bookingForm.numChildren, showToast]);

  useEffect(() => {
    if (activeTab === "manage") {
      loadAvailability();
    }
  }, [activeTab, loadAvailability]);

  useEffect(() => {
    if (!bookingForm.voucherId) return;

    const stillSelectable = selectableVouchers.some((voucher) => String(voucher.id) === String(bookingForm.voucherId));
    if (!stillSelectable) {
      setBookingForm((prev) => ({ ...prev, voucherId: "" }));
    }
  }, [bookingForm.voucherId, selectableVouchers]);

  useEffect(() => {
    let ignore = false;

    const fetchMembers = async () => {
      if (bookingForm.customerType !== "member") {
        setMemberOptions([]);
        setMemberSuggestOpen(false);
        return;
      }

      setMemberLoading(true);
      try {
        const res = await getReceptionMemberSuggestions({
          keyword: bookingForm.memberKeyword || "",
        });
        const payload = res.data?.data || [];
        if (!ignore) {
          setMemberOptions(payload);
        }
      } catch {
        if (!ignore) {
          setMemberOptions([]);
        }
      } finally {
        if (!ignore) {
          setMemberLoading(false);
        }
      }
    };

    fetchMembers();
    return () => {
      ignore = true;
    };
  }, [bookingForm.customerType, bookingForm.memberKeyword]);

  const handleSelectMember = (member) => {
    setBookingForm((prev) => ({
      ...prev,
      customerType: "member",
      userId: member.id,
      memberKeyword: member.fullName || "",
      guestName: member.fullName || "",
      guestPhone: member.phone || "",
      guestEmail: member.email || "",
    }));
    setMemberSuggestOpen(false);
  };

  const handleCreateBooking = async () => {
    if (!bookingForm.selectedRoomTypeId || !bookingForm.selectedRoomId) {
      showToast("Bạn chưa chọn phòng khả dụng cụ thể.", "warning");
      return;
    }

    setCreatingBooking(true);
    try {
      await createBooking({
        userId: bookingForm.userId,
        guestName: bookingForm.guestName,
        guestPhone: bookingForm.guestPhone,
        guestEmail: bookingForm.guestEmail,
        numAdults: Number(bookingForm.numAdults),
        numChildren: Number(bookingForm.numChildren),
        voucherId: bookingForm.voucherId ? Number(bookingForm.voucherId) : null,
        source: bookingForm.source,
        note: bookingForm.note,
        details: [
          {
            roomTypeId: Number(bookingForm.selectedRoomTypeId),
            roomId: Number(bookingForm.selectedRoomId),
            checkInDate: bookingForm.checkInDate,
            checkOutDate: bookingForm.checkOutDate,
          },
        ],
      });

      showToast("Đã tạo booking mới thành công.");
      setBookingForm({
        customerType: "walk_in",
        userId: null,
        memberKeyword: "",
        guestName: "",
        guestPhone: "",
        guestEmail: "",
        numAdults: 2,
        numChildren: 0,
        checkInDate: "",
        checkOutDate: "",
        voucherId: "",
        source: "walk_in",
        note: "",
        selectedRoomTypeId: "",
        selectedRoomId: "",
      });
      setAvailableRoomTypes([]);
      await load();
    } catch (e) {
      showToast(e?.response?.data?.message || "Tạo booking thất bại.", "error");
    } finally {
      setCreatingBooking(false);
    }
  };

  const tabs = [
    { id: "manage", label: "Quản lý booking", count: rows.length },
    { id: "arrivals", label: "Khách đến hôm nay", count: dashboard.todayArrivals?.length || 0 },
    { id: "staying", label: "Khách đang lưu trú", count: dashboard.stayingGuests?.length || 0 },
    { id: "checkout", label: "Thủ tục trả phòng", count: dashboard.pendingCheckouts?.length || 0 },
  ];

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
            Quầy Lễ tân
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Theo dõi booking, khách đến hôm nay, khách đang lưu trú và thủ tục trả phòng trong cùng một màn hình
          </p>
        </div>
        <button
          onClick={load}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "white", color: "#1c1917", border: "1.5px solid #e2e8e1", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span> Làm mới
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 18 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              borderRadius: 16,
              padding: "16px 18px",
              border: activeTab === tab.id ? "1.5px solid #4f645b" : "1px solid #e5e7eb",
              background: activeTab === tab.id ? "#f0faf5" : "white",
              textAlign: "left",
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,.04)",
            }}
          >
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
              {tab.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#1c1917" }}>{tab.count}</div>
          </button>
        ))}
      </div>

      {activeTab === "manage" && (
        <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 22, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "#1c1917" }}>Tạo booking cho lễ tân</h3>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                Chọn ngày và số khách để hệ thống gợi ý hạng phòng phù hợp. Giá chỉ hiển thị ở bước nội bộ này.
              </p>
            </div>
            <button
              onClick={loadAvailability}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "white", color: "#1c1917", border: "1.5px solid #e2e8e1", cursor: "pointer" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>travel_explore</span>
              Gợi ý phòng
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 14 }}>
            <select
              value={bookingForm.customerType}
              onChange={(e) => {
                const nextType = e.target.value;
                setBookingForm((prev) => ({
                  ...prev,
                  customerType: nextType,
                  userId: nextType === "member" ? prev.userId : null,
                  memberKeyword: nextType === "member" ? prev.memberKeyword : "",
                  ...(nextType === "walk_in" ? { guestName: "", guestPhone: "", guestEmail: "" } : {}),
                }));
              }}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="walk_in">Khách vãng lai</option>
              <option value="member">Khách thành viên</option>
            </select>
            <div style={{ position: "relative" }}>
              <input
                placeholder={bookingForm.customerType === "member" ? "Nhập tên thành viên để gợi ý" : "Tên khách"}
                value={bookingForm.customerType === "member" ? bookingForm.memberKeyword : bookingForm.guestName}
                onChange={(e) => {
                  const value = e.target.value;
                  if (bookingForm.customerType === "member") {
                    setMemberSuggestOpen(true);
                  }
                  setBookingForm((prev) => bookingForm.customerType === "member"
                    ? { ...prev, memberKeyword: value, userId: null, guestName: value }
                    : { ...prev, guestName: value });
                }}
                onFocus={() => {
                  if (bookingForm.customerType === "member") {
                    setMemberSuggestOpen(true);
                  }
                }}
                onBlur={() => {
                  if (bookingForm.customerType === "member") {
                    setTimeout(() => setMemberSuggestOpen(false), 120);
                  }
                }}
                style={inputStyle}
              />
              {bookingForm.customerType === "member" && memberSuggestOpen && (bookingForm.memberKeyword || memberLoading || memberOptions.length > 0) && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30, background: "white", border: "1px solid #e5e7eb", borderRadius: 14, boxShadow: "0 16px 32px rgba(15,23,42,.12)", maxHeight: 220, overflowY: "auto" }}>
                  {memberLoading ? (
                    <div style={{ padding: 12, fontSize: 13, color: "#6b7280" }}>Đang tìm khách thành viên...</div>
                  ) : memberOptions.length === 0 ? (
                    <div style={{ padding: 12, fontSize: 13, color: "#6b7280" }}>Không có gợi ý phù hợp.</div>
                  ) : memberOptions.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleSelectMember(member)}
                      style={{ width: "100%", textAlign: "left", border: "none", background: "white", padding: 12, cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1c1917" }}>{member.fullName}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{member.phone || "Chưa có SĐT"} • {member.email || "Chưa có email"}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input placeholder="Số điện thoại" value={bookingForm.guestPhone} onChange={(e) => setBookingForm((prev) => ({ ...prev, guestPhone: e.target.value }))} style={inputStyle} />
            <input placeholder="Email" value={bookingForm.guestEmail} onChange={(e) => setBookingForm((prev) => ({ ...prev, guestEmail: e.target.value }))} style={inputStyle} />
            <select value={bookingForm.source} onChange={(e) => setBookingForm((prev) => ({ ...prev, source: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="walk_in">Walk-in</option>
              <option value="phone">Phone</option>
              <option value="online">Online</option>
            </select>
            <div style={{ gridColumn: "span 2" }}>
              <ReceptionDateRangePicker
                value={{ checkInDate: bookingForm.checkInDate, checkOutDate: bookingForm.checkOutDate }}
                onChange={({ checkInDate, checkOutDate }) => setBookingForm((prev) => ({ ...prev, checkInDate, checkOutDate }))}
              />
            </div>
            <input type="number" min="1" value={bookingForm.numAdults} onChange={(e) => setBookingForm((prev) => ({ ...prev, numAdults: e.target.value }))} style={inputStyle} placeholder="Người lớn" />
            <input type="number" min="0" value={bookingForm.numChildren} onChange={(e) => setBookingForm((prev) => ({ ...prev, numChildren: e.target.value }))} style={inputStyle} placeholder="Trẻ em" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, alignItems: "start", marginBottom: 16 }}>
            <textarea
              placeholder="Ghi chú booking"
              value={bookingForm.note}
              onChange={(e) => setBookingForm((prev) => ({ ...prev, note: e.target.value }))}
              style={{ ...inputStyle, minHeight: 88, resize: "vertical" }}
            />
            <select value={bookingForm.voucherId} onChange={(e) => setBookingForm((prev) => ({ ...prev, voucherId: e.target.value }))} style={{ ...inputStyle, cursor: "pointer", height: 44 }}>
              <option value="">Không áp dụng voucher</option>
              {selectableVouchers.map((voucher) => (
                <option key={voucher.id} value={voucher.id}>
                  {voucher.code} {voucher.discountType === "PERCENT" ? `- ${voucher.discountValue}%` : `- ${formatCurrency(voucher.discountValue)}`}
                </option>
              ))}
            </select>
            {vouchers.length > 0 && selectableVouchers.length === 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#9a3412", fontWeight: 700 }}>
                Hiện chưa có voucher phù hợp với hạng phòng hoặc tổng tiền dự kiến của booking này.
              </div>
            )}
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "14px 16px", background: "#fafaf8", borderBottom: "1px solid #f1f0ea", fontSize: 13, fontWeight: 800, color: "#1c1917" }}>
              Hạng phòng phù hợp
            </div>
            {availabilityLoading ? (
              <div style={{ padding: 20, fontSize: 13, color: "#6b7280" }}>Đang lấy danh sách phòng phù hợp...</div>
            ) : availableRoomTypes.length === 0 ? (
              <div style={{ padding: 20, fontSize: 13, color: "#6b7280" }}>Chưa có gợi ý. Hãy chọn ngày và số khách rồi bấm “Gợi ý phòng”.</div>
            ) : (
              <div style={{ display: "grid", gap: 14, padding: 14 }}>
                {availableRoomTypes.map((item) => {
                  return (
                    <div
                      key={item.id}
                      style={{
                        borderRadius: 14,
                        border: "1px solid #e5e7eb",
                        background: "white",
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#1c1917", marginBottom: 4 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                        {item.capacityAdults} người lớn • {item.capacityChildren} trẻ em
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                        Còn {item.availableRooms} phòng phù hợp
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#166534", marginBottom: 12 }}>{formatCurrency(item.suggestedTotal)}</div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {(item.rooms || []).map((room) => {
                          const selectedRoom = String(room.id) === String(bookingForm.selectedRoomId);
                          const selectable = room.selectable;
                          const bookingStatusLabel = room.bookingStatusLabel || (selectable ? "Có thể book" : "Không khả dụng");
                          const liveStatusLabel = room.liveStatusLabel || "Chưa rõ trạng thái";
                          const bg = selectable ? (selectedRoom ? "#dcfce7" : "#eff6ff") : "#fef2f2";
                          const border = selectable ? (selectedRoom ? "#16a34a" : "#60a5fa") : "#fca5a5";
                          const color = selectable ? "#1c1917" : "#b91c1c";
                          const bookingStatusColor = selectable ? "#166534" : "#b91c1c";

                          return (
                            <button
                              key={room.id}
                              type="button"
                              disabled={!selectable}
                              onClick={() => setBookingForm((prev) => {
                                const isSameRoom = String(prev.selectedRoomId) === String(room.id);
                                return {
                                  ...prev,
                                  selectedRoomTypeId: isSameRoom ? "" : String(item.id),
                                  selectedRoomId: isSameRoom ? "" : String(room.id),
                                };
                              })}
                              style={{
                                minWidth: 120,
                                textAlign: "left",
                                borderRadius: 12,
                                border: `1.5px solid ${border}`,
                                background: bg,
                                padding: "10px 12px",
                                cursor: selectable ? "pointer" : "not-allowed",
                                opacity: selectable ? 1 : 0.95,
                              }}
                            >
                              <div style={{ fontSize: 14, fontWeight: 800, color }}>{room.roomNumber}</div>
                              <div style={{ fontSize: 11, color: bookingStatusColor, marginTop: 4, fontWeight: 700 }}>
                                {bookingStatusLabel}
                              </div>
                              <div style={{ fontSize: 11, color: selectable ? "#6b7280" : "#7f1d1d", marginTop: 3 }}>
                                Hiện tại: {liveStatusLabel}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleCreateBooking}
              disabled={creatingBooking}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 800, background: "linear-gradient(135deg,#4f645b 0%,#43574f 100%)", color: "white", border: "none", cursor: "pointer", opacity: creatingBooking ? 0.7 : 1 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_home</span>
              {creatingBooking ? "Đang tạo booking..." : "Tạo booking"}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: "white", borderRadius: 18, padding: "18px 22px", border: "1px solid #f1f0ea", boxShadow: "0 1px 4px rgba(0,0,0,.06)", display: "grid", gridTemplateColumns: "repeat(5, 1fr) auto", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <input placeholder="Mã booking" value={filters.bookingCode} onChange={(e) => setFilters((f) => ({ ...f, bookingCode: e.target.value }))} style={inputStyle} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"} />
        <input placeholder="Tên / SĐT Khách" value={filters.guest} onChange={(e) => setFilters((f) => ({ ...f, guest: e.target.value }))} style={inputStyle} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"} />
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }} onFocus={(e) => e.target.style.borderColor = "#4f645b"} onBlur={(e) => e.target.style.borderColor = "#e2e8e1"}>
          <option value="">Tất cả trạng thái</option>
          <option value="Pending">Pending</option>
          <option value="Confirmed">Đã xác nhận</option>
          <option value="Checked_in">Checked_in</option>
          <option value="Checked_out_pending_settlement">Chờ quyết toán</option>
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

      {activeTab !== "manage" && (
        <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 12, border: "1px solid #d1fae5", background: "#ecfdf5", color: "#065f46", fontSize: 13, fontWeight: 700 }}>
          {activeTab === "arrivals" && "Danh sách này chỉ hiển thị các booking dự kiến check-in trong ngày."}
          {activeTab === "staying" && "Danh sách này chỉ hiển thị các booking đang lưu trú để lễ tân theo dõi nhanh."}
          {activeTab === "checkout" && "Danh sách này ưu tiên các booking cần làm thủ tục trả phòng trong ngày."}
        </div>
      )}

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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1c1917" }}>{item.bookingCode}</div>
                    <button
                      className="btn-icon-p"
                      title="Sao chép mã booking"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(item.bookingCode || "");
                          showToast("Đã sao chép mã booking.");
                        } catch {
                          showToast("Không thể sao chép mã booking.", "error");
                        }
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
                    </button>
                  </div>
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





