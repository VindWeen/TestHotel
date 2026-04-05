import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAttractions } from "../api/attractionsApi";

export default function PublicAttractionsPage() {
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await getAttractions();
        if (!cancelled) setAttractions(res.data?.data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f5efe4 0%, #faf7f1 220px, #fcfbf8 220px)", color: "#1f2937", fontFamily: "'Manrope', sans-serif" }}>
      <header style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px 28px" }}>
        <div style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Public Demo</div>
        <h1 style={{ margin: "14px 0 0", fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.05, letterSpacing: "-0.04em" }}>Địa điểm nổi bật</h1>
        <p style={{ margin: "16px 0 0", maxWidth: 720, fontSize: 18, lineHeight: 1.7, color: "#4b5563" }}>Danh sách địa điểm công khai để demo cụm CMS Attractions + Site Map.</p>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 72px" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Đang tải địa điểm...</div>
        ) : attractions.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", background: "white", borderRadius: 24, border: "1px solid #ede7dd" }}>Chưa có địa điểm công khai.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {attractions.map((attraction) => (
              <Link key={attraction.id} to={`/attractions/${attraction.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <article style={{ background: "white", borderRadius: 24, border: "1px solid #ede7dd", overflow: "hidden", boxShadow: "0 14px 40px rgba(17,24,39,.05)", height: "100%" }}>
                  <div style={{ height: 200, background: "linear-gradient(135deg, #ece7df, #f8f5ef)" }}>
                    {attraction.imageUrl ? <img src={attraction.imageUrl} alt={attraction.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{attraction.category || "Địa điểm"}</div>
                    <h3 style={{ margin: "10px 0 0", fontSize: 22, lineHeight: 1.25, color: "#111827" }}>{attraction.name}</h3>
                    {attraction.address ? <p style={{ margin: "10px 0 0", color: "#4b5563", lineHeight: 1.7 }}>{attraction.address}</p> : null}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
