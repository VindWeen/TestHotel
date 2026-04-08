import { useCallback, useEffect, useMemo, useState } from "react";
import { completeShift, confirmShift, createShift, getCurrentShifts, getShifts, handoverShift, startShift } from "../../api/shiftsApi";
import { getUsers } from "../../api/userManagementApi";

const pageCard = {
  background: "#fff",
  border: "1px solid #ece7de",
  borderRadius: 20,
  boxShadow: "0 10px 30px rgba(28,25,23,.05)",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d6d3d1",
  background: "#fff",
};

const statusMeta = {
  Scheduled: { bg: "#fef3c7", color: "#92400e", label: "Đã xếp ca" },
  Active: { bg: "#dcfce7", color: "#166534", label: "Đang trực" },
  Completed: { bg: "#e0e7ff", color: "#3730a3", label: "Hoàn tất" },
  Absent: { bg: "#fee2e2", color: "#991b1b", label: "Vắng mặt" },
};

const fmtDateTimeLocal = (value) =>
  value ? new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export default function ShiftManagementPage() {
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [currentRows, setCurrentRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [handoverTarget, setHandoverTarget] = useState(null);
  const [handoverForm, setHandoverForm] = useState({ handoverNote: "", cashAtHandover: "" });
  const [filters, setFilters] = useState({ department: "", status: "" });
  const [form, setForm] = useState({
    userId: "",
    shiftType: "Morning",
    department: "Reception",
    plannedStart: "",
    plannedEnd: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [userRes, shiftRes, currentRes] = await Promise.all([
        getUsers({ page: 1, pageSize: 200 }),
        getShifts(filters),
        getCurrentShifts(),
      ]);

      setUsers(userRes.data?.data || []);
      setRows(shiftRes.data?.data || []);
      setCurrentRows(currentRes.data?.data || []);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể tải dữ liệu ca làm việc.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const staffOptions = useMemo(
    () => (users || []).filter((item) => item.status !== false),
    [users],
  );

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    try {
      await createShift({
        userId: Number(form.userId),
        shiftType: form.shiftType,
        department: form.department,
        plannedStart: form.plannedStart,
        plannedEnd: form.plannedEnd,
      });
      setForm({
        userId: "",
        shiftType: "Morning",
        department: "Reception",
        plannedStart: "",
        plannedEnd: "",
      });
      await load();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể tạo ca làm việc.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (runner) => {
    setSaving(true);
    setErrorMessage("");
    try {
      await runner();
      setHandoverTarget(null);
      setHandoverForm({ handoverNote: "", cashAtHandover: "" });
      await load();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Thao tác ca làm việc thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, color: "#1c1917", fontWeight: 800 }}>Ca làm việc</h2>
          <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 14, maxWidth: 760, lineHeight: 1.65 }}>
            Module này hỗ trợ phân ca, bắt đầu ca, ghi chú bàn giao và xác nhận hoàn tất. Quy tắc chồng ca và ca active cùng bộ phận được xử lý ở backend.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} style={{ height: 42, padding: "0 16px", borderRadius: 12, border: "1px solid #d6d3d1", background: "#fff", fontWeight: 700, cursor: "pointer" }}>
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      {errorMessage ? <div style={{ ...pageCard, marginBottom: 20, padding: 14, color: "#b91c1c", background: "#fff7f7", borderColor: "#fecaca" }}>{errorMessage}</div> : null}

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <article style={{ ...pageCard, padding: 22 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 18, color: "#1c1917", fontWeight: 800 }}>Tạo ca mới</h3>
          <form onSubmit={handleCreate} style={{ display: "grid", gap: 12 }}>
            <select value={form.userId} onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))} style={inputStyle} required>
              <option value="">Chọn nhân sự</option>
              {staffOptions.map((user) => (
                <option key={user.id} value={user.id}>{user.fullName} - {user.roleName || user.role?.name || "Staff"}</option>
              ))}
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <select value={form.shiftType} onChange={(e) => setForm((prev) => ({ ...prev, shiftType: e.target.value }))} style={inputStyle}>
                <option value="Morning">Ca sáng</option>
                <option value="Afternoon">Ca chiều</option>
                <option value="Night">Ca đêm</option>
              </select>
              <select value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))} style={inputStyle}>
                <option value="Reception">Lễ tân</option>
                <option value="Housekeeping">Buồng phòng</option>
                <option value="Manager">Quản lý</option>
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input type="datetime-local" value={form.plannedStart} onChange={(e) => setForm((prev) => ({ ...prev, plannedStart: e.target.value }))} style={inputStyle} required />
              <input type="datetime-local" value={form.plannedEnd} onChange={(e) => setForm((prev) => ({ ...prev, plannedEnd: e.target.value }))} style={inputStyle} required />
            </div>
            <button type="submit" disabled={saving} style={{ height: 42, borderRadius: 12, border: "none", background: "#4f645b", color: "#ecfdf5", fontWeight: 800, cursor: "pointer" }}>
              {saving ? "Đang lưu..." : "Tạo ca"}
            </button>
          </form>
        </article>

        <article style={{ ...pageCard, padding: 22 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 18, color: "#1c1917", fontWeight: 800 }}>Ca đang hoạt động / trong giờ</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {currentRows.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: 14 }}>Hiện chưa có ca nào trong khung giờ hiện tại.</div>
            ) : currentRows.map((shift) => {
              const meta = statusMeta[shift.status] || statusMeta.Scheduled;
              return (
                <div key={shift.id} style={{ background: "#faf8f3", borderRadius: 14, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#1c1917", fontSize: 15, fontWeight: 800 }}>{shift.userFullName}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{shift.department} • {shift.shiftType}</div>
                    </div>
                    <span style={{ padding: "6px 10px", borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 800 }}>{meta.label}</span>
                  </div>
                  <div style={{ marginTop: 10, color: "#57534e", fontSize: 13 }}>
                    {fmtDateTimeLocal(shift.plannedStart)} - {fmtDateTimeLocal(shift.plannedEnd)}
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section style={{ ...pageCard, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1ece2", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <strong style={{ color: "#1c1917", fontSize: 18 }}>Danh sách ca làm việc</strong>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select value={filters.department} onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))} style={{ ...inputStyle, width: 160 }}>
              <option value="">Tất cả bộ phận</option>
              <option value="Reception">Lễ tân</option>
              <option value="Housekeeping">Buồng phòng</option>
              <option value="Manager">Quản lý</option>
            </select>
            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} style={{ ...inputStyle, width: 160 }}>
              <option value="">Tất cả trạng thái</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#faf8f3", borderBottom: "1px solid #f1ece2" }}>
                {["Nhân sự", "Bộ phận", "Thời gian", "Trạng thái", "Bàn giao", "Thao tác"].map((title) => (
                  <th key={title} style={{ padding: "14px 18px", textAlign: "left", color: "#78716c", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em" }}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>Chưa có ca làm việc nào.</td></tr>
              ) : rows.map((shift) => {
                const meta = statusMeta[shift.status] || statusMeta.Scheduled;
                const isEditingHandover = handoverTarget === shift.id;
                return (
                  <tr key={shift.id} style={{ borderBottom: "1px solid #f7f4ee", verticalAlign: "top" }}>
                    <td style={{ padding: "16px 18px" }}>
                      <div style={{ color: "#1c1917", fontWeight: 800 }}>{shift.userFullName}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>Xác nhận: {shift.confirmedByName || "Chưa có"}</div>
                    </td>
                    <td style={{ padding: "16px 18px", color: "#57534e", fontWeight: 700 }}>{shift.department} • {shift.shiftType}</td>
                    <td style={{ padding: "16px 18px", color: "#57534e" }}>
                      <div>{fmtDateTimeLocal(shift.plannedStart)} - {fmtDateTimeLocal(shift.plannedEnd)}</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "#78716c" }}>Bắt đầu thực tế: {fmtDateTimeLocal(shift.actualStart)}</div>
                    </td>
                    <td style={{ padding: "16px 18px" }}>
                      <span style={{ padding: "6px 10px", borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 800 }}>{meta.label}</span>
                      {shift.lateMinutes > 0 ? <div style={{ marginTop: 8, color: "#b45309", fontSize: 12, fontWeight: 700 }}>Trễ {shift.lateMinutes} phút</div> : null}
                    </td>
                    <td style={{ padding: "16px 18px" }}>
                      {isEditingHandover ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <textarea value={handoverForm.handoverNote} onChange={(e) => setHandoverForm((prev) => ({ ...prev, handoverNote: e.target.value }))} placeholder="Ghi chú bàn giao" style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />
                          <input type="number" value={handoverForm.cashAtHandover} onChange={(e) => setHandoverForm((prev) => ({ ...prev, cashAtHandover: e.target.value }))} placeholder="Tiền mặt bàn giao (nếu có)" style={inputStyle} />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" onClick={() => runAction(() => handoverShift(shift.id, { handoverNote: handoverForm.handoverNote, cashAtHandover: handoverForm.cashAtHandover || null }))} style={{ height: 36, padding: "0 12px", borderRadius: 10, border: "none", background: "#4f645b", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Lưu</button>
                            <button type="button" onClick={() => setHandoverTarget(null)} style={{ height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid #d6d3d1", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Hủy</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: "#57534e", fontSize: 13, lineHeight: 1.5 }}>
                          <div>{shift.handoverNote || "Chưa có ghi chú bàn giao."}</div>
                          {shift.cashAtHandover != null ? <div style={{ marginTop: 6, fontWeight: 700 }}>Tiền bàn giao: {shift.cashAtHandover}</div> : null}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "16px 18px" }}>
                      <div style={{ display: "grid", gap: 8 }}>
                        <button type="button" onClick={() => runAction(() => startShift(shift.id))} disabled={shift.status !== "Scheduled"} style={{ height: 36, borderRadius: 10, border: "1px solid #d6d3d1", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Bắt đầu ca</button>
                        <button
                          type="button"
                          onClick={() => {
                            setHandoverTarget(shift.id);
                            setHandoverForm({
                              handoverNote: shift.handoverNote || "",
                              cashAtHandover: shift.cashAtHandover || "",
                            });
                          }}
                          style={{ height: 36, borderRadius: 10, border: "1px solid #d6d3d1", background: "#fff", fontWeight: 700, cursor: "pointer" }}
                        >
                          Bàn giao
                        </button>
                        <button type="button" onClick={() => runAction(() => completeShift(shift.id))} disabled={shift.status !== "Active"} style={{ height: 36, borderRadius: 10, border: "1px solid #d6d3d1", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Hoàn tất</button>
                        <button type="button" onClick={() => runAction(() => confirmShift(shift.id))} style={{ height: 36, borderRadius: 10, border: "none", background: "#1f2937", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Xác nhận</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
