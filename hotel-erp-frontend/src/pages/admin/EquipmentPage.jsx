import { useCallback, useEffect, useState } from "react";
import { getEquipments } from "../../api/equipmentsApi";

const fmtCurrency = (value) =>
  value == null ? "—" : new Intl.NumberFormat("vi-VN").format(value) + "đ";

const INPUT_STYLE = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #e2e8e1",
  background: "#fff",
  fontSize: 14,
  outline: "none",
};

export default function EquipmentPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    active: "all",
  });

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getEquipments({ includeInactive: true });
      setItems(res.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Không thể tải danh sách vật tư.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort();
  const filteredItems = items.filter((item) => {
    const search = filters.search.trim().toLowerCase();
    const matchesSearch =
      !search ||
      item.name?.toLowerCase().includes(search) ||
      item.itemCode?.toLowerCase().includes(search) ||
      item.supplier?.toLowerCase().includes(search);
    const matchesCategory = !filters.category || item.category === filters.category;
    const matchesActive =
      filters.active === "all" ||
      (filters.active === "active" && item.isActive) ||
      (filters.active === "inactive" && !item.isActive);
    return matchesSearch && matchesCategory && matchesActive;
  });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.category, filters.active]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#1c1917", margin: "0 0 6px" }}>
            Vật tư & Minibar
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            Tổng <strong style={{ color: "#1c1917" }}>{filteredItems.length}</strong> vật tư hiển thị từ bảng Equipments
          </p>
        </div>
        <button
          onClick={loadItems}
          style={{ padding: "10px 18px", borderRadius: 12, border: "1px solid #e2e8e1", background: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Làm mới
        </button>
      </div>

      <div style={{ background: "white", borderRadius: 18, padding: 20, border: "1px solid #f1f0ea", boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 20, display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}>
        <input
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          placeholder="Tìm theo tên, mã vật tư, nhà cung cấp..."
          style={INPUT_STYLE}
        />
        <select
          value={filters.category}
          onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
          style={INPUT_STYLE}
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select
          value={filters.active}
          onChange={(e) => setFilters((prev) => ({ ...prev, active: e.target.value }))}
          style={INPUT_STYLE}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Đã tắt</option>
        </select>
      </div>

      <div style={{ background: "white", borderRadius: 18, border: "1px solid #f1f0ea", boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
        {error ? (
          <div style={{ padding: 32, color: "#dc2626", fontWeight: 600 }}>{error}</div>
        ) : loading ? (
          <div style={{ padding: 32, color: "#6b7280" }}>Đang tải dữ liệu vật tư...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 32, color: "#6b7280" }}>Không có vật tư phù hợp bộ lọc.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
              <thead>
                <tr style={{ background: "#f9f8f3" }}>
                  {["Mã VT", "Tên vật tư", "Danh mục", "ĐVT", "Tổng", "Đang dùng", "Hỏng", "Thanh lý", "Tồn kho", "Giá gốc", "Đền bù", "Nhà cung cấp", "Trạng thái"].map((title) => (
                    <th key={title} style={{ padding: "14px 16px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#9ca3af", textAlign: "left", borderBottom: "1px solid #f1f0ea" }}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "16px", fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#4f645b" }}>{item.itemCode}</td>
                    <td style={{ padding: "16px", fontSize: 14, fontWeight: 700, color: "#1c1917" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover", border: "1px solid #f1f0ea" }} />
                        ) : (
                          <div style={{ width: 42, height: 42, borderRadius: 10, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>inventory_2</span>
                          </div>
                        )}
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "16px", fontSize: 13, color: "#475569" }}>{item.category || "—"}</td>
                    <td style={{ padding: "16px", fontSize: 13, color: "#475569" }}>{item.unit || "—"}</td>
                    <td style={{ padding: "16px", fontSize: 13, fontWeight: 700 }}>{item.totalQuantity ?? 0}</td>
                    <td style={{ padding: "16px", fontSize: 13, fontWeight: 700 }}>{item.inUseQuantity ?? 0}</td>
                    <td style={{ padding: "16px", fontSize: 13, fontWeight: 700 }}>{item.damagedQuantity ?? 0}</td>
                    <td style={{ padding: "16px", fontSize: 13, fontWeight: 700 }}>{item.liquidatedQuantity ?? 0}</td>
                    <td style={{ padding: "16px", fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{item.inStockQuantity ?? 0}</td>
                    <td style={{ padding: "16px", fontSize: 13, color: "#475569" }}>{fmtCurrency(item.basePrice)}</td>
                    <td style={{ padding: "16px", fontSize: 13, color: "#dc2626", fontWeight: 700 }}>{fmtCurrency(item.defaultPriceIfLost)}</td>
                    <td style={{ padding: "16px", fontSize: 13, color: "#475569" }}>{item.supplier || "—"}</td>
                    <td style={{ padding: "16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 9999, background: item.isActive ? "#ecfdf5" : "#f3f4f6", color: item.isActive ? "#059669" : "#6b7280" }}>
                        {item.isActive ? "Hoạt động" : "Đã tắt"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && !error && filteredItems.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, gap: 16, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
            Trang <strong style={{ color: "#1c1917" }}>{page}</strong> / {totalPages}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: "#6b7280", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.35 : 1 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
            </button>
            {Array.from({ length: totalPages }).map((_, index) => {
              const pageNumber = index + 1;
              const active = pageNumber === page;
              return (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "none",
                    cursor: active ? "default" : "pointer",
                    background: active ? "#4f645b" : "transparent",
                    color: active ? "#e7fef3" : "#6b7280",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {pageNumber}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: "#6b7280", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.35 : 1 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
