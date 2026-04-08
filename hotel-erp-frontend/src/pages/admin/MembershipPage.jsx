import { useCallback, useEffect, useMemo, useState } from "react";
import { getMemberships } from "../../api/membershipsApi";
import {
  getLoyaltyMemberById,
  getLoyaltyMemberTransactions,
  getLoyaltyMembers,
} from "../../api/loyaltyMembersApi";

const card = {
  background: "#fff",
  border: "1px solid #ece7de",
  borderRadius: 20,
  boxShadow: "0 10px 30px rgba(28,25,23,.05)",
};

const input = {
  width: "100%",
  background: "#fcfbf8",
  border: "1px solid #e7e2d8",
  borderRadius: 14,
  padding: "11px 14px",
  fontSize: 14,
  boxSizing: "border-box",
};

const label = {
  display: "block",
  marginBottom: 8,
  color: "#78716c",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: ".12em",
};

const primaryBtn = {
  padding: "10px 16px",
  borderRadius: 14,
  border: "none",
  background: "#4f645b",
  color: "#ecfdf5",
  fontWeight: 800,
  cursor: "pointer",
};

const ghostBtn = {
  padding: "10px 16px",
  borderRadius: 14,
  border: "1px solid #e7e2d8",
  background: "#fff",
  color: "#57534e",
  fontWeight: 700,
  cursor: "pointer",
};

const sortOptions = [
  ["loyaltyPoints-desc", "Điểm tích lũy giảm dần"],
  ["loyaltyPoints-asc", "Điểm tích lũy tăng dần"],
  ["usablePoints-desc", "Điểm khả dụng giảm dần"],
  ["createdAt-desc", "Mới tham gia gần đây"],
  ["fullname-asc", "Tên A-Z"],
  ["tier-asc", "Hạng A-Z"],
];

const statThemes = {
  spotlight: {
    background: "linear-gradient(135deg, #4f645b 0%, #2f433c 100%)",
    border: "#3f564d",
    title: "#c7f2de",
    value: "#f3fff8",
    helper: "rgba(231,254,243,.82)",
    orb: "rgba(167,243,208,.22)",
  },
  members: {
    background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
    border: "#fdba74",
    title: "#c2410c",
    value: "#9a3412",
    helper: "#9a3412",
    orb: "rgba(251,146,60,.18)",
  },
  points: {
    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    border: "#93c5fd",
    title: "#1d4ed8",
    value: "#1e3a8a",
    helper: "#1e40af",
    orb: "rgba(59,130,246,.16)",
  },
  usable: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
    border: "#6ee7b7",
    title: "#047857",
    value: "#065f46",
    helper: "#047857",
    orb: "rgba(16,185,129,.16)",
  },
  active: {
    background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
    border: "#f9a8d4",
    title: "#be185d",
    value: "#9d174d",
    helper: "#be185d",
    orb: "rgba(236,72,153,.14)",
  },
};

const defaultTierTheme = {
  background: "#f5f5f4",
  border: "#e7e5e4",
  text: "#57534e",
  dot: "#a8a29e",
  subtle: "#78716c",
};

const hexToRgb = (hex) => {
  const normalized = String(hex || "").trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbaFromHex = (hex, alpha) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const mixWithWhite = (hex, weight = 0.7) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const clampWeight = Math.max(0, Math.min(1, weight));
  const mix = (channel) => Math.round(channel + (255 - channel) * clampWeight);
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
};

const fmt = (v) => Number(v || 0).toLocaleString("vi-VN");
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("vi-VN") : "—");
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString("vi-VN") : "—");

const statusMeta = (s) =>
  s === true
    ? { label: "Hoạt động", bg: "#ecfdf5", color: "#047857" }
    : { label: "Đã khóa", bg: "#f5f5f4", color: "#78716c" };

const txMeta = (type, points) => {
  const normalized = String(type || "").toLowerCase();
  if (points > 0 || normalized === "earned") {
    return { label: "Cộng điểm", bg: "#ecfdf5", color: "#047857", sign: "+" };
  }
  if (normalized === "expired") {
    return { label: "Hết hạn", bg: "#fff7ed", color: "#9a3412", sign: "" };
  }
  return { label: "Trừ điểm", bg: "#fef2f2", color: "#b91c1c", sign: "" };
};

const getTierTheme = (name, colorHex) => {
  const normalized = String(name || "").trim().toLowerCase();

  if (!normalized || normalized.includes("chưa có hạng")) {
    return {
      background: "#f5f5f4",
      border: "#e7e5e4",
      text: "#57534e",
      dot: colorHex || "#a8a29e",
      subtle: "#78716c",
    };
  }

  if (normalized.includes("khách mới") || normalized.includes("guest") || normalized.includes("new")) {
    return {
      background: "#f3f4f6",
      border: "#d1d5db",
      text: "#4b5563",
      dot: colorHex || "#9ca3af",
      subtle: "#6b7280",
    };
  }

  if (normalized.includes("đồng") || normalized.includes("bronze")) {
    return {
      background: "#fff7ed",
      border: "#fdba74",
      text: "#c2410c",
      dot: colorHex || "#cd7f32",
      subtle: "#9a3412",
    };
  }

  if (normalized.includes("bạc") || normalized.includes("silver")) {
    const base = colorHex || "#c0c0c0";
    return {
      background:
        `linear-gradient(135deg, ${mixWithWhite(base, 0.38) || "#d8dee6"} 0%, ${mixWithWhite(base, 0.72) || "#edf2f7"} 100%)`,
      border: rgbaFromHex(base, 0.95) || "#94a3b8",
      text: "#334155",
      dot: base,
      subtle: "#475569",
    };
  }

  if (normalized.includes("vàng") || normalized.includes("gold")) {
    return {
      background: "#fefce8",
      border: "#fde047",
      text: "#a16207",
      dot: colorHex || "#ffd700",
      subtle: "#a16207",
    };
  }

  if (normalized.includes("bạch kim") || normalized.includes("platinum")) {
    const base = colorHex || "#e5e4e2";
    return {
      background:
        `linear-gradient(135deg, ${mixWithWhite(base, 0.2) || "#e7ebf0"} 0%, ${mixWithWhite(base, 0.58) || "#f5f8fb"} 100%)`,
      border: rgbaFromHex(base, 1) || "#b8c2cc",
      text: "#1f2937",
      dot: base,
      subtle: "#334155",
    };
  }

  if (normalized.includes("kim cương") || normalized.includes("diamond")) {
    return {
      background: "#ecfeff",
      border: "#a5f3fc",
      text: "#0f766e",
      dot: colorHex || "#b9f2ff",
      subtle: "#0f766e",
    };
  }

  if (normalized.includes("elite")) {
    return {
      background: "#f5f3ff",
      border: "#c4b5fd",
      text: "#6d28d9",
      dot: colorHex || "#7b68ee",
      subtle: "#7c3aed",
    };
  }

  if (normalized.includes("vvip")) {
    return {
      background: "#fff1f2",
      border: "#fda4af",
      text: "#be123c",
      dot: colorHex || "#dc143c",
      subtle: "#be123c",
    };
  }

  if (normalized.includes("vip")) {
    return {
      background: "#fff7ed",
      border: "#fdba74",
      text: "#ea580c",
      dot: colorHex || "#ff8c00",
      subtle: "#c2410c",
    };
  }

  if (normalized.includes("signature")) {
    return {
      background: "#ecfeff",
      border: "#99f6e4",
      text: "#115e59",
      dot: colorHex || "#2f4f4f",
      subtle: "#0f766e",
    };
  }

  return {
    ...defaultTierTheme,
    dot: colorHex || defaultTierTheme.dot,
  };
};

function TierBadge({ name, colorHex }) {
  const theme = getTierTheme(name, colorHex);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: theme.background,
        border: `1px solid ${theme.border}`,
        color: theme.text,
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: theme.dot,
          border: "1px solid rgba(0,0,0,.08)",
        }}
      />
      {name || "Chưa có hạng"}
    </span>
  );
}

function Stat({ title, value, helper, theme }) {
  const colors = statThemes[theme] || statThemes.members;
  return (
    <article
      style={{
        ...card,
        padding: 20,
        position: "relative",
        overflow: "hidden",
        background: colors.background,
        border: `1px solid ${colors.border}`,
        boxShadow: `0 16px 34px ${colors.orb}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -24,
          bottom: -34,
          width: 118,
          height: 118,
          borderRadius: "50%",
          background: colors.orb,
        }}
      />
      <div style={{ position: "relative" }}>
        <div style={{ color: colors.title, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em" }}>{title}</div>
        <div style={{ marginTop: 10, color: colors.value, fontWeight: 800, fontSize: 30 }}>{value}</div>
        <div style={{ marginTop: 8, color: colors.helper, fontSize: 13 }}>{helper}</div>
      </div>
    </article>
  );
}

export default function MembershipPage() {
  const [tiers, setTiers] = useState([]);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ totalMembers: 0, totalPoints: 0, totalUsablePoints: 0, activeMembers: 0, lockedMembers: 0, tierBreakdown: [] });
  const [pagination, setPagination] = useState({ currentPage: 1, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ keyword: "", membershipId: "", status: "", minPoints: "", maxPoints: "", sort: "loyaltyPoints-desc" });
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [member, setMember] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txSummary, setTxSummary] = useState({ totalTransactions: 0, earnedPoints: 0, spentPoints: 0 });

  useEffect(() => {
    let active = true;
    getMemberships({ page: 1, pageSize: 100 })
      .then((res) => {
        if (active) setTiers(res.data?.data || []);
      })
      .catch(() => {
        if (active) setTiers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const sort = useMemo(() => {
    const [sortBy, sortDir] = filters.sort.split("-");
    return { sortBy, sortDir };
  }, [filters.sort]);

  const tierColorMap = useMemo(
    () =>
      Object.fromEntries(
        tiers.map((tier) => [String(tier.tierName || "").trim().toLowerCase(), tier.colorHex || null]),
      ),
    [tiers],
  );

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await getLoyaltyMembers({
        page,
        pageSize: 10,
        keyword: filters.keyword.trim(),
        membershipId: filters.membershipId || null,
        status: filters.status || null,
        minPoints: filters.minPoints || null,
        maxPoints: filters.maxPoints || null,
        sortBy: sort.sortBy,
        sortDir: sort.sortDir,
      });
      setRows(res.data?.data || []);
      setSummary(res.data?.summary || { totalMembers: 0, totalPoints: 0, totalUsablePoints: 0, activeMembers: 0, lockedMembers: 0, tierBreakdown: [] });
      setPagination(res.data?.pagination || { currentPage: 1, totalItems: 0, totalPages: 0 });
    } catch (error) {
      setRows([]);
      setSummary({ totalMembers: 0, totalPoints: 0, totalUsablePoints: 0, activeMembers: 0, lockedMembers: 0, tierBreakdown: [] });
      setErrorMessage(error?.response?.data?.message || "Không thể tải danh sách khách hàng thành viên.");
    } finally {
      setLoading(false);
    }
  }, [filters.keyword, filters.membershipId, filters.status, filters.minPoints, filters.maxPoints, page, sort.sortBy, sort.sortDir]);

  useEffect(() => {
    const timer = setTimeout(() => loadMembers(), 220);
    return () => clearTimeout(timer);
  }, [loadMembers]);

  useEffect(() => {
    setPage(1);
  }, [filters.keyword, filters.membershipId, filters.status, filters.minPoints, filters.maxPoints, filters.sort]);

  const resetFilters = () => {
    setFilters({ keyword: "", membershipId: "", status: "", minPoints: "", maxPoints: "", sort: "loyaltyPoints-desc" });
  };

  const openDetail = async (id) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setMember(null);
    setTransactions([]);
    try {
      const [memberRes, txRes] = await Promise.all([
        getLoyaltyMemberById(id),
        getLoyaltyMemberTransactions(id),
      ]);
      setMember(memberRes.data || null);
      setTransactions(txRes.data?.data || []);
      setTxSummary(txRes.data?.summary || { totalTransactions: 0, earnedPoints: 0, spentPoints: 0 });
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Không thể tải chi tiết loyalty member.");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalPages = Math.max(1, pagination.totalPages || 1);

  return (
    <>
      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 28, color: "#1c1917", fontWeight: 800 }}>Khách hàng thành viên</h2>
            <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 14, maxWidth: 760, lineHeight: 1.65 }}>
              Theo dõi khách hàng có hạng thành viên hoặc đã phát sinh điểm loyalty, xem phân bố theo hạng và lịch sử cộng trừ điểm của từng người.
            </p>
          </div>
          <div style={{ ...card, padding: "14px 16px", minWidth: 260, background: statThemes.spotlight.background, border: `1px solid ${statThemes.spotlight.border}`, boxShadow: "0 18px 38px rgba(47,67,60,.22)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", background: statThemes.spotlight.orb, right: -30, top: -34 }} />
            <div style={{ position: "relative" }}>
              <div style={{ color: statThemes.spotlight.title, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em" }}>Tổng đang theo dõi</div>
              <div style={{ marginTop: 8, color: statThemes.spotlight.value, fontSize: 28, fontWeight: 800 }}>{fmt(summary.totalMembers)}</div>
              <div style={{ marginTop: 6, color: statThemes.spotlight.helper, fontSize: 13 }}>{fmt(summary.activeMembers)} hoạt động, {fmt(summary.lockedMembers)} đã khóa</div>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div style={{ ...card, marginBottom: 20, padding: 14, color: "#b91c1c", background: "#fff7f7", borderColor: "#fecaca" }}>
            {errorMessage}
          </div>
        ) : null}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
          <Stat title="Member Loyalty" value={fmt(summary.totalMembers)} helper="User có hạng thành viên hoặc có điểm loyalty." theme="members" />
          <Stat title="Tổng Điểm Tích Lũy" value={fmt(summary.totalPoints)} helper="Tổng điểm đang ghi nhận trên toàn bộ member." theme="points" />
          <Stat title="Điểm Khả Dụng" value={fmt(summary.totalUsablePoints)} helper="Phần điểm khách có thể sử dụng hiện tại." theme="usable" />
          <Stat title="Tỷ Lệ Hoạt Động" value={`${summary.totalMembers ? Math.round((summary.activeMembers / summary.totalMembers) * 100) : 0}%`} helper="Tỷ lệ account loyalty member còn hoạt động." theme="active" />
        </section>

        <section style={{ ...card, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, alignItems: "end" }}>
            <div>
              <label style={label}>Tìm khách hàng</label>
              <input value={filters.keyword} onChange={(e) => setFilters((p) => ({ ...p, keyword: e.target.value }))} style={input} placeholder="Tên, email, điện thoại hoặc hạng..." />
            </div>
            <div>
              <label style={label}>Hạng thành viên</label>
              <select value={filters.membershipId} onChange={(e) => setFilters((p) => ({ ...p, membershipId: e.target.value }))} style={input}>
                <option value="">Tất cả hạng</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>{t.tierName}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Trạng thái</label>
              <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} style={input}>
                <option value="">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="locked">Đã khóa</option>
              </select>
            </div>
            <div>
              <label style={label}>Điểm từ</label>
              <input type="number" min="0" value={filters.minPoints} onChange={(e) => setFilters((p) => ({ ...p, minPoints: e.target.value }))} style={input} placeholder="0" />
            </div>
            <div>
              <label style={label}>Điểm đến</label>
              <input type="number" min="0" value={filters.maxPoints} onChange={(e) => setFilters((p) => ({ ...p, maxPoints: e.target.value }))} style={input} placeholder="100000" />
            </div>
            <div>
              <label style={label}>Sắp xếp</label>
              <select value={filters.sort} onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value }))} style={input}>
                {sortOptions.map(([value, text]) => (
                  <option key={value} value={value}>{text}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ color: "#78716c", fontSize: 13 }}>Trang chỉ hiển thị user có hạng thành viên hoặc đã phát sinh điểm loyalty.</div>
            <button type="button" style={ghostBtn} onClick={resetFilters}>Xóa bộ lọc</button>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 250px", gap: 16, alignItems: "start" }}>
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f0ea" }}>
              <strong style={{ color: "#1c1917", fontSize: 16 }}>Danh sách loyalty member</strong>
              <p style={{ margin: "6px 0 0", color: "#78716c", fontSize: 13 }}>Hiển thị {fmt(rows.length)} / {fmt(pagination.totalItems)} khách hàng thành viên.</p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#faf8f3", borderBottom: "1px solid #f1f0ea" }}>
                    {["Khách hàng", "Hạng", "Điểm tích lũy", "Điểm khả dụng", "Giao dịch", "Trạng thái", "Ngày tham gia", "Thao tác"].map((h) => (
                      <th key={h} style={{ padding: "15px 24px", textAlign: "center", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#78716c" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={8} style={{ padding: 48, textAlign: "center", color: "#9ca3af" }}>Đang tải dữ liệu loyalty...</td></tr> : null}
                  {!loading && rows.length === 0 ? <tr><td colSpan={8} style={{ padding: 48, textAlign: "center", color: "#9ca3af" }}>Không có khách hàng nào khớp với bộ lọc hiện tại.</td></tr> : null}
                  {!loading && rows.map((row) => {
                    const status = statusMeta(row.status);
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f7f4ee" }}>
                        <td style={{ padding: "16px 24px" }}>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <div style={{ width: 42, height: 42, borderRadius: 999, background: "linear-gradient(135deg, #d6f5eb, #eefaf4)", color: "#14532d", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                              {(row.fullName || "?").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ color: "#1c1917", fontWeight: 700, fontSize: 14 }}>{row.fullName}</div>
                              <div style={{ color: "#6b7280", fontSize: 14 }}>{row.email || "—"}</div>
                              <div style={{ color: "#a8a29e", fontSize: 12 }}>{row.phone || "Chưa có số điện thoại"}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "16px 24px" }}><TierBadge name={row.membershipTier} colorHex={row.membershipColor} /></td>
                        <td style={{ padding: "16px 24px", color: "#1f2937", fontWeight: 800, fontSize: 14 }}>{fmt(row.loyaltyPoints)}</td>
                        <td style={{ padding: "16px 24px", color: "#0f766e", fontWeight: 800, fontSize: 14 }}>{fmt(row.loyaltyPointsUsable)}</td>
                        <td style={{ padding: "16px 24px", color: "#57534e", fontSize: 14 }}>{fmt(row.transactionCount)}</td>
                        <td style={{ padding: "16px 24px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 96,
                              padding: "6px 12px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 800,
                              lineHeight: 1,
                              whiteSpace: "nowrap",
                              background: status.bg,
                              color: status.color,
                              textTransform: "uppercase",
                              textAlign: "center",
                            }}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td style={{ padding: "16px 24px", color: "#57534e", fontSize: 14 }}><div>{fmtDate(row.createdAt)}</div><div style={{ color: "#a8a29e", fontSize: 12 }}>Cập nhật: {fmtDate(row.updatedAt)}</div></td>
                        <td style={{ padding: "16px 24px", textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => openDetail(row.id)}
                              style={{
                                padding: 8,
                                color: "#9ca3af",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                borderRadius: 8,
                                transition: "all .15s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#f3f4f6";
                                e.currentTarget.style.color = "#4f645b";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "";
                                e.currentTarget.style.color = "#9ca3af";
                              }}
                              title="Xem chi tiết"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                                visibility
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid #f1f0ea", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ color: "#78716c", fontSize: 13 }}>Trang {pagination.currentPage || 1} / {totalPages}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ ...ghostBtn, opacity: page <= 1 ? 0.5 : 1 }}>Trang trước</button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={{ ...ghostBtn, opacity: page >= totalPages ? 0.5 : 1 }}>Trang sau</button>
              </div>
            </div>
          </div>

          <aside style={{ ...card, padding: 20 }}>
            <div style={{ color: "#1c1917", fontSize: 16, fontWeight: 800 }}>Phân bố theo hạng</div>
            <p style={{ margin: "6px 0 18px", color: "#78716c", fontSize: 13, lineHeight: 1.6 }}>Snapshot nhanh để xem member đang tập trung ở hạng nào và tổng điểm đi kèm.</p>
            <div style={{ display: "grid", gap: 12 }}>
              {(summary.tierBreakdown || []).length === 0 ? <div style={{ color: "#a8a29e", fontSize: 14 }}>Chưa có dữ liệu breakdown.</div> : summary.tierBreakdown.map((item) => {
                const theme = getTierTheme(
                  item.tierName,
                  tierColorMap[String(item.tierName || "").trim().toLowerCase()],
                );
                return (
                  <div key={item.tierName} style={{ border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14, background: theme.background }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: theme.dot, border: "1px solid rgba(0,0,0,.08)" }} />
                      <div style={{ color: theme.text, fontWeight: 800, fontSize: 14 }}>{item.tierName}</div>
                    </div>
                    <div style={{ marginTop: 8, color: theme.subtle, fontSize: 13 }}>{fmt(item.memberCount)} member</div>
                    <div style={{ marginTop: 4, color: theme.subtle, fontSize: 13 }}>{fmt(item.totalPoints)} điểm tích lũy</div>
                    <div style={{ marginTop: 4, color: theme.text, fontSize: 13, fontWeight: 700 }}>{fmt(item.totalUsablePoints)} điểm khả dụng</div>
                  </div>
                );
              })}
            </div>
          </aside>
        </section>
      </div>

      {detailOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,.42)", backdropFilter: "blur(3px)", display: "flex", justifyContent: "flex-end", zIndex: 120 }} onClick={() => setDetailOpen(false)}>
          <div style={{ width: "min(720px,100%)", height: "100vh", background: "#fffdf9", borderLeft: "1px solid #efe7dc", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "24px 24px 18px", borderBottom: "1px solid #f1ece2", display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ color: "#78716c", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em" }}>Loyalty Member Detail</div>
                <h3 style={{ margin: "8px 0 0", fontSize: 24, color: "#1c1917" }}>{member?.fullName || "Đang tải..."}</h3>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#78716c" }}>Hồ sơ loyalty và lịch sử cộng trừ điểm của khách hàng.</p>
              </div>
              <button type="button" onClick={() => setDetailOpen(false)} style={ghostBtn}>Đóng</button>
            </div>

            {detailLoading ? <div style={{ padding: 40, color: "#9ca3af", textAlign: "center" }}>Đang tải chi tiết loyalty member...</div> : null}
            {!detailLoading && member ? (
              <div style={{ padding: 24 }}>
                <div style={{ ...card, padding: 20, marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: "#1c1917", fontSize: 22, fontWeight: 800 }}>{member.fullName}</div>
                      <div style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>{member.email || "—"}</div>
                      <div style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>{member.phone || "Chưa có số điện thoại"}</div>
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      <TierBadge name={member.membershipTier} colorHex={member.membershipColor} />
                      <span style={{ padding: "6px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: statusMeta(member.status).bg, color: statusMeta(member.status).color, textTransform: "uppercase" }}>{statusMeta(member.status).label}</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 18 }}>
                    {[
                      ["Điểm tích lũy", fmt(member.loyaltyPoints)],
                      ["Điểm khả dụng", fmt(member.loyaltyPointsUsable)],
                      ["Tổng giao dịch", fmt(member.transactionCount)],
                      ["Tổng booking", fmt(member.bookingCount)],
                      ["Booking hoàn tất", fmt(member.completedBookingCount)],
                      ["Lượt review", fmt(member.reviewCount)],
                      ["Lượt dùng voucher", fmt(member.voucherUsageCount)],
                      ["Giảm giá hạng", member.membershipDiscount != null ? `${member.membershipDiscount}%` : "—"],
                      ["Ngày tham gia", fmtDateTime(member.createdAt)],
                      ["Giao dịch gần nhất", fmtDateTime(member.lastTransactionAt)],
                      ["Giới tính", member.gender || "—"],
                      ["Ngày sinh", member.dateOfBirth || "—"],
                      ["CCCD / Hộ chiếu", member.nationalId || "—"],
                      ["Địa chỉ", member.address || "—"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background: "#f8f6f1", borderRadius: 14, padding: 12 }}>
                        <div style={{ color: "#a8a29e", fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 800 }}>{k}</div>
                        <div style={{ marginTop: 6, color: "#292524", fontSize: 14, fontWeight: 700 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ ...card, padding: 20 }}>
                  <div style={{ color: "#1c1917", fontWeight: 800, fontSize: 18 }}>Lịch sử cộng trừ điểm</div>
                  <div style={{ marginTop: 6, color: "#78716c", fontSize: 13 }}>{fmt(txSummary.totalTransactions)} giao dịch, cộng {fmt(txSummary.earnedPoints)} điểm, đã trừ {fmt(txSummary.spentPoints)} điểm.</div>
                  <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                    {transactions.length === 0 ? <div style={{ color: "#9ca3af" }}>Khách hàng này chưa có giao dịch loyalty nào.</div> : transactions.map((item) => {
                      const meta = txMeta(item.transactionType, item.points);
                      return (
                        <div key={item.id} style={{ border: "1px solid #efe9de", borderRadius: 16, padding: 16, background: "#fff" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                            <div>
                              <span style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>{meta.label}</span>
                              <div style={{ marginTop: 10, color: "#1c1917", fontSize: 16, fontWeight: 800 }}>{meta.sign}{fmt(item.points)} điểm</div>
                              <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>Số dư sau giao dịch: {fmt(item.balanceAfter)} điểm</div>
                            </div>
                            <div style={{ textAlign: "right", color: "#78716c", fontSize: 13 }}>
                              <div>{fmtDateTime(item.createdAt)}</div>
                              <div style={{ marginTop: 6 }}>Booking: {item.bookingCode || (item.bookingId ? `#${item.bookingId}` : "—")}</div>
                            </div>
                          </div>
                          {item.note ? <div style={{ marginTop: 12, color: "#44403c", fontSize: 14, lineHeight: 1.6 }}>{item.note}</div> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ ...card, padding: 20, marginTop: 18 }}>
                  <div style={{ color: "#1c1917", fontWeight: 800, fontSize: 18 }}>Tóm tắt CRM nội bộ</div>
                  <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
                    <div>
                      <div style={{ color: "#78716c", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Booking gần đây</div>
                      {(member.recentBookings || []).length === 0 ? (
                        <div style={{ color: "#9ca3af", fontSize: 14 }}>Chưa có booking gần đây.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {member.recentBookings.map((item) => (
                            <div key={`${item.bookingCode}-${item.id}`} style={{ border: "1px solid #efe9de", borderRadius: 14, padding: 12, background: "#fff" }}>
                              <div style={{ color: "#1c1917", fontWeight: 800 }}>{item.bookingCode}</div>
                              <div style={{ marginTop: 4, color: "#6b7280", fontSize: 13 }}>{item.status} • {fmtDateTime(item.checkInDate || item.createdAt)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ color: "#78716c", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Review gần đây</div>
                      {(member.recentReviews || []).length === 0 ? (
                        <div style={{ color: "#9ca3af", fontSize: 14 }}>Chưa có review gần đây.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {member.recentReviews.map((item) => (
                            <div key={item.id} style={{ border: "1px solid #efe9de", borderRadius: 14, padding: 12, background: "#fff" }}>
                              <div style={{ color: "#1c1917", fontWeight: 800 }}>Đánh giá {item.rating || 0}/5</div>
                              <div style={{ marginTop: 4, color: "#6b7280", fontSize: 13 }}>{fmtDateTime(item.createdAt)}</div>
                              <div style={{ marginTop: 8, color: "#44403c", fontSize: 14 }}>{item.comment || "Không có nội dung."}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ color: "#78716c", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Voucher gần dùng</div>
                      {(member.recentVoucherUsage || []).length === 0 ? (
                        <div style={{ color: "#9ca3af", fontSize: 14 }}>Chưa phát sinh voucher usage.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {member.recentVoucherUsage.map((item) => (
                            <div key={item.id} style={{ border: "1px solid #efe9de", borderRadius: 14, padding: 12, background: "#fff" }}>
                              <div style={{ color: "#1c1917", fontWeight: 800 }}>{item.voucherCode || `Voucher #${item.voucherId}`}</div>
                              <div style={{ marginTop: 4, color: "#6b7280", fontSize: 13 }}>{fmtDateTime(item.usedAt || item.createdAt)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
