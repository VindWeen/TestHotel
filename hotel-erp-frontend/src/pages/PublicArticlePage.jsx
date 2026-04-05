import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getArticleBySlug } from "../api/articlesApi";

export default function PublicArticlePage() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await getArticleBySlug(slug);
        if (!cancelled) setArticle(res.data);
      } catch {
        if (!cancelled) setArticle(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const mapEmbedUrl = useMemo(() => {
    const attraction = article?.attraction;
    if (!attraction) return "";
    if (attraction.mapEmbedLink) return attraction.mapEmbedLink;
    if (attraction.latitude != null && attraction.longitude != null) {
      return `https://www.google.com/maps?q=${attraction.latitude},${attraction.longitude}&z=15&output=embed`;
    }
    return "";
  }, [article]);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f5ef", color: "#6b7280", fontFamily: "'Manrope', sans-serif" }}>Đang tải bài viết...</div>;
  }

  if (!article) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f5ef", color: "#6b7280", fontFamily: "'Manrope', sans-serif" }}>Không tìm thấy bài viết.</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f5efe4 0%, #faf7f1 220px, #fcfbf8 220px)", color: "#1f2937", fontFamily: "'Manrope', sans-serif" }}>
      <header style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px 28px" }}>
        <Link to="/articles" style={{ color: "#4f645b", textDecoration: "none", fontWeight: 700 }}>← Quay lại danh sách bài viết</Link>
        <div style={{ marginTop: 18, fontSize: 13, color: "#6b7280" }}>
          {article.category?.name || "Chưa phân loại"}{article.publishedAt ? ` • ${new Date(article.publishedAt).toLocaleDateString("vi-VN")}` : ""}
        </div>
        <h1 style={{ margin: "14px 0 0", fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.05, letterSpacing: "-0.04em", color: "#111827" }}>{article.title}</h1>
        {article.metaDescription ? (
          <p style={{ margin: "18px 0 0", maxWidth: 760, fontSize: 18, lineHeight: 1.7, color: "#4b5563" }}>{article.metaDescription}</p>
        ) : null}
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px 72px" }}>
        <div style={{ display: "grid", gridTemplateColumns: article.attraction ? "minmax(0, 1fr) 360px" : "minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
          <article style={{ background: "white", borderRadius: 28, border: "1px solid #ede7dd", boxShadow: "0 20px 60px rgba(17,24,39,.06)", overflow: "hidden" }}>
            {article.thumbnailUrl ? (
              <img src={article.thumbnailUrl} alt={article.title} style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }} />
            ) : null}
            <div style={{ padding: "36px clamp(22px, 5vw, 72px) 48px" }}>
              <div dangerouslySetInnerHTML={{ __html: article.content || "<p>Chưa có nội dung.</p>" }} />
            </div>
          </article>

          {article.attraction ? (
            <aside style={{ display: "grid", gap: 16 }}>
              <section style={{ background: "white", borderRadius: 24, border: "1px solid #ede7dd", boxShadow: "0 20px 60px rgba(17,24,39,.06)", overflow: "hidden", position: "sticky", top: 24 }}>
                <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1ede6", background: "#fbfaf7" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#4f645b" }}>Địa điểm liên kết</div>
                  <h3 style={{ margin: "10px 0 0", fontSize: 24, lineHeight: 1.2, color: "#111827" }}>{article.attraction.name}</h3>
                  {article.attraction.category ? <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 14 }}>{article.attraction.category}</p> : null}
                </div>
                <div style={{ padding: 20, display: "grid", gap: 16 }}>
                  {article.attraction.imageUrl ? <img src={article.attraction.imageUrl} alt={article.attraction.name} style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 18, border: "1px solid #ede7dd" }} /> : null}
                  {article.attraction.address ? <div style={{ color: "#374151", lineHeight: 1.7 }}>{article.attraction.address}</div> : null}
                  {mapEmbedUrl ? (
                    <iframe title={`map-${article.attraction.id}`} src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ width: "100%", height: 220, border: "none", borderRadius: 18 }} />
                  ) : null}
                  <Link to={`/attractions/${article.attraction.id}`} style={{ textDecoration: "none", color: "#2f5d4d", fontWeight: 700 }}>
                    Xem chi tiết địa điểm
                  </Link>
                </div>
              </section>
            </aside>
          ) : null}
        </div>
      </main>
    </div>
  );
}
