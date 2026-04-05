import { useEffect, useState } from "react";
import { getReviews } from "../api/reviewsApi";

export default function PublicReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await getReviews({ page: 1, pageSize: 18 });
        if (!cancelled) {
          setReviews(res.data?.data || []);
          setAvgRating(res.data?.avgRating || 0);
        }
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
        <h1 style={{ margin: "14px 0 0", fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.05, letterSpacing: "-0.04em" }}>Đánh giá từ khách lưu trú</h1>
        <p style={{ margin: "16px 0 0", maxWidth: 720, fontSize: 18, lineHeight: 1.7, color: "#4b5563" }}>Điểm trung bình hiện tại: <strong>{avgRating}/5</strong></p>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 72px" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Đang tải đánh giá...</div>
        ) : reviews.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", background: "white", borderRadius: 24, border: "1px solid #ede7dd" }}>Chưa có đánh giá công khai.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {reviews.map((review) => (
              <article key={review.id} style={{ background: "white", borderRadius: 24, border: "1px solid #ede7dd", overflow: "hidden", boxShadow: "0 14px 40px rgba(17,24,39,.05)" }}>
                {review.imageUrl ? <img src={review.imageUrl} alt="Review" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} /> : null}
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#d97706" }}>{"★".repeat(review.rating)}{"☆".repeat(Math.max(0, 5 - review.rating))}</div>
                  <div style={{ marginTop: 8, fontWeight: 700, color: "#111827" }}>{review.user?.fullName || "Khách lưu trú"}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>{review.roomType?.name || "Không rõ hạng phòng"}</div>
                  {review.comment ? <p style={{ margin: "12px 0 0", color: "#4b5563", lineHeight: 1.7 }}>{review.comment}</p> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
