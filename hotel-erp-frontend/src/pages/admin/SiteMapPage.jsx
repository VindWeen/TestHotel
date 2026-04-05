import { useEffect, useMemo, useState } from "react";
import { getAttractions } from "../../api/attractionsApi";

const cardStyle = {
  background: "white",
  borderRadius: 18,
  border: "1px solid #f1f0ea",
  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
};

function buildMapUrl(item) {
  if (!item) return "";
  if (item.mapEmbedLink) return item.mapEmbedLink;
  if (item.latitude != null && item.longitude != null) {
    return `https://www.google.com/maps?q=${item.latitude},${item.longitude}&z=15&output=embed`;
  }
  return "";
}

export default function SiteMapPage() {
  const [items, setItems] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getAttractions();
        const data = res.data?.data || [];
        setItems(data);
        if (data.length > 0) setSelectedId(data[0].id);
      } catch (e) {
        setError(e?.response?.data?.message || "Không thể tải dữ liệu site map.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      [item.name, item.address, item.category]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [items, keyword]);

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null;
  const embedUrl = buildMapUrl(selected);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, color: "#1c1917", fontWeight: 700 }}>Site Map</h2>
        <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
          Xem nhanh danh sách địa điểm, tọa độ thực tế và bản đồ nhúng để kiểm tra dữ liệu.
        </p>
      </div>

      {error ? <div style={{ ...cardStyle, padding: 14, marginBottom: 20, color: "#b91c1c", background: "#fff7f7" }}>{error}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "360px minmax(0, 1fr)", gap: 24 }}>
        <section style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: 18, borderBottom: "1px solid #f1f0ea" }}>
            <strong>Danh sách điểm đến</strong>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên, địa chỉ, danh mục..."
              style={{ width: "100%", marginTop: 12, background: "#f9f8f3", border: "1px solid #e2e8e1", borderRadius: 12, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ maxHeight: 620, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Đang tải dữ liệu...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Không có địa điểm phù hợp.</div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: 16,
                    border: "none",
                    borderBottom: "1px solid #f7f4ee",
                    background: selected?.id === item.id ? "#f8fafc" : "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#1c1917" }}>{item.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#78716c" }}>{item.category || "-"} • {item.distanceKm ?? "-"} km</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#57534e" }}>{item.address || "-"}</div>
                </button>
              ))
            )}
          </div>
        </section>

        <section style={{ ...cardStyle, padding: 20 }}>
          {selected ? (
            <>
              <div style={{ marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: 22, color: "#1c1917" }}>{selected.name}</h3>
                <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 14 }}>{selected.address || "Chưa có địa chỉ."}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 18 }}>
                <div style={{ padding: 14, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#64748b", fontWeight: 700 }}>Latitude</div>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{selected.latitude ?? "-"}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#64748b", fontWeight: 700 }}>Longitude</div>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{selected.longitude ?? "-"}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#64748b", fontWeight: 700 }}>Khoảng cách</div>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{selected.distanceKm ?? "-"} km</div>
                </div>
              </div>
              {embedUrl ? (
                <iframe
                  title={`map-${selected.id}`}
                  src={embedUrl}
                  style={{ width: "100%", height: 420, border: "1px solid #e5e7eb", borderRadius: 18 }}
                  loading="lazy"
                />
              ) : (
                <div style={{ padding: 32, textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: 18, color: "#94a3b8" }}>
                  Địa điểm này chưa có `mapEmbedLink` hoặc tọa độ đầy đủ để hiển thị bản đồ.
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Chọn một địa điểm để xem site map.</div>
          )}
        </section>
      </div>
    </div>
  );
}
