import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAttractionById } from "../api/attractionsApi";

export default function PublicAttractionDetailPage() {
  const { id } = useParams();
  const [attraction, setAttraction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await getAttractionById(id);
        if (!cancelled) setAttraction(res.data);
      } catch {
        if (!cancelled) setAttraction(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const mapEmbedUrl = useMemo(() => {
    if (!attraction) return "";
    if (attraction.mapEmbedLink) return attraction.mapEmbedLink;
    if (attraction.latitude != null && attraction.longitude != null) {
      return `https://www.google.com/maps?q=${attraction.latitude},${attraction.longitude}&z=15&output=embed`;
    }
    return "";
  }, [attraction]);

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f5ef", color: "#6b7280", fontFamily: "'Manrope', sans-serif" }}>Đang tải địa điểm...</div>;
  if (!attraction) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f5ef", color: "#6b7280", fontFamily: "'Manrope', sans-serif" }}>Không tìm thấy địa điểm.</div>;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f5efe4 0%, #faf7f1 220px, #fcfbf8 220px)", color: "#1f2937", fontFamily: "'Manrope', sans-serif" }}>
      <header style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px 28px" }}>
        <Link to="/attractions" style={{ color: "#4f645b", textDecoration: "none", fontWeight: 700 }}>← Quay lại danh sách địa điểm</Link>
        <div style={{ marginTop: 18, fontSize: 13, color: "#6b7280" }}>{attraction.category || "Địa điểm"}</div>
        <h1 style={{ margin: "14px 0 0", fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.05, letterSpacing: "-0.04em", color: "#111827" }}>{attraction.name}</h1>
        {attraction.address ? <p style={{ margin: "18px 0 0", maxWidth: 760, fontSize: 18, lineHeight: 1.7, color: "#4b5563" }}>{attraction.address}</p> : null}
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 72px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 24, alignItems: "start" }}>
          <section style={{ background: "white", borderRadius: 28, border: "1px solid #ede7dd", boxShadow: "0 20px 60px rgba(17,24,39,.06)", overflow: "hidden" }}>
            {attraction.imageUrl ? <img src={attraction.imageUrl} alt={attraction.name} style={{ width: "100%", maxHeight: 440, objectFit: "cover", display: "block" }} /> : null}
            <div style={{ padding: "28px 30px 34px" }}>
              <div style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Mô tả</div>
              <div style={{ marginTop: 12, color: "#374151", lineHeight: 1.8 }}>{attraction.description || "Chưa có mô tả chi tiết."}</div>
            </div>
          </section>
          <aside style={{ background: "white", borderRadius: 24, border: "1px solid #ede7dd", boxShadow: "0 20px 60px rgba(17,24,39,.06)", overflow: "hidden", position: "sticky", top: 24 }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1ede6", background: "#fbfaf7" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#4f645b" }}>Bản đồ</div>
            </div>
            <div style={{ padding: 20, display: "grid", gap: 16 }}>
              {mapEmbedUrl ? <iframe title={`map-${attraction.id}`} src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ width: "100%", height: 300, border: "none", borderRadius: 18 }} /> : <div style={{ color: "#9ca3af" }}>Chưa có dữ liệu bản đồ.</div>}
              {attraction.distanceKm != null ? <div style={{ color: "#374151" }}>Khoảng cách tham khảo: <strong>{attraction.distanceKm} km</strong></div> : null}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
