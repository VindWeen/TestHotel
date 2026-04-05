import { useEffect, useMemo, useRef, useState } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import {
  createArticle,
  getArticleBySlug,
  getArticles,
  toggleArticleActive,
  updateArticle,
  uploadArticleContentImage,
  uploadArticleThumbnail,
} from "../../api/articlesApi";
import {
  createArticleCategory,
  getArticleCategories,
  toggleArticleCategoryActive,
  updateArticleCategory,
} from "../../api/articleCategoriesApi";
import { getAttractions } from "../../api/attractionsApi";

const cardStyle = {
  background: "white",
  borderRadius: 18,
  border: "1px solid #f1f0ea",
  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
};

const inputStyle = {
  width: "100%",
  background: "#f9f8f3",
  border: "1px solid #e2e8e1",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#6b7280",
  marginBottom: 8,
};

const ARTICLE_VIEW_MODE_STORAGE_KEY = "admin_article_view_mode";
const ARTICLES_PER_PAGE = 12;

function formatDate(date) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleString("vi-VN");
  } catch {
    return date;
  }
}

function Overlay({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        padding: 24,
        background: "rgba(28,25,23,.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 100%)",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#fffdf9",
          borderRadius: 24,
          border: "1px solid #ede7dd",
          boxShadow: "0 24px 60px rgba(28,25,23,.18)",
        }}
      >
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #f1f0ea",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 22, color: "#1c1917" }}>{title}</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78716c" }}>
              Quản lý nội dung bài viết và xem trước ngay trong admin.
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function VisibilitySwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      title={checked ? "Đang hiện, bấm để ẩn" : "Đang ẩn, bấm để hiện lại"}
      style={{
        width: 54,
        height: 30,
        borderRadius: 999,
        border: "none",
        background: checked ? "#4f645b" : "#d6d3d1",
        position: "relative",
        cursor: "pointer",
        transition: "all .2s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 26 : 4,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 2px 6px rgba(0,0,0,.18)",
          transition: "all .2s ease",
        }}
      />
    </button>
  );
}

function QuillEditor({ value, onChange, onUploadImage, onOpenPreviewPage, editorRef }) {
  const editorHostRef = useRef(null);
  const quillRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    if (!editorHostRef.current || quillRef.current) return;

    quillRef.current = new Quill(editorHostRef.current, {
      theme: "snow",
      modules: {
        toolbar: {
          container: [
            [{ header: [2, 3, false] }],
            ["bold", "italic", "underline", "blockquote"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link", "image"],
            ["clean"],
          ],
          handlers: {
            image: () => imageInputRef.current?.click(),
          },
        },
      },
      placeholder: "Nhập nội dung bài viết...",
    });

    quillRef.current.on("text-change", () => {
      onChange(quillRef.current.root.innerHTML);
    });

    if (editorRef) {
      editorRef.current = quillRef.current;
    }
  }, [onChange]);

  useEffect(() => {
    if (!quillRef.current) return;
    const nextHtml = value || "";
    const currentHtml = quillRef.current.root.innerHTML;
    if (currentHtml !== nextHtml) {
      quillRef.current.root.innerHTML = nextHtml;
    }
  }, [value]);

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !quillRef.current) return;
    try {
      const imageUrl = await onUploadImage(file);
      if (!imageUrl) return;
      const range = quillRef.current.getSelection(true);
      const index = range?.index ?? quillRef.current.getLength();
      quillRef.current.insertEmbed(index, "image", imageUrl, "user");
      quillRef.current.setSelection(index + 1, 0);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div style={{ border: "1px solid #e2e8e1", borderRadius: 18, overflow: "hidden", background: "white" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 12px 0", background: "#fcfbf7", borderBottom: "1px solid #ece8df" }}>
        <button
          type="button"
          onClick={onOpenPreviewPage}
          style={{
            marginBottom: 10,
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid #e7e5e4",
            background: "white",
            color: "#57534e",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Mở trang preview
        </button>
      </div>
      <div ref={editorHostRef} style={{ minHeight: 320 }} />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
    </div>
  );
}

export default function ArticleAdminPage() {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("articles");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [articleSearch, setArticleSearch] = useState("");
  const [categoryVisibilityFilter, setCategoryVisibilityFilter] = useState("all");
  const [categorySearch, setCategorySearch] = useState("");
  const [viewMode, setViewMode] = useState(() => {
    const saved = sessionStorage.getItem(ARTICLE_VIEW_MODE_STORAGE_KEY);
    return saved === "grid" ? "grid" : "table";
  });
  const [page, setPage] = useState(1);
  const [categoryName, setCategoryName] = useState("");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState("");
  const [form, setForm] = useState({
    title: "",
    categoryId: "",
    attractionId: "",
    metaDescription: "",
    content: "",
  });
  const thumbnailInputRef = useRef(null);
  const articleEditorRef = useRef(null);

  const selectedCategoryName = useMemo(
    () => categories.find((c) => String(c.id) === String(form.categoryId))?.name || "-",
    [categories, form.categoryId],
  );

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive !== false),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const normalizedSearch = categorySearch.trim().toLowerCase();
    return categories.filter((category) => {
      const matchesVisibility =
        categoryVisibilityFilter === "active"
          ? category.isActive !== false
          : categoryVisibilityFilter === "inactive"
            ? category.isActive === false
            : true;

      if (!matchesVisibility) return false;

      if (!normalizedSearch) return true;

      const name = category.name?.toLowerCase() || "";
      const slug = category.slug?.toLowerCase() || "";
      return name.includes(normalizedSearch) || slug.includes(normalizedSearch);
    });
  }, [categories, categoryVisibilityFilter, categorySearch]);

  const selectedAttraction = useMemo(
    () => attractions.find((item) => String(item.id) === String(form.attractionId)) || null,
    [attractions, form.attractionId],
  );

  const filteredArticles = useMemo(() => {
    const normalizedSearch = articleSearch.trim().toLowerCase();
    return articles.filter((article) => {
      const matchesVisibility =
        visibilityFilter === "active"
          ? article.isActive !== false
          : visibilityFilter === "inactive"
            ? article.isActive === false
            : true;

      if (!matchesVisibility) return false;

      if (!normalizedSearch) return true;

      const title = article.title?.toLowerCase() || "";
      const categoryName = article.category?.name?.toLowerCase() || "";
      return title.includes(normalizedSearch) || categoryName.includes(normalizedSearch);
    });
  }, [articles, visibilityFilter, articleSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / ARTICLES_PER_PAGE));

  const paginatedArticles = useMemo(() => {
    const start = (page - 1) * ARTICLES_PER_PAGE;
    return filteredArticles.slice(start, start + ARTICLES_PER_PAGE);
  }, [filteredArticles, page]);

  const paginationPages = useMemo(() => {
    const visible = Math.min(totalPages, 5);
    const startPage = totalPages <= 5 ? 1 : Math.max(1, Math.min(page - 2, totalPages - visible + 1));
    return Array.from({ length: visible }, (_, index) => startPage + index).filter((value) => value <= totalPages);
  }, [page, totalPages]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [articlesRes, categoriesRes, attractionsRes] = await Promise.all([
        getArticles({ page: 1, pageSize: 100 }),
        getArticleCategories({ includeInactive: true }),
        getAttractions({ includeInactive: true }),
      ]);
      setArticles(articlesRes.data?.data || []);
      setCategories(categoriesRes.data?.data || []);
      setAttractions(attractionsRes.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Không thể tải dữ liệu bài viết.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    sessionStorage.setItem(ARTICLE_VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    setPage(1);
  }, [visibilityFilter, articleSearch]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreate = () => {
    setEditingArticle(null);
    setThumbnailFile(null);
    setThumbnailPreviewUrl("");
    setForm({
      title: "",
      categoryId: "",
      attractionId: "",
      metaDescription: "",
      content: "",
    });
    setError("");
    setModalOpen(true);
  };

  const openEdit = async (article) => {
    setError("");
    try {
      const res = await getArticleBySlug(article.slug);
      const detail = res.data;
      setEditingArticle(article);
      setForm({
        title: detail.title || "",
        categoryId: detail.category?.id ? String(detail.category.id) : "",
        attractionId: detail.attraction?.id ? String(detail.attraction.id) : "",
        metaDescription: detail.metaDescription || "",
        content: detail.content || "",
      });
      setThumbnailFile(null);
      setThumbnailPreviewUrl(detail.thumbnailUrl || article.thumbnailUrl || "");
      setModalOpen(true);
    } catch (e) {
      setError(e?.response?.data?.message || "Không thể tải chi tiết bài viết.");
    }
  };

  const handleUploadContentImage = async (file) => {
    try {
      const res = await uploadArticleContentImage(file);
      return res.data?.url || null;
    } catch (e) {
      setError(e?.response?.data?.message || "Không thể upload ảnh nội dung.");
      return null;
    }
  };

  const handleThumbnailUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailPreviewUrl(URL.createObjectURL(file));
    event.target.value = "";
  };

  const submitArticle = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      title: form.title,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      attractionId: form.attractionId ? Number(form.attractionId) : null,
      clearAttraction: !form.attractionId,
      content: form.content,
      metaDescription: form.metaDescription || null,
    };
    try {
      let articleId = editingArticle?.id;
      if (editingArticle) {
        await updateArticle(editingArticle.id, payload);
      } else {
        const createRes = await createArticle(payload);
        articleId = createRes?.data?.id;
      }

      if (thumbnailFile && articleId) {
        await uploadArticleThumbnail(articleId, thumbnailFile);
      }

      setModalOpen(false);
      setThumbnailFile(null);
      setThumbnailPreviewUrl("");
      await loadData();
    } catch (e2) {
      setError(e2?.response?.data?.message || "Không thể lưu bài viết.");
    } finally {
      setSaving(false);
    }
  };

  const submitCategory = async () => {
    if (!categoryName.trim()) return;
    try {
      await createArticleCategory(categoryName.trim());
      setCategoryName("");
      setCategoryModalOpen(false);
      const categoriesRes = await getArticleCategories({ includeInactive: true });
      setCategories(categoriesRes.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Không thể tạo danh mục bài viết.");
    }
  };

  const handleToggleCategory = async (categoryId) => {
    const currentCategory = categories.find((category) => category.id === categoryId);
    if (!currentCategory) return;
    const nextIsActive = !(currentCategory.isActive !== false);

    setError("");
    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId ? { ...category, isActive: nextIsActive } : category,
      ),
    );

    try {
      const res = await toggleArticleCategoryActive(categoryId);
      const confirmed = res?.data?.isActive;
      if (typeof confirmed === "boolean") {
        setCategories((prev) =>
          prev.map((category) =>
            category.id === categoryId ? { ...category, isActive: confirmed } : category,
          ),
        );
      }
    } catch (e) {
      setCategories((prev) =>
        prev.map((category) =>
          category.id === categoryId ? { ...category, isActive: currentCategory.isActive } : category,
        ),
      );
      setError(e?.response?.data?.message || "Không thể cập nhật trạng thái danh mục.");
    }
  };

  const startEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name || "");
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const saveCategoryEdit = async (categoryId) => {
    if (!editingCategoryName.trim()) return;
    try {
      const res = await updateArticleCategory(categoryId, editingCategoryName.trim());
      const next = res?.data;
      const nextName = next?.name || editingCategoryName.trim();
      const nextSlug = next?.slug;
      setCategories((prev) =>
        prev.map((category) =>
          category.id === categoryId
            ? { ...category, name: nextName, slug: nextSlug || category.slug }
            : category,
        ),
      );
      setArticles((prev) =>
        prev.map((article) =>
          article.category?.id === categoryId
            ? {
                ...article,
                category: {
                  ...article.category,
                  name: nextName,
                  ...(nextSlug ? { slug: nextSlug } : {}),
                },
              }
            : article,
        ),
      );
      cancelEditCategory();
    } catch (e) {
      setError(e?.response?.data?.message || "Không thể cập nhật danh mục.");
    }
  };

  const handleToggleVisibility = async (articleId) => {
    const currentArticle = articles.find((article) => article.id === articleId);
    if (!currentArticle) return;
    const nextIsActive = !(currentArticle.isActive !== false);

    setError("");
    setArticles((prev) =>
      prev.map((article) =>
        article.id === articleId ? { ...article, isActive: nextIsActive } : article,
      ),
    );

    try {
      const res = await toggleArticleActive(articleId);
      const confirmedIsActive = res?.data?.isActive;
      if (typeof confirmedIsActive === "boolean") {
        setArticles((prev) =>
          prev.map((article) =>
            article.id === articleId ? { ...article, isActive: confirmedIsActive } : article,
          ),
        );
      }
    } catch (e) {
      setArticles((prev) =>
        prev.map((article) =>
          article.id === articleId ? { ...article, isActive: currentArticle.isActive } : article,
        ),
      );
      setError(e?.response?.data?.message || "Không thể cập nhật trạng thái hiển thị bài viết.");
    }
  };

  const openPreviewPage = () => {
    const payload = {
      title: form.title || "Bài viết chưa có tiêu đề",
      categoryName: selectedCategoryName,
      status: editingArticle?.status || "Draft",
      metaDescription: form.metaDescription || "",
      content: form.content || "<p>Chưa có nội dung.</p>",
      attraction: selectedAttraction
        ? {
            id: selectedAttraction.id,
            name: selectedAttraction.name,
            category: selectedAttraction.category || "",
            address: selectedAttraction.address || "",
            latitude: selectedAttraction.latitude,
            longitude: selectedAttraction.longitude,
            imageUrl: selectedAttraction.imageUrl || "",
            mapEmbedLink: selectedAttraction.mapEmbedLink || "",
            isActive: selectedAttraction.isActive,
          }
        : null,
      previewedAt: new Date().toISOString(),
    };
    localStorage.setItem("article-preview-draft", JSON.stringify(payload));
    window.open("/preview/article", "_blank", "noopener,noreferrer");
  };

  const viewArticle = (article) => {
    if (!article?.slug) return;
    window.open(`/preview/article?slug=${encodeURIComponent(article.slug)}`, "_blank", "noopener,noreferrer");
  };

  const handlePublishArticle = async (articleId) => {
    const currentArticle = articles.find((article) => article.id === articleId);
    if (!currentArticle || currentArticle.status === "Published") return;

    setError("");
    try {
      const res = await updateArticle(articleId, { status: "Published" });
      const nextStatus = res?.data?.status || "Published";
      const publishedAt = new Date().toISOString();
      setArticles((prev) =>
        prev.map((article) =>
          article.id === articleId
            ? { ...article, status: nextStatus, publishedAt }
            : article,
        ),
      );
    } catch (e) {
      setError(e?.response?.data?.message || "Không thể publish bài viết.");
    }
  };

  return (
    <>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, color: "#1c1917", fontWeight: 700 }}>
              Quản lý bài viết
            </h2>
            <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
              Tạo, chỉnh sửa, xem trước và quản lý trạng thái bài viết trong admin.
            </p>
          </div>
          {activeTab === "articles" ? (
            <button
              onClick={openCreate}
              style={{
                height: 36,
                padding: "0 18px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                background: "#4f645b",
                color: "#ecfdf5",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
                lineHeight: 1,
                boxShadow: "0 4px 12px rgba(79,100,91,.18)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>add_circle</span>
              Tạo bài viết
            </button>
          ) : activeTab === "categories" ? (
            <button
              onClick={() => setCategoryModalOpen(true)}
              style={{
                height: 36,
                padding: "0 18px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                background: "#4f645b",
                color: "#ecfdf5",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
                lineHeight: 1,
                boxShadow: "0 4px 12px rgba(79,100,91,.18)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>add_circle</span>
              Thêm danh mục
            </button>
          ) : null}
        </div>

        {error ? (
          <div style={{ ...cardStyle, padding: 14, marginBottom: 20, color: "#b91c1c", background: "#fff7f7" }}>
            {error}
          </div>
        ) : null}

        <section style={{ ...cardStyle, padding: 10, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 6, background: "#f7f4ee", padding: 4, borderRadius: 14, width: "fit-content" }}>
            {[
              { key: "articles", label: "Bài viết", icon: "article" },
              { key: "categories", label: "Danh mục", icon: "category" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "9px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: activeTab === tab.key ? "white" : "transparent",
                  color: activeTab === tab.key ? "#1c1917" : "#78716c",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 700,
                  boxShadow: activeTab === tab.key ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === "articles" ? (
          <section style={{ ...cardStyle, padding: 18, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap", justifyContent: "flex-start" }}>
              <div>
                <label style={labelStyle}>Tìm kiếm</label>
                <input
                  value={articleSearch}
                  onChange={(e) => setArticleSearch(e.target.value)}
                  placeholder="Tên bài hoặc danh mục"
                  style={{ ...inputStyle, minWidth: 220, padding: "7px 14px", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={labelStyle}>Lọc hiển thị</label>
                <select value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value)} style={{ ...inputStyle, minWidth: 180, padding: "7px 14px", fontSize: 13 }}>
                  <option value="all">Tất cả</option>
                  <option value="active">Đang hiện</option>
                  <option value="inactive">Đang ẩn</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Chế độ xem</label>
                <div style={{ display: "flex", gap: 2, background: "#f1f0ea", padding: 4, borderRadius: 12 }}>
                  {["table", "grid"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 9,
                        background: viewMode === mode ? "white" : "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: viewMode === mode ? "#1c1917" : "#9ca3af",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        boxShadow: viewMode === mode ? "0 1px 4px rgba(0,0,0,.1)" : "none",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        {mode === "table" ? "table_rows" : "grid_view"}
                      </span>
                      {mode === "table" ? "Bảng" : "Lưới"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section style={{ ...cardStyle, padding: 18, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap", justifyContent: "flex-start" }}>
              <div>
                <label style={labelStyle}>Tìm kiếm</label>
                <input
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  style={{ ...inputStyle, minWidth: 260, padding: "7px 14px", fontSize: 13 }}
                  placeholder="Tên danh mục hoặc slug"
                />
              </div>
              <div>
                <label style={labelStyle}>Lọc hiển thị</label>
                <select value={categoryVisibilityFilter} onChange={(e) => setCategoryVisibilityFilter(e.target.value)} style={{ ...inputStyle, minWidth: 180, padding: "7px 14px", fontSize: 13 }}>
                  <option value="all">Tất cả</option>
                  <option value="active">Đang bật</option>
                  <option value="inactive">Đang ẩn</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {activeTab === "articles" ? (
        <section style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f0ea", display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16 }}>
            <div>
              <strong style={{ color: "#1c1917" }}>Danh sách bài viết</strong>
              <p style={{ margin: "4px 0 0", color: "#78716c", fontSize: 13 }}>
                Tổng cộng {filteredArticles.length} / {articles.length} bài viết. Trang {page}/{totalPages}.
              </p>
            </div>
          </div>
          {viewMode === "table" ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#faf8f3", borderBottom: "1px solid #f1f0ea" }}>
                    {["Bài viết", "Danh mục", "Trạng thái", "Hiển thị", "Ngày xuất bản", "Thao tác"].map((heading, idx) => (
                      <th key={heading} style={{ padding: "16px 18px", textAlign: idx === 5 ? "right" : "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#78716c" }}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Đang tải dữ liệu...</td></tr>
                  ) : paginatedArticles.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Chưa có bài viết phù hợp bộ lọc.</td></tr>
                  ) : (
                    paginatedArticles.map((article) => (
                      <tr key={article.id} style={{ borderBottom: "1px solid #f7f4ee" }}>
                        <td style={{ padding: "16px 18px" }}>
                          <div style={{ fontWeight: 700, color: "#1c1917" }}>{article.title}</div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "#78716c" }}>{article.slug}</div>
                        </td>
                        <td style={{ padding: "16px 18px", color: "#57534e" }}>{article.category?.name || "-"}</td>
                        <td style={{ padding: "16px 18px" }}>
                          <span style={{ padding: "5px 10px", borderRadius: 999, background: article.status === "Published" ? "#ecfdf5" : article.status === "Pending_Review" ? "#fff7ed" : "#f5f5f4", color: article.status === "Published" ? "#047857" : article.status === "Pending_Review" ? "#c2410c" : "#57534e", fontSize: 11, fontWeight: 700 }}>
                            {article.status}
                          </span>
                        </td>
                        <td style={{ padding: "16px 18px" }}>
                          <VisibilitySwitch checked={article.isActive !== false} onChange={() => handleToggleVisibility(article.id)} />
                        </td>
                        <td style={{ padding: "16px 18px", color: "#57534e" }}>{formatDate(article.publishedAt)}</td>
                        <td style={{ padding: "16px 18px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8 }}>
                            {article.status !== "Published" ? (
                              <button type="button" onClick={() => handlePublishArticle(article.id)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", cursor: "pointer", fontWeight: 600 }}>Publish</button>
                            ) : null}
                            <button type="button" onClick={() => viewArticle(article)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe7df", background: "#f8fcf9", color: "#2f5d4d", cursor: "pointer" }}>Xem</button>
                            <button type="button" onClick={() => openEdit(article)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e7e5e4", background: "white", cursor: "pointer" }}>Sửa</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 20 }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Đang tải dữ liệu...</div>
              ) : paginatedArticles.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Chưa có bài viết phù hợp bộ lọc.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
                  {paginatedArticles.map((article) => (
                    <article key={article.id} style={{ background: "#fffdfa", border: "1px solid #f1f0ea", borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 14px rgba(0,0,0,.04)" }}>
                      <div style={{ position: "relative", height: 180, background: "linear-gradient(135deg, #ece7df, #f8f5ef)" }}>
                        {article.thumbnailUrl ? (
                          <img src={article.thumbnailUrl} alt={article.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#a8a29e" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 44 }}>article</span>
                          </div>
                        )}
                        <div style={{ position: "absolute", top: 12, left: 12 }}>
                          <span style={{ padding: "6px 10px", borderRadius: 999, background: article.status === "Published" ? "rgba(236,253,245,.95)" : article.status === "Pending_Review" ? "rgba(255,247,237,.95)" : "rgba(245,245,244,.95)", color: article.status === "Published" ? "#047857" : article.status === "Pending_Review" ? "#c2410c" : "#57534e", fontSize: 11, fontWeight: 700 }}>
                            {article.status}
                          </span>
                        </div>
                      </div>

                      <div style={{ padding: 16, display: "grid", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 17, fontWeight: 700, color: "#1c1917", lineHeight: 1.4 }}>{article.title}</div>
                          <div style={{ marginTop: 6, fontSize: 12, color: "#78716c" }}>{article.slug}</div>
                        </div>

                        <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#57534e" }}>
                          <div><strong style={{ color: "#1c1917" }}>Danh mục:</strong> {article.category?.name || "-"}</div>
                          <div><strong style={{ color: "#1c1917" }}>Ngày xuất bản:</strong> {formatDate(article.publishedAt)}</div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <span style={{ color: "#1c1917", fontWeight: 600 }}>Hiển thị</span>
                            <VisibilitySwitch checked={article.isActive !== false} onChange={() => handleToggleVisibility(article.id)} />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: article.status !== "Published" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8 }}>
                          {article.status !== "Published" ? (
                            <button type="button" onClick={() => handlePublishArticle(article.id)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", cursor: "pointer", fontWeight: 600 }}>Publish</button>
                          ) : null}
                          <button type="button" onClick={() => viewArticle(article)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #dbe7df", background: "#f8fcf9", color: "#2f5d4d", cursor: "pointer", fontWeight: 600 }}>Xem</button>
                          <button type="button" onClick={() => openEdit(article)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e7e5e4", background: "white", cursor: "pointer", fontWeight: 600 }}>Sửa</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
          {!loading && filteredArticles.length > 0 ? (
            <div style={{ marginTop: 14, padding: "18px 20px 20px", borderTop: "1px solid #f3efe7", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>
                {(page - 1) * ARTICLES_PER_PAGE + 1}–{Math.min(page * ARTICLES_PER_PAGE, filteredArticles.length)} / {filteredArticles.length} bài viết
              </span>
              {filteredArticles.length > ARTICLES_PER_PAGE ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: "1px solid #e7e5e4",
                      background: page <= 1 ? "#f5f5f4" : "white",
                      color: page <= 1 ? "#c4bfb7" : "#57534e",
                      cursor: page <= 1 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                  </button>
                  {paginationPages.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      style={{
                        minWidth: 36,
                        height: 36,
                        padding: "0 10px",
                        borderRadius: 10,
                        border: pageNumber === page ? "1px solid #4f645b" : "1px solid #e7e5e4",
                        background: pageNumber === page ? "#4f645b" : "white",
                        color: pageNumber === page ? "#ecfdf5" : "#57534e",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: "1px solid #e7e5e4",
                      background: page >= totalPages ? "#f5f5f4" : "white",
                      color: page >= totalPages ? "#c4bfb7" : "#57534e",
                      cursor: page >= totalPages ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
        ) : (
        <section style={{ ...cardStyle, padding: 20, display: "grid", gap: 20 }}>
          <div style={{ display: "grid", gap: 12 }}>
            {filteredCategories.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", color: "#9ca3af", border: "1px dashed #e7e5e4", borderRadius: 16 }}>
                Chưa có danh mục nào.
              </div>
            ) : (
              <div style={{ overflowX: "auto", border: "1px solid #f1f0ea", borderRadius: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#faf8f3", borderBottom: "1px solid #f1f0ea" }}>
                      {["Danh mục", "Số bài viết", "Trạng thái", "Thao tác"].map((heading, idx) => (
                        <th key={heading} style={{ padding: "16px 18px", textAlign: idx === 3 ? "right" : "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#78716c" }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.map((category) => (
                      <tr key={category.id} style={{ borderBottom: "1px solid #f7f4ee" }}>
                        <td style={{ padding: "16px 18px" }}>
                          {editingCategoryId === category.id ? (
                            <input
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                              style={{ ...inputStyle, minWidth: 260, padding: "8px 12px", fontSize: 13 }}
                            />
                          ) : (
                            <>
                              <div style={{ fontWeight: 700, color: "#1c1917" }}>{category.name}</div>
                              <div style={{ marginTop: 4, fontSize: 12, color: "#78716c" }}>{category.slug || "-"}</div>
                            </>
                          )}
                        </td>
                        <td style={{ padding: "16px 18px", color: "#57534e", fontWeight: 600 }}>{category.articleCount || 0}</td>
                        <td style={{ padding: "16px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ padding: "6px 10px", borderRadius: 999, background: category.isActive !== false ? "#ecfdf5" : "#f5f5f4", color: category.isActive !== false ? "#047857" : "#57534e", fontSize: 11, fontWeight: 700 }}>
                              {category.isActive !== false ? "Đang bật" : "Đang ẩn"}
                            </span>
                            <VisibilitySwitch checked={category.isActive !== false} onChange={() => handleToggleCategory(category.id)} />
                          </div>
                        </td>
                        <td style={{ padding: "16px 18px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8 }}>
                            {editingCategoryId === category.id ? (
                              <>
                                <button type="button" onClick={cancelEditCategory} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e7e5e4", background: "white", cursor: "pointer", fontWeight: 600 }}>Hủy</button>
                                <button type="button" onClick={() => saveCategoryEdit(category.id)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #dbe7df", background: "#f8fcf9", color: "#2f5d4d", cursor: "pointer", fontWeight: 600 }}>Lưu</button>
                              </>
                            ) : (
                              <button type="button" onClick={() => startEditCategory(category)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e7e5e4", background: "white", cursor: "pointer", fontWeight: 600 }}>Sửa</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
        )}
      </div>

      {modalOpen ? (
        <Overlay title={editingArticle ? "Chỉnh sửa bài viết" : "Tạo bài viết"} onClose={() => setModalOpen(false)}>
          <form onSubmit={submitArticle}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr", gap: 24 }}>
              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Tiêu đề</label>
                  <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Danh mục</label>
                    <select value={form.categoryId} onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))} style={inputStyle}>
                      <option value="">Chọn danh mục</option>
                      {activeCategories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Địa điểm liên kết</label>
                  <select
                    value={form.attractionId}
                    onChange={(e) => setForm((prev) => ({ ...prev, attractionId: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">Không liên kết địa điểm</option>
                    {attractions.map((attraction) => (
                      <option key={attraction.id} value={attraction.id}>
                        {attraction.name}{attraction.category ? ` - ${attraction.category}` : ""}{attraction.isActive === false ? " (Đang ẩn)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Meta description</label>
                  <textarea value={form.metaDescription} onChange={(e) => setForm((prev) => ({ ...prev, metaDescription: e.target.value }))} style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} />
                </div>
                <div>
                  <label style={labelStyle}>Nội dung bài viết</label>
                  <QuillEditor
                    value={form.content}
                    onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
                    onUploadImage={handleUploadContentImage}
                    onOpenPreviewPage={openPreviewPage}
                    editorRef={articleEditorRef}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
                <div style={{ ...cardStyle, padding: 16 }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: "#78716c", fontWeight: 700 }}>
                    Tóm tắt nhanh
                  </div>
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    <div><strong>Danh mục:</strong> {selectedCategoryName}</div>
                    <div><strong>Địa điểm:</strong> {selectedAttraction?.name || "-"}</div>
                    <div><strong>Trạng thái hiện tại:</strong> {editingArticle?.status || "Draft"}</div>
                  </div>
                </div>
                <div style={{ ...cardStyle, padding: 16 }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: "#78716c", fontWeight: 700 }}>
                    Địa điểm sẽ hiển thị bên phải
                  </div>
                  <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                    {selectedAttraction ? (
                      <div style={{ padding: 12, borderRadius: 14, background: "#f9f8f3", border: "1px solid #ece7dc", display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 700, color: "#1c1917" }}>{selectedAttraction.name}</div>
                        {selectedAttraction.category ? (
                          <div style={{ fontSize: 13, color: "#57534e" }}>Loại: {selectedAttraction.category}</div>
                        ) : null}
                        {selectedAttraction.address ? (
                          <div style={{ fontSize: 13, color: "#6b7280" }}>{selectedAttraction.address}</div>
                        ) : null}
                        <div style={{ fontSize: 13, color: "#2f5d4d" }}>
                          Khi xem bài, card địa điểm và sitemap sẽ hiện ở cột bên phải.
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "#78716c", lineHeight: 1.6 }}>
                        Nếu chọn địa điểm, trang xem bài sẽ tự hiện card thông tin địa điểm và sitemap ở cột bên phải.
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ ...cardStyle, padding: 16 }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: "#78716c", fontWeight: 700 }}>
                    Ảnh bìa
                  </div>
                  {thumbnailPreviewUrl ? (
                    <div style={{ marginTop: 12, borderRadius: 14, overflow: "hidden", border: "1px solid #ece7dc", background: "#f9f8f3" }}>
                      <img src={thumbnailPreviewUrl} alt="Thumbnail preview" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                    </div>
                  ) : (
                    <div style={{ marginTop: 12, borderRadius: 14, border: "1px dashed #d6d3d1", background: "#fcfbf7", minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#a8a29e" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 42 }}>image</span>
                    </div>
                  )}
                  <button type="button" onClick={() => thumbnailInputRef.current?.click()} style={{ marginTop: 12, padding: "10px 14px", borderRadius: 12, border: "1px solid #e7e5e4", background: "white", cursor: "pointer", fontWeight: 600 }}>
                    {thumbnailPreviewUrl ? "Đổi ảnh bìa" : "Chọn ảnh bìa"}
                  </button>
                  <input ref={thumbnailInputRef} type="file" accept="image/*" onChange={handleThumbnailUpload} style={{ display: "none" }} />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button type="button" onClick={() => setModalOpen(false)} style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #e7e5e4", background: "white", color: "#57534e", fontWeight: 600, cursor: "pointer" }}>
                Đóng
              </button>
              <button type="submit" disabled={saving} style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: "#4f645b", color: "#ecfdf5", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Đang lưu..." : "Lưu bài viết"}
              </button>
            </div>
          </form>
        </Overlay>
      ) : null}

      {categoryModalOpen ? (
        <Overlay title="Tạo danh mục" onClose={() => setCategoryModalOpen(false)}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={labelStyle}>Tên danh mục</label>
              <input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                style={inputStyle}
                placeholder="Nhập tên danh mục mới"
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button type="button" onClick={() => setCategoryModalOpen(false)} style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #e7e5e4", background: "white", color: "#57534e", fontWeight: 600, cursor: "pointer" }}>
                Đóng
              </button>
              <button type="button" onClick={submitCategory} style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: "#4f645b", color: "#ecfdf5", fontWeight: 700, cursor: "pointer" }}>
                Lưu danh mục
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
