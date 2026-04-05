import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getArticles } from "../api/articlesApi";

const shellStyle = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f5efe4 0%, #faf7f1 220px, #fcfbf8 220px)",
  fontFamily: "'Manrope', sans-serif",
  color: "#1f2937",
};

export default function PublicArticlesPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await getArticles({ page: 1, pageSize: 24 });
        if (!cancelled) {
          setArticles(res.data?.data || []);
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
    <div style={shellStyle}>
      <header style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px 28px" }}>
        <div style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>
          Public Demo
        </div>
        <h1 style={{ margin: "14px 0 0", fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.05, letterSpacing: "-0.04em" }}>
          Bài viết khách sạn
        </h1>
        <p style={{ margin: "16px 0 0", maxWidth: 720, fontSize: 18, lineHeight: 1.7, color: "#4b5563" }}>
          Danh sách bài viết đã xuất bản để demo phần CMS public của hệ thống.
        </p>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 72px" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Đang tải bài viết...</div>
        ) : articles.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", background: "white", borderRadius: 24, border: "1px solid #ede7dd" }}>
            Chưa có bài viết công khai.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {articles.map((article) => (
              <Link
                key={article.id}
                to={`/articles/${article.slug}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <article style={{ background: "white", borderRadius: 24, border: "1px solid #ede7dd", overflow: "hidden", boxShadow: "0 14px 40px rgba(17,24,39,.05)", height: "100%" }}>
                  <div style={{ height: 190, background: "linear-gradient(135deg, #ece7df, #f8f5ef)" }}>
                    {article.thumbnailUrl ? (
                      <img src={article.thumbnailUrl} alt={article.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : null}
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                      {article.category?.name || "Chưa phân loại"}
                    </div>
                    <h3 style={{ margin: "10px 0 0", fontSize: 22, lineHeight: 1.25, color: "#111827" }}>{article.title}</h3>
                    {article.metaDescription ? (
                      <p style={{ margin: "10px 0 0", color: "#4b5563", lineHeight: 1.7 }}>{article.metaDescription}</p>
                    ) : null}
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
