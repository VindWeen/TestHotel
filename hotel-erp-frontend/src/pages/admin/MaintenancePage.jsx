import { useCallback, useEffect, useMemo, useState } from "react";
import { createMaintenanceTicket, getMaintenanceTickets, updateMaintenanceTicketStatus } from "../../api/maintenanceApi";
import { getRooms } from "../../api/roomsApi";
import { getUsers } from "../../api/userManagementApi";

const cardStyle = {
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
  Open: { bg: "#fef3c7", color: "#92400e" },
  InProgress: { bg: "#dbeafe", color: "#1d4ed8" },
  Resolved: { bg: "#ede9fe", color: "#6d28d9" },
  Closed: { bg: "#dcfce7", color: "#166534" },
  Cancelled: { bg: "#fee2e2", color: "#991b1b" },
};

const fmtDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function MaintenancePage() {
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusNotes, setStatusNotes] = useState({});
  const [filters, setFilters] = useState({ status: "" });
  const [form, setForm] = useState({
    roomId: "",
    title: "",
    reason: "",
    category: "Repair",
    priority: "Medium",
    assignedToUserId: "",
    blocksRoom: true,
    expectedDoneAt: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [roomRes, userRes, ticketRes] = await Promise.all([
        getRooms(),
        getUsers({ page: 1, pageSize: 200 }),
        getMaintenanceTickets(filters.status ? { status: filters.status } : {}),
      ]);

      setRooms(roomRes.data?.data || []);
      setStaff(userRes.data?.data || []);
      setRows(ticketRes.data?.data || []);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể tải dữ liệu bảo trì.");
    } finally {
      setLoading(false);
    }
  }, [filters.status]);

  useEffect(() => {
    load();
  }, [load]);

  const roomOptions = useMemo(() => rooms || [], [rooms]);
  const staffOptions = useMemo(() => (staff || []).filter((user) => user.status !== false), [staff]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    try {
      await createMaintenanceTicket({
        roomId: Number(form.roomId),
        title: form.title,
        reason: form.reason,
        category: form.category,
        priority: form.priority,
        assignedToUserId: form.assignedToUserId ? Number(form.assignedToUserId) : null,
        blocksRoom: Boolean(form.blocksRoom),
        expectedDoneAt: form.expectedDoneAt || null,
      });

      setForm({
        roomId: "",
        title: "",
        reason: "",
        category: "Repair",
        priority: "Medium",
        assignedToUserId: "",
        blocksRoom: true,
        expectedDoneAt: "",
      });
      await load();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể tạo phiếu bảo trì.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (ticketId, status) => {
    setSaving(true);
    setErrorMessage("");
    try {
      await updateMaintenanceTicketStatus(ticketId, {
        status,
        resolutionNote: statusNotes[ticketId] || null,
      });
      await load();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể cập nhật trạng thái ticket.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, color: "#1c1917", fontWeight: 800 }}>Bảo trì phòng</h2>
          <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 14, maxWidth: 760, lineHeight: 1.65 }}>
            Workflow này tách ticket bảo trì khỏi trạng thái vận hành của phòng. Khi ticket có `blocksRoom`, backend sẽ đưa phòng sang `Disabled` cho tới lúc đóng ticket.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} style={{ height: 42, padding: "0 16px", borderRadius: 12, border: "1px solid #d6d3d1", background: "#fff", fontWeight: 700, cursor: "pointer" }}>
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      {errorMessage ? <div style={{ ...cardStyle, marginBottom: 20, padding: 14, color: "#b91c1c", background: "#fff7f7", borderColor: "#fecaca" }}>{errorMessage}</div> : null}

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <article style={{ ...cardStyle, padding: 22 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 18, color: "#1c1917", fontWeight: 800 }}>Tạo ticket bảo trì</h3>
          <form onSubmit={handleCreate} style={{ display: "grid", gap: 12 }}>
            <select value={form.roomId} onChange={(e) => setForm((prev) => ({ ...prev, roomId: e.target.value }))} style={inputStyle} required>
              <option value="">Chọn phòng</option>
              {roomOptions.map((room) => (
                <option key={room.id} value={room.id}>Phòng {room.roomNumber} - {room.roomTypeName || "Chưa có loại"}</option>
              ))}
            </select>
            <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Tiêu đề sự cố" style={inputStyle} required />
            <textarea value={form.reason} onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))} placeholder="Mô tả / nguyên nhân" style={{ ...inputStyle, minHeight: 84, resize: "vertical" }} required />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} style={inputStyle}>
                <option value="Repair">Repair</option>
                <option value="Inspection">Inspection</option>
                <option value="Preventive">Preventive</option>
              </select>
              <select value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))} style={inputStyle}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <select value={form.assignedToUserId} onChange={(e) => setForm((prev) => ({ ...prev, assignedToUserId: e.target.value }))} style={inputStyle}>
                <option value="">Chưa phân công</option>
                {staffOptions.map((user) => (
                  <option key={user.id} value={user.id}>{user.fullName}</option>
                ))}
              </select>
              <input type="datetime-local" value={form.expectedDoneAt} onChange={(e) => setForm((prev) => ({ ...prev, expectedDoneAt: e.target.value }))} style={inputStyle} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#44403c", fontWeight: 700 }}>
              <input type="checkbox" checked={form.blocksRoom} onChange={(e) => setForm((prev) => ({ ...prev, blocksRoom: e.target.checked }))} />
              Block phòng ngay khi mở ticket
            </label>
            <button type="submit" disabled={saving} style={{ height: 42, borderRadius: 12, border: "none", background: "#4f645b", color: "#ecfdf5", fontWeight: 800, cursor: "pointer" }}>
              {saving ? "Đang lưu..." : "Tạo ticket"}
            </button>
          </form>
        </article>

        <article style={{ ...cardStyle, padding: 22 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 18, color: "#1c1917", fontWeight: 800 }}>Quy trình đề xuất</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              "Open: ghi nhận sự cố, có thể chưa block phòng.",
              "InProgress: kỹ thuật bắt đầu xử lý, nếu ticket block phòng thì phòng phải ở Disabled.",
              "Resolved: kỹ thuật báo sửa xong, chưa mở bán lại ngay.",
              "Closed: vận hành xác nhận hoàn tất, backend bỏ Disabled và đưa phòng về Available + Dirty.",
              "Cancelled: ticket tạo nhầm hoặc không còn cần xử lý.",
            ].map((line) => (
              <div key={line} style={{ background: "#faf8f3", borderRadius: 14, padding: 14, color: "#44403c", lineHeight: 1.6 }}>
                {line}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1ece2", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <strong style={{ color: "#1c1917", fontSize: 18 }}>Danh sách ticket bảo trì</strong>
          <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} style={{ ...inputStyle, width: 180 }}>
            <option value="">Tất cả trạng thái</option>
            <option value="Open">Open</option>
            <option value="InProgress">InProgress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#faf8f3", borderBottom: "1px solid #f1ece2" }}>
                {["Phòng", "Ticket", "Phụ trách", "Thời gian", "Trạng thái", "Ghi chú đóng", "Cập nhật"].map((title) => (
                  <th key={title} style={{ padding: "14px 18px", textAlign: "left", color: "#78716c", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em" }}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>Chưa có ticket bảo trì nào.</td></tr>
              ) : rows.map((ticket) => {
                const meta = statusMeta[ticket.status] || statusMeta.Open;
                return (
                  <tr key={ticket.id} style={{ borderBottom: "1px solid #f7f4ee", verticalAlign: "top" }}>
                    <td style={{ padding: "16px 18px" }}>
                      <div style={{ color: "#1c1917", fontWeight: 800 }}>Phòng {ticket.roomNumber}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{ticket.roomTypeName || "—"}</div>
                      <div style={{ marginTop: 6, color: ticket.blocksRoom ? "#b45309" : "#6b7280", fontSize: 12, fontWeight: 700 }}>
                        {ticket.blocksRoom ? "Đang block phòng" : "Không block phòng"}
                      </div>
                    </td>
                    <td style={{ padding: "16px 18px" }}>
                      <div style={{ color: "#1c1917", fontWeight: 800 }}>{ticket.title}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{ticket.reason}</div>
                      <div style={{ marginTop: 6, color: "#57534e", fontSize: 12, fontWeight: 700 }}>{ticket.category || "—"} • {ticket.priority}</div>
                    </td>
                    <td style={{ padding: "16px 18px", color: "#57534e" }}>
                      <div>Báo cáo: {ticket.reportedBy?.fullName || "—"}</div>
                      <div style={{ marginTop: 6 }}>Xử lý: {ticket.assignedTo?.fullName || "Chưa gán"}</div>
                    </td>
                    <td style={{ padding: "16px 18px", color: "#57534e", fontSize: 13 }}>
                      <div>Mở: {fmtDateTime(ticket.openedAt)}</div>
                      <div style={{ marginTop: 6 }}>ETA: {fmtDateTime(ticket.expectedDoneAt)}</div>
                      <div style={{ marginTop: 6 }}>Resolved: {fmtDateTime(ticket.resolvedAt)}</div>
                    </td>
                    <td style={{ padding: "16px 18px" }}>
                      <span style={{ padding: "6px 10px", borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 800 }}>{ticket.status}</span>
                    </td>
                    <td style={{ padding: "16px 18px" }}>
                      <textarea
                        value={statusNotes[ticket.id] || ticket.resolutionNote || ""}
                        onChange={(e) => setStatusNotes((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                        placeholder="Ghi chú khi xử lý / đóng ticket"
                        style={{ ...inputStyle, minHeight: 82, resize: "vertical" }}
                      />
                    </td>
                    <td style={{ padding: "16px 18px" }}>
                      <div style={{ display: "grid", gap: 8 }}>
                        {["InProgress", "Resolved", "Closed", "Cancelled"].map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => handleStatusUpdate(ticket.id, status)}
                            disabled={saving || ticket.status === status}
                            style={{
                              height: 34,
                              borderRadius: 10,
                              border: "1px solid #d6d3d1",
                              background: "#fff",
                              fontWeight: 700,
                              cursor: "pointer",
                              opacity: ticket.status === status ? 0.5 : 1,
                            }}
                          >
                            {status}
                          </button>
                        ))}
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
