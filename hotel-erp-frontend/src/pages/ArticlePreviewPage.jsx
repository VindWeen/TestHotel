import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getArticleBySlug } from "../api/articlesApi";

function getPreviewData() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("article-preview-draft");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ArticlePreviewPage() {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("slug");
  const draftArticle = useMemo(() => (slug ? null : getPreviewData()), [slug]);
  const [article, setArticle] = useState(draftArticle);
  const [loading, setLoading] = useState(Boolean(slug));

  useEffect(() => {
    if (!slug) {
      setArticle(draftArticle);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadArticle = async () => {
      setLoading(true);
      try {
        const res = await getArticleBySlug(slug);
        if (cancelled) return;
        const data = res.data;
        setArticle({
          title: data.title,
          categoryName: data.category?.name || "Chưa chọn danh mục",
          status: data.status || "Draft",
          metaDescription: data.metaDescription || "",
          content: data.content || "<p>Chưa có nội dung.</p>",
          attraction: data.attraction || null,
        });
      } catch {
        if (!cancelled) {
          setArticle(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadArticle();

    return () => {
      cancelled = true;
    };
  }, [slug, draftArticle]);

  const parsedArticle = useMemo(() => {
    if (!article) return { contentHtml: "", attractions: [] };
    if (typeof window === "undefined") {
      return { contentHtml: article.content || "", attractions: [] };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(article.content || "<p>Chưa có nội dung.</p>", "text/html");
    const attractionNodes = Array.from(doc.querySelectorAll(".article-attraction-block"));

    const attractions = attractionNodes.map((node, index) => {
      const dataset = node.dataset || {};
      const latitude = dataset.latitude ? Number(dataset.latitude) : null;
      const longitude = dataset.longitude ? Number(dataset.longitude) : null;
      const rawMapEmbedLink = dataset.mapEmbedLink || "";
      const mapEmbedUrl = rawMapEmbedLink
        ? rawMapEmbedLink
        : latitude != null && !Number.isNaN(latitude) && longitude != null && !Number.isNaN(longitude)
          ? `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`
          : "";

      node.remove();

      let nextElement = node.nextElementSibling;
      while (nextElement && nextElement.tagName === "P" && !nextElement.textContent?.trim()) {
        const emptyElement = nextElement;
        nextElement = nextElement.nextElementSibling;
        emptyElement.remove();
      }

      if (nextElement?.tagName === "P") {
        const noteText = nextElement.textContent?.trim() || "";
        if (noteText.startsWith("Đã liên kết địa điểm:")) {
          nextElement.remove();
        }
      }

      return {
        id: dataset.attractionId || `attraction-${index + 1}`,
        name: dataset.name || "Địa điểm liên kết",
        category: dataset.category || "",
        address: dataset.address || "",
        imageUrl: dataset.imageUrl || "",
        mapEmbedLink: rawMapEmbedLink,
        latitude,
        longitude,
        mapEmbedUrl,
      };
    });

    const attractionCards = article.attraction ? [article.attraction] : attractions;

    return {
      contentHtml: doc.body.innerHTML || "<p>Chưa có nội dung.</p>",
      attractions: attractionCards,
    };
  }, [article]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f5ef",
          color: "#6b7280",
          fontFamily: "'Manrope', sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        Đang tải bài viết...
      </div>
    );
  }

  if (!article) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f5ef",
          color: "#6b7280",
          fontFamily: "'Manrope', sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        {slug
          ? "Không thể tải bài viết để xem."
          : "Không có dữ liệu preview. Hãy quay lại popup bài viết và bấm `Mở trang preview`."}
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f5efe4 0%, #f9f7f1 220px, #fcfbf8 220px, #fcfbf8 100%)",
        color: "#1f2937",
        fontFamily: "'Manrope', sans-serif",
      }}
    >
      <header
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "56px 24px 28px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 14px",
            borderRadius: 999,
            background: "#ffffffcc",
            border: "1px solid #eadfce",
            color: "#6b7280",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Preview bài viết
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
            {article.categoryName || "Chưa chọn danh mục"} • {article.status || "Draft"}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(34px, 5vw, 56px)",
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              color: "#111827",
            }}
          >
            {article.title || "Bài viết chưa có tiêu đề"}
          </h1>
          {article.metaDescription ? (
            <p
              style={{
                margin: "18px 0 0",
                maxWidth: 720,
                fontSize: 18,
                lineHeight: 1.7,
                color: "#4b5563",
              }}
            >
              {article.metaDescription}
            </p>
          ) : null}
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px 72px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: parsedArticle.attractions.length ? "minmax(0, 1fr) 360px" : "minmax(0, 1fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
        <article
          style={{
            background: "white",
            borderRadius: 28,
            border: "1px solid #ede7dd",
            boxShadow: "0 20px 60px rgba(17,24,39,.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid #f1ede6",
              background: "#fbfaf7",
              color: "#78716c",
              fontSize: 13,
            }}
          >
            Xem trước giao diện đọc bài như người dùng
          </div>

          <div
            style={{
              padding: "36px clamp(22px, 5vw, 72px) 48px",
            }}
          >
            <div
              className="article-preview-content"
              dangerouslySetInnerHTML={{ __html: parsedArticle.contentHtml }}
            />
          </div>
        </article>
          {parsedArticle.attractions.length ? (
            <aside style={{ display: "grid", gap: 16 }}>
              {parsedArticle.attractions.map((attraction) => (
                (() => {
                  const latitude = attraction.latitude != null ? Number(attraction.latitude) : null;
                  const longitude = attraction.longitude != null ? Number(attraction.longitude) : null;
                  const mapEmbedUrl =
                    attraction.mapEmbedUrl ||
                    (latitude != null && !Number.isNaN(latitude) && longitude != null && !Number.isNaN(longitude)
                      ? `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`
                      : "");

                  return (
                    <section
                      key={attraction.id}
                      style={{
                        background: "white",
                        borderRadius: 24,
                        border: "1px solid #ede7dd",
                        boxShadow: "0 20px 60px rgba(17,24,39,.06)",
                        overflow: "hidden",
                        position: "sticky",
                        top: 24,
                      }}
                    >
                      <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1ede6", background: "#fbfaf7" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#4f645b" }}>
                          Địa điểm liên kết
                        </div>
                        <h3 style={{ margin: "10px 0 0", fontSize: 24, lineHeight: 1.2, color: "#111827" }}>
                          {attraction.name}
                        </h3>
                        {attraction.category ? (
                          <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 14 }}>{attraction.category}</p>
                        ) : null}
                      </div>
                      <div style={{ padding: 20, display: "grid", gap: 16 }}>
                        {attraction.imageUrl ? (
                          <img
                            src={attraction.imageUrl}
                            alt={attraction.name}
                            style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 18, border: "1px solid #ede7dd" }}
                          />
                        ) : null}
                        {attraction.address ? (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b7280" }}>
                              Địa chỉ
                            </div>
                            <div style={{ marginTop: 6, color: "#374151", lineHeight: 1.7 }}>{attraction.address}</div>
                          </div>
                        ) : null}
                        {mapEmbedUrl ? (
                          <iframe
                            title={`attraction-map-${attraction.id}`}
                            src={mapEmbedUrl}
                            loading="lazy"
                            style={{ width: "100%", height: 260, border: "1px solid #ede7dd", borderRadius: 18 }}
                          />
                        ) : (
                          <div style={{ padding: 18, borderRadius: 16, background: "#f8fafc", color: "#94a3b8", textAlign: "center" }}>
                            Địa điểm này chưa có tọa độ để hiển thị bản đồ.
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })()
              ))}
            </aside>
          ) : null}
        </div>
      </main>

      <style>{`
        .article-preview-content {
          font-size: 18px;
          line-height: 1.9;
          color: #374151;
          word-break: break-word;
        }
        .article-preview-content h1,
        .article-preview-content h2,
        .article-preview-content h3,
        .article-preview-content h4 {
          color: #111827;
          line-height: 1.2;
          margin: 1.8em 0 0.75em;
          letter-spacing: -0.03em;
        }
        .article-preview-content h2 {
          font-size: 34px;
        }
        .article-preview-content h3 {
          font-size: 26px;
        }
        .article-preview-content p {
          margin: 1em 0;
        }
        .article-preview-content img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 1.5em auto;
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(17,24,39,.10);
        }
        .article-preview-content ul,
        .article-preview-content ol {
          padding-left: 1.5em;
          margin: 1em 0;
        }
        .article-preview-content blockquote {
          margin: 1.6em 0;
          padding: 0.8em 1.2em;
          border-left: 4px solid #4f645b;
          background: #f7faf8;
          color: #4b5563;
        }
        .article-preview-content a {
          color: #0f766e;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
